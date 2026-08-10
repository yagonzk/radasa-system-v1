import {
  interpretarAbastecimentoXml,
  type AbastecimentoXmlInterpretado,
} from "./abastecimento-xml.service.js";

export interface DocumentoProdutoInterpretado {
  codigo?: string | null;
  descricao: string;
  quantidadeLitros: number;
  valorUnitario: number;
  valorTotal: number;
}

export interface DocumentoAbastecimentoInterpretado {
  origem: "XML" | "PDF";
  chaveNfe: string | null;
  numeroNota: string | null;
  numeroNotaLida?: string | null;
  serieNota: string | null;
  dataEmissao: string | null;
  fornecedorCnpj: string | null;
  fornecedorCnpjLido?: string | null;
  fornecedorNome: string | null;
  placa: string | null;
  hodometro: number | null;
  valorTotal: number | null;
  valorDesconto: number | null;
  produtos: DocumentoProdutoInterpretado[];
  avisos: string[];
}

function normalizePlate(value: unknown) {
  const plate = String(value ?? "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();

  return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(plate) ? plate : "";
}

function extractLabeledPlate(text: string) {
  const normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const patterns = [
    /(?:^|[\s;|])PLACA\s*(?:DO\s+VEICULO|VEICULO|CAVALO|TRATOR)?\s*[:=\-]?\s*([A-Z]{3}[\s.-]?[0-9][A-Z0-9][0-9]{2})\b/i,
    /(?:^|[\s;|])VEICULO\s*[-/]?\s*PLACA\s*[:=\-]?\s*([A-Z]{3}[\s.-]?[0-9][A-Z0-9][0-9]{2})\b/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    const plate = normalizePlate(match?.[1]);
    if (plate) return plate;
  }

  return "";
}

function extractAnyPlate(text: string) {
  const matches = text
    .toUpperCase()
    .match(/\b[A-Z]{3}[\s.-]?[0-9][A-Z0-9][0-9]{2}\b/g);

  for (const match of matches ?? []) {
    const plate = normalizePlate(match);
    if (plate) return plate;
  }

  return "";
}

function parseBrazilianNumber(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDate(text: string) {
  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const br = text.match(/\b(\d{2})\/(\d{2})\/(20\d{2})\b/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;

  return null;
}

function parseOdometer(text: string) {
  const normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const match = normalized.match(
    /(?:HODOMETRO|ODOMETRO|QUILOMETRAGEM|KM\s*ATUAL|(?:^|[\s;|])KM)\s*[:=\-]?\s*([0-9.]{3,12}(?:,[0-9]+)?)/i,
  );
  if (!match?.[1]) return null;

  const integer = match[1].split(",")[0].replace(/\D/g, "");
  const value = Number(integer);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function extractAccessKey(text: string) {
  const labeled = text.match(/CHAVE\s+DE\s+ACESSO\s*([\d\s.-]{44,100})/i)?.[1];
  const labeledDigits = String(labeled ?? "").replace(/\D/g, "");
  if (labeledDigits.length >= 44) return labeledDigits.slice(0, 44);

  for (const candidate of text.match(/(?:\d[\s.-]?){44}/g) ?? []) {
    const digits = candidate.replace(/\D/g, "");
    if (digits.length === 44) return digits;
  }
  return null;
}

function extractIssuer(text: string) {
  const cnpjs = text.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g) ?? [];
  const accessKey = extractAccessKey(text);
  const accessKeyCnpj = accessKey?.slice(6, 20) ?? "";
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const receiptName = text.match(
    /RECEBEMOS\s+DE\s+(.+?)\s+OS\s+PRODUTOS\b/i,
  )?.[1];

  if (receiptName) {
    return {
      cnpj:
        (accessKeyCnpj.length === 14 ? accessKeyCnpj : "") ||
        cnpjs[0]?.replace(/\D/g, "") ||
        null,
      nome: receiptName.replace(/\s+/g, " ").trim(),
    };
  }

  const danfeHeader = text.match(/DANFE\s*([^\n]+)\n([^\n]+)\nDocumento\s+Auxiliar/i);
  if (danfeHeader) {
    return {
      cnpj:
        (accessKeyCnpj.length === 14 ? accessKeyCnpj : "") ||
        cnpjs[0]?.replace(/\D/g, "") ||
        null,
      nome: `${danfeHeader[1]} ${danfeHeader[2]}`.replace(/\s+/g, " ").trim(),
    };
  }
  const danfeIndex = lines.findIndex((line) => /^DANFE\b/i.test(line));
  const nameLines = danfeIndex > 0
    ? lines.slice(Math.max(0, danfeIndex - 3), danfeIndex)
      .filter((line) => !/^(DOCUMENTO|NOTA\s+FISCAL|ENTRADA|SA[IÍ]DA|CHAVE\s+DE)/i.test(line))
    : [];
  return {
    cnpj:
      (accessKeyCnpj.length === 14 ? accessKeyCnpj : "") ||
      cnpjs[0]?.replace(/\D/g, "") ||
      null,
    nome: nameLines.join(" ") || null,
  };
}

function extractProducts(text: string): DocumentoProdutoInterpretado[] {
  const section = text.match(/DADOS\s+DOS\s+PRODUTOS[\s\S]*?(?=DADOS\s+ADICIONAIS|$)/i)?.[0] ?? text;
  const spacedPattern = /^[ \t]*([A-Z0-9][A-Z0-9._/-]*)[ \t]+(.+?)[ \t]+(\d{8})[ \t]+(\d{3})[ \t]+(\d{4})[ \t]+([A-Z]{1,4})[ \t]+([\d.]+,\d{2,4})[ \t]+([\d.]+,\d{2,4})[ \t]+([\d.]+,\d{2,4})[ \t]+([\d.]+,\d{2,4})(?:[ \t]|$)/gim;
  const compactPattern = /^\s*(\d+)([A-Z][A-Z0-9 /.-]*?)(\d{8})(\d{3})(\d{4})([A-Z]{1,4})(\d+,\d{4})(\d+,\d{2})(\d+,\d{2})([\d.]+,\d{2})/gim;
  const products: DocumentoProdutoInterpretado[] = [];

  for (const pattern of [spacedPattern, compactPattern]) {
    for (const match of section.matchAll(pattern)) {
      const quantidadeLitros = parseBrazilianNumber(match[7]);
      const valorUnitario = parseBrazilianNumber(match[8]);
      const valorTotal = parseBrazilianNumber(match[10]);
      if (quantidadeLitros === null || valorUnitario === null || valorTotal === null) continue;
      products.push({
        codigo: match[1],
        descricao: match[2].replace(/\s+/g, " ").trim(),
        quantidadeLitros,
        valorUnitario,
        valorTotal,
      });
    }

    if (products.length) break;
  }

  return products;
}

function xmlToDocument(
  document: AbastecimentoXmlInterpretado,
): DocumentoAbastecimentoInterpretado {
  const produtos = document.produtos.map((produto) => ({
    codigo: produto.codigo || null,
    descricao: produto.combustivel?.descricaoAnp || produto.nome,
    quantidadeLitros: produto.quantidade,
    valorUnitario: produto.valorUnitario,
    valorTotal: produto.valorTotal,
  }));

  return {
    origem: "XML",
    chaveNfe: document.chaveNfe || null,
    numeroNota: document.numero || null,
    serieNota: document.serie || null,
    dataEmissao: document.dataEmissao || null,
    fornecedorCnpj: document.emitente.cnpj || null,
    fornecedorNome:
      document.emitente.nomeFantasia || document.emitente.razaoSocial || null,
    placa: document.placa || null,
    hodometro: document.hodometro,
    valorTotal: document.totais.nota || null,
    valorDesconto: document.totais.desconto || 0,
    produtos,
    avisos: [
      ...(!document.placa
        ? ["A placa não foi encontrada no XML. Se ela estiver no rodapé, confira as informações complementares da NF-e."]
        : []),
      ...(document.hodometro === null
        ? ["O odômetro não foi encontrado automaticamente."]
        : []),
    ],
  };
}

export async function interpretarDocumentoAbastecimento(file: {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}): Promise<DocumentoAbastecimentoInterpretado> {
  const extension = file.originalname.split(".").pop()?.toLowerCase();

  if (extension === "xml" || file.mimetype.toLowerCase().includes("xml")) {
    const xml = file.buffer.toString("utf8");
    return xmlToDocument(interpretarAbastecimentoXml(xml));
  }

  if (extension === "pdf" || file.mimetype === "application/pdf") {
    if (file.mimetype !== "application/x-radasa-pdf-text") {
      throw new Error("O PDF deve ser interpretado no navegador antes do envio.");
    }
    const parsed = { text: file.buffer.toString("utf8") };
    const text = String(parsed.text ?? "");

    if (!text.trim()) {
      throw new Error(
        "O PDF não possui texto pesquisável. Utilize o XML da NF-e.",
      );
    }

    const plate = extractLabeledPlate(text) || extractAnyPlate(text);
    const issuer = extractIssuer(text);
    const products = extractProducts(text);
    const totalMatch = text.match(
      /(?:VALOR\s+TOTAL(?:\s+DA\s+NOTA)?|TOTAL\s+DA\s+NOTA)\s*[:=\-]?\s*R?\$?\s*([0-9.]+,[0-9]{2})/i,
    );

    return {
      origem: "PDF",
      chaveNfe: extractAccessKey(text),
      serieNota: text.match(/S[ÉE]RIE\s*0*(\d{1,6})/i)?.[1] ?? null,
      numeroNotaLida:
        text.match(/(?:NF[-\s]?E|NOTA\s+FISCAL)\s*(?:N[º°O.]*)?\s*[:=\-]?\s*(\d{1,12})/i)?.[1] ??
        null,
      dataEmissao: parseDate(text),
      numeroNota: text.match(/N[º°o.]?\s*([\d.]{1,20})/i)?.[1]?.replace(/\D/g, "") ?? null,
      fornecedorCnpjLido:
        text.match(/CNPJ\s*[:=\-]?\s*([0-9./-]{14,18})/i)?.[1]?.replace(/\D/g, "") ??
        issuer.cnpj,
      fornecedorNome: issuer.nome,
      fornecedorCnpj: issuer.cnpj,
      placa: plate || null,
      hodometro: parseOdometer(text),
      valorTotal: parseBrazilianNumber(totalMatch?.[1]),
      valorDesconto: 0,
      produtos: products,
      avisos: [
        "A leitura de PDF é auxiliar. Confira os dados antes de cadastrar.",
        ...(!plate ? ["A placa não foi encontrada no PDF."] : []),
        "Para preencher produtos e valores com precisão, prefira o XML da NF-e.",
      ],
    };
  }

  throw new Error("Selecione um arquivo XML ou PDF de nota fiscal.");
}

export function interpretarTextoPdfAbastecimento(text: string) {
  return interpretarDocumentoAbastecimento({
    originalname: "documento.pdf",
    mimetype: "application/x-radasa-pdf-text",
    buffer: Buffer.from(text, "utf8"),
  });
}
