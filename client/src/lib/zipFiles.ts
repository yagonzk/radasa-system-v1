export interface ZipEntryData {
  name: string;
  bytes: Uint8Array;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8");

function concatBytes(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

function uint16(value: number) {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
}

function uint32(value: number) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
  return bytes;
}

let crcTable: Uint32Array | null = null;

function getCrcTable() {
  if (crcTable) return crcTable;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  crcTable = table;
  return table;
}

function crc32(bytes: Uint8Array) {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function inflateRaw(bytes: Uint8Array) {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("Este navegador não oferece suporte à descompactação ZIP necessária para processar este arquivo.");
  }
  const stream = new Blob([bytes]).stream().pipeThrough(
    new DecompressionStream("deflate-raw" as CompressionFormat),
  );
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Lê ZIPs comuns (store/deflate) sem dependências externas. É suficiente para
 * lotes de PDFs exportados pelo Windows/7-Zip e evita aumentar o bundle.
 */
export async function readZipEntries(file: File): Promise<ZipEntryData[]> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  let eocd = -1;
  const lowerBound = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= lowerBound; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }

  if (eocd < 0) throw new Error("ZIP inválido: diretório central não encontrado.");

  const totalEntries = view.getUint16(eocd + 10, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  const entries: ZipEntryData[] = [];
  let cursor = centralOffset;

  for (let index = 0; index < totalEntries; index += 1) {
    if (cursor + 46 > bytes.length || view.getUint32(cursor, true) !== 0x02014b50) {
      throw new Error("ZIP inválido: entrada do diretório central corrompida.");
    }

    const flags = view.getUint16(cursor + 8, true);
    const compression = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localHeaderOffset = view.getUint32(cursor + 42, true);
    const nameBytes = bytes.slice(cursor + 46, cursor + 46 + nameLength);
    const name = textDecoder.decode(nameBytes).replace(/\\/g, "/");

    if ((flags & 0x0001) !== 0) {
      throw new Error(`O arquivo ${name || "dentro do ZIP"} está protegido por senha.`);
    }

    cursor += 46 + nameLength + extraLength + commentLength;
    if (!name || name.endsWith("/")) continue;

    if (localHeaderOffset + 30 > bytes.length || view.getUint32(localHeaderOffset, true) !== 0x04034b50) {
      throw new Error(`ZIP inválido: cabeçalho local de ${name} não encontrado.`);
    }

    const localNameLength = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(dataStart, dataStart + compressedSize);

    let output: Uint8Array;
    if (compression === 0) {
      output = compressed;
    } else if (compression === 8) {
      output = await inflateRaw(compressed);
    } else {
      throw new Error(`O ZIP usa um método de compactação não suportado no arquivo ${name}.`);
    }

    if (uncompressedSize && output.byteLength !== uncompressedSize) {
      throw new Error(`O arquivo ${name} não pôde ser descompactado corretamente.`);
    }

    entries.push({ name, bytes: output });
  }

  return entries;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime = ((date.getHours() & 0x1f) << 11) |
    ((date.getMinutes() & 0x3f) << 5) |
    ((Math.floor(date.getSeconds() / 2)) & 0x1f);
  const dosDate = (((year - 1980) & 0x7f) << 9) |
    (((date.getMonth() + 1) & 0x0f) << 5) |
    (date.getDate() & 0x1f);
  return { dosTime, dosDate };
}

/** Cria um ZIP sem compressão, ideal para PDFs já comprimidos. */
export function createZip(entries: ZipEntryData[]) {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;
  const { dosTime, dosDate } = dosDateTime();

  for (const entry of entries) {
    const name = entry.name.replace(/\\/g, "/");
    const nameBytes = textEncoder.encode(name);
    const data = entry.bytes;
    const crc = crc32(data);
    const utf8Flag = 0x0800;

    const localHeader = concatBytes([
      uint32(0x04034b50),
      uint16(20),
      uint16(utf8Flag),
      uint16(0),
      uint16(dosTime),
      uint16(dosDate),
      uint32(crc),
      uint32(data.byteLength),
      uint32(data.byteLength),
      uint16(nameBytes.byteLength),
      uint16(0),
      nameBytes,
    ]);

    localParts.push(localHeader, data);

    const centralHeader = concatBytes([
      uint32(0x02014b50),
      uint16(20),
      uint16(20),
      uint16(utf8Flag),
      uint16(0),
      uint16(dosTime),
      uint16(dosDate),
      uint32(crc),
      uint32(data.byteLength),
      uint32(data.byteLength),
      uint16(nameBytes.byteLength),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(0),
      uint32(localOffset),
      nameBytes,
    ]);
    centralParts.push(centralHeader);
    localOffset += localHeader.byteLength + data.byteLength;
  }

  const centralDirectory = concatBytes(centralParts);
  const localData = concatBytes(localParts);
  const end = concatBytes([
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(entries.length),
    uint16(entries.length),
    uint32(centralDirectory.byteLength),
    uint32(localData.byteLength),
    uint16(0),
  ]);

  return concatBytes([localData, centralDirectory, end]);
}
