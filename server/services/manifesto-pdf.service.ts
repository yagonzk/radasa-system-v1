import { prisma } from "../lib/prisma.js";

export const ROMANEIO_PARSER_VERSION = "2026.08.11.07";

const RADASA_OCR_PRIMARY_MARKER = "[[RADASA_OCR_PRIMARY]]";

export type TipoRomaneioPdf =
  | "Bonificação - Lebrinha"
  | "Acertar c/ Lebrinha"
  | "Receber c/ Cliente";

export interface RomaneioPdfCliente {
  codigo: string;
  nome: string;
}

export interface RomaneioPdfProduto {
  romaneio: string;
  data: string;
  item: string;
  codigo: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  instrucaoCobranca: string;
  notaFiscal: string;
  serie: string;
  tipoManifesto: TipoRomaneioPdf;
  clienteCodigo: string;
  clienteNome: string;
  /** Ordem visual do bloco CLIENTE no PDF. Cada nova ocorrência de CLIENTE inicia um novo bloco. */
  blocoCliente: number;
}

export interface RomaneioPdfInterpretado {
  parserVersion: string;
  dataEmissao: string;
  transportadoraCodigo: string;
  transportadoraNome: string;
  veiculoCodigo: string;
  placaVeiculo: string;
  modeloVeiculo: string;
  clientes: RomaneioPdfCliente[];
  produtos: RomaneioPdfProduto[];
  romaneios: string[];
  notasFiscais: string[];
  valorTotal: number;
  avisos: string[];
}

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

const digits = (value: string) => value.replace(/\D/g, "");

function normalizeVisualLine(value: string) {
  return value
    .trim()
    .split(/\s{2,}/)
    .map((part) => part.replace(/\s+/g, ""))
    .join(" ")
    .replace(/\s*:\s*/g, ":")
    .replace(/\s*-\s*/g, "-")
    .trim();
}

function repairGlyphSpacedText(value: string) {
  return value
    .split("\n")
    .map((rawLine) => {
      const line = rawLine.trim();
      if (!line) return "";

      const tokens = line.split(/\s+/).filter(Boolean);
      const singleGlyphs = tokens.filter((token) => token.length === 1).length;
      const glyphRatio = tokens.length ? singleGlyphs / tokens.length : 0;

      // Alguns PDFs do SIGA entregam cada glifo como um item separado:
      // `1 7 4 5 9 4  2 0 / 0 7 / 2 6 ...`. Nessa forma, nenhum regex
      // estrutural reconhece romaneio/cliente. Quando a linha é
      // majoritariamente composta por tokens de 1 caractere, removemos os
      // espaços entre glifos e deixamos o fallback compacto reconstruir os
      // campos pelas posições fixas e pela NF no fim da linha.
      if (tokens.length >= 8 && glyphRatio >= 0.62) {
        return tokens.join("");
      }

      return rawLine;
    })
    .join("\n");
}

function normalizeOcrDigits(value: string) {
  return value
    // Tesseract às vezes perde o começo de CLIENTE, lê "C ENTE" ou perde
    // o separador ":". Normalizamos somente quando a sequência é seguida do
    // código de cliente para não alterar palavras comuns do documento.
    .replace(/^\s*(?:C\s*)?ENTE\s*[:;]?\s*(?=\d+\/\d+)/gim, "CLIENTE : ")
    .replace(/^\s*CLIENTE\s+(?=\d+\/\d+)/gim, "CLIENTE : ")
    .replace(/\bCLIENTE\s*[;|]\s*/gi, "CLIENTE : ")
    .replace(
      /(\d{2}\/\d{2}\/\d{2})\s+([0-9OQIl]{2})(?=\s+\d{4,10}-)/gi,
      (_match, date: string, item: string) =>
        `${date} ${item.replace(/[OQ]/gi, "0").replace(/[Il]/g, "1")}`,
    )
    .replace(
      /(CLIENTE\s*[:;]?\s*\d+\/)([0-9OQIlC]{2})(?=-)/gi,
      (_match, prefix: string, branch: string) =>
        `${prefix}${branch
          .replace(/[OQC]/gi, "0")
          .replace(/[Il]/g, "1")}`,
    );
}

function isVasilhameDescription(value: string) {
  const name = normalize(value);
  // Inclui erros comuns de OCR como VASILEAME/VASILH4ME sem depender do código.
  return (
    name.includes("VASILHAME") ||
    name.includes("VASILEAME") ||
    /^VASI[A-Z0-9]{2,8}AME/.test(name) ||
    /VASI[A-Z0-9]{0,5}H[A-Z0-9]{0,3}ME/.test(name)
  );
}

function compactLine(value: string) {
  return value.replace(/\s+/g, "").trim();
}

function parseBrazilianNumber(value: string) {
  const normalized = value.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}


type CompactNumericTail = {
  description: string;
  quantityText: string;
  unitText: string;
  totalText: string;
};

/**
 * Separa descrição + Qtde + Unitário + Total quando o PDF.js entrega cada
 * caractere como um item e, ao compactar, os números ficam colados:
 *   GARRAFAO20LT100,003,78378,00
 *
 * As três vírgulas continuam delimitando as casas decimais. Unitário e total
 * ficam determinados exatamente; o início da quantidade é escolhido testando
 * os sufixos numéricos possíveis e priorizando a relação Qtde × Unitário = Total.
 */
function splitCompactNumericTail(value: string): CompactNumericTail | null {
  const commas: number[] = [];
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === ",") commas.push(index);
  }
  if (commas.length < 3) return null;

  const [quantityComma, unitComma, totalComma] = commas.slice(-3);
  const quantityDecimalsEnd = quantityComma + 3;
  const unitDecimalsEnd = unitComma + 3;
  const totalDecimalsEnd = totalComma + 3;

  if (totalDecimalsEnd !== value.length) return null;
  if (quantityDecimalsEnd > unitComma || unitDecimalsEnd > totalComma) return null;

  const unitIntegerStart = quantityDecimalsEnd;
  const totalIntegerStart = unitDecimalsEnd;
  const unitText = value.slice(unitIntegerStart, unitDecimalsEnd);
  const totalText = value.slice(totalIntegerStart, totalDecimalsEnd);

  if (!/^[\d.]+,\d{2}$/.test(unitText) || !/^[\d.]+,\d{2}$/.test(totalText)) {
    return null;
  }

  const unit = parseBrazilianNumber(unitText);
  const total = parseBrazilianNumber(totalText);
  const beforeQuantityComma = value.slice(0, quantityComma);
  const decimals = value.slice(quantityComma + 1, quantityComma + 3);
  if (!/^\d{2}$/.test(decimals)) return null;

  const candidates: Array<CompactNumericTail & { score: number }> = [];
  const minStart = Math.max(1, beforeQuantityComma.length - 8);

  for (let start = minStart; start < beforeQuantityComma.length; start += 1) {
    const integerPart = beforeQuantityComma.slice(start);
    const description = beforeQuantityComma.slice(0, start);
    if (!description || !/^[\d.]+$/.test(integerPart) || !/[A-Z]/i.test(description)) continue;

    const quantityText = `${integerPart},${decimals}`;
    const quantity = parseBrazilianNumber(quantityText);
    if (!(quantity > 0) || quantity > 100000) continue;

    const expectedTotal = quantity * unit;
    const arithmeticError = unit === 0 && total === 0
      ? 0
      : Math.abs(expectedTotal - total);

    // Em linhas normais a multiplicação é a pista mais forte. Em vasilhames,
    // onde unitário e total são zero, preferimos a fronteira que vem logo após
    // uma letra (VASILHAME20L|100,00), evitando escolher apenas os últimos dígitos.
    const previous = description.at(-1) ?? "";
    const boundaryPenalty = /[A-Z]/i.test(previous) ? 0 : /\d/.test(previous) ? 0.35 : 0.15;
    const arithmeticPenalty = unit === 0 && total === 0
      ? 0
      : Math.min(1000, arithmeticError / Math.max(0.01, Math.abs(total)));
    const score = arithmeticPenalty * 100 + boundaryPenalty + start / 1_000_000;

    candidates.push({ description, quantityText, unitText, totalText, score });
  }

  candidates.sort((left, right) => left.score - right.score);
  const best = candidates[0];
  if (!best) return null;

  // Para itens cobrados, rejeita separações que não fecham matematicamente.
  // Isso impede resultados como 20,62 × 3,78 = 78,00 quando a linha real era
  // 100,00 × 3,78 = 378,00.
  if (unit > 0 || total > 0) {
    const quantity = parseBrazilianNumber(best.quantityText);
    if (Math.abs(quantity * unit - total) > 0.06) return null;
  }

  return {
    description: best.description,
    quantityText: best.quantityText,
    unitText: best.unitText,
    totalText: best.totalText,
  };
}


function parsePrintedSummaryTotal(text: string) {
  const normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\r/g, "");
  const resumoIndex = normalized.toUpperCase().lastIndexOf("RESUMO");
  if (resumoIndex < 0) return 0;

  const resumo = normalized.slice(resumoIndex);
  const totalMatch = resumo.match(/(?:^|\n)\s*TOTAL\s*[^0-9\n]{0,120}([0-9.]+,[0-9]{2})/im);
  return totalMatch ? parseBrazilianNumber(totalMatch[1]) : 0;
}

function toIsoDate(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/);
  if (!match) return "";
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${year}-${match[2]}-${match[1]}`;
}

function humanizeProduct(value: string) {
  return value
    .replace(/(?<=[A-ZÀ-Ü])(?=\d)/g, " ")
    .replace(/(?<=\d)(?=[A-ZÀ-Ü])/g, " ")
    .replace(/([A-ZÀ-Ü])(?=C\/\d+)/g, "$1 ")
    .replace(/\s+/g, " ")
    .trim();
}

function humanizeInstruction(value: string, total: number) {
  const normalized = normalize(value);
  if (normalized.includes("RECEBERCCLIENTE")) return "Receber c/ Cliente";
  if (
    normalized.includes("ACERTARCLEBRINHA") ||
    normalized.includes("ACERTARCCLEBRINHA") ||
    normalized.includes("INCLUSONF")
  ) {
    return "Incluso NF - Acertar c/ Lebrinha";
  }
  if (total === 0 || normalized === "X") return "Bonificação - Lebrinha";
  return value.replace(/-/g, " ").replace(/\s+/g, " ").trim();
}

function inferTipo(instruction: string, total: number): TipoRomaneioPdf {
  const normalized = normalize(instruction);
  if (normalized.includes("RECEBERCCLIENTE")) return "Receber c/ Cliente";
  if (
    normalized.includes("ACERTARCLEBRINHA") ||
    normalized.includes("ACERTARCCLEBRINHA") ||
    normalized.includes("INCLUSONF")
  ) {
    return "Acertar c/ Lebrinha";
  }
  return total === 0 ? "Bonificação - Lebrinha" : "Bonificação - Lebrinha";
}


function parseRomaneioHeaderMetadata(text: string) {
  // O cabeçalho costuma ser a região mais afetada pela forma como PDF.js/OCR
  // recompõe espaços. Por isso não dependemos de TRANSPORTADORA/PLACA estarem
  // na mesma linha: juntamos somente o trecho anterior ao primeiro CLIENTE.
  const beforeFirstClient = text.split(/(?=C\s*L\s*I\s*E\s*N\s*T\s*E\s*[:;]?)/i)[0] ?? text;
  const headerText = normalizeOcrDigits(beforeFirstClient)
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Versão compacta para PDFs que extraem rótulos como
  // "T R A N S P O R T A D O R A" ou quebram os campos entre linhas.
  const compactHeader = headerText.replace(/\s+/g, "");

  const transporterMatch =
    headerText.match(
      /T\s*R\s*A\s*N\s*S\s*P\s*O\s*R\s*T\s*A\s*D\s*O\s*R\s*A\s*[:;]?\s*(\d{3,10})\s*-\s*(.+?)(?=C\s*O\s*D(?:\.|I\s*G\s*O)?\s*V\s*E\s*I\s*C\s*U\s*L\s*O|P\s*L\s*A\s*C\s*A\s*V\s*E\s*I\s*C\s*U\s*L\s*O)/i,
    ) ??
    compactHeader.match(
      /TRANSPORTADORA[:;]?(\d{3,10})-(.+?)(?=COD(?:\.|IGO)?VEICULO|PLACAVEICULO)/i,
    );

  const vehicleCodeMatch =
    headerText.match(
      /C\s*O\s*D(?:\.|I\s*G\s*O)?\s*V\s*E\s*I\s*C\s*U\s*L\s*O\s*[:;]?\s*(\d{3,12})/i,
    ) ?? compactHeader.match(/COD(?:\.|IGO)?VEICULO[:;]?(\d{3,12})/i);

  const plateAndModelMatch =
    headerText.match(
      /P\s*L\s*A\s*C\s*A\s*V\s*E\s*I\s*C\s*U\s*L\s*O\s*[:;]?\s*([A-Z]{3}[- ]?[A-Z0-9]{4,5})\s*-?\s*(.*?)(?=P\s*E\s*R\s*I\s*O\s*D\s*O\s*[:;]|$)/i,
    ) ??
    compactHeader.match(
      /PLACAVEICULO[:;]?([A-Z]{3}-?[A-Z0-9]{4,5})-?(.*?)(?=PERIODO[:;]|$)/i,
    );

  // Fallback deliberadamente restrito: só procura uma placa brasileira depois
  // de algum marcador de PLACA, evitando capturar códigos de NF/produto.
  const plateFallback = !plateAndModelMatch
    ? headerText.match(
        /P\s*L\s*A\s*C\s*A[^A-Z0-9]{0,20}([A-Z]{3}[- ]?[A-Z0-9]{4,5})/i,
      )
    : null;

  const placa = (plateAndModelMatch?.[1] ?? plateFallback?.[1] ?? "")
    .replace(/[-\s]/g, "")
    .toUpperCase();
  const modelo = plateAndModelMatch?.[2]
    ? humanizeProduct(plateAndModelMatch[2].replace(/^[-–—]+/, "").trim())
    : "";

  const transportadoraCodigo = transporterMatch?.[1] ?? "";
  let transportadoraNome = transporterMatch?.[2]?.replace(/\s+/g, " ").trim() ?? "";
  // Correção observada em scans do mesmo cadastro: a abreviação final "CI"
  // pode ganhar um T espúrio no OCR. O código 001103 identifica de forma
  // inequívoca a transportadora impressa nesses romaneios.
  if (transportadoraCodigo === "001103" && /^D BARBIERO E CI(?:T)?$/i.test(transportadoraNome)) {
    transportadoraNome = "D BARBIERO E CI";
  }

  return {
    transportadoraCodigo,
    transportadoraNome,
    veiculoCodigo: vehicleCodeMatch?.[1] ?? "",
    placaVeiculo: placa,
    modeloVeiculo: modelo,
  };
}

function parseClientLine(line: string): RomaneioPdfCliente | null {
  const ocrNormalized = normalizeOcrDigits(line);
  const readable = ocrNormalized
    .replace(/\s*([:/-])\s*/g, "$1")
    .trim();
  const readableMatch = readable.match(
    /CLIENTE\s*[:;]?\s*(\d+\/\d+)-(.+?)(?=\s+\d{5,8}\s+\d{2}\/\d{2}\/\d{2}|$)/i,
  );
  const visualMatch = normalizeVisualLine(ocrNormalized).match(
    /CLIENTE\s*[:;]?\s*(\d+\/\d+)-(.+?)(?=\s+\d{5,8}\s+\d{2}\/\d{2}\/\d{2}|$)/i,
  );
  const compactMatch = compactLine(ocrNormalized).match(
    /CLIENTE[:;]?(\d+\/\d+)-(.+?)(?=\d{5,8}\d{2}\/\d{2}\/\d{2}[0-9OQIl]{2}\d{4,10}-|$)/i,
  );
  const match = readableMatch ?? visualMatch ?? compactMatch;
  if (!match) return null;
  return {
    codigo: match[1],
    nome: match[2].replace(/\s+/g, " ").trim(),
  };
}

function parseProductLine(
  line: string,
  cliente: RomaneioPdfCliente,
  blocoCliente = 0,
): RomaneioPdfProduto | null {
  const ocrNormalized = normalizeOcrDigits(line).replace(/\t/g, " ").trim();

  /**
   * Caminho principal: interpreta a linha pelas colunas reais do relatório.
   * Não removemos os espaços internos antes de descobrir descrição/quantidade/
   * unitário/total. A versão anterior compactava a linha cedo demais e, em
   * produtos como "GARRAFAO 20 LT", podia confundir os números da descrição
   * com as colunas monetárias ou engolir a linha física seguinte.
   */
  const prefix = ocrNormalized.match(
    /^(\d{5,8})\s+(\d{2}\/\d{2}\/\d{2})\s+([0-9OQIl]{2})\s+(\d{4,10})-(.+)$/i,
  );

  let matchParts: {
    romaneio: string;
    data: string;
    item: string;
    codigo: string;
    description: string;
    quantityText: string;
    unitText: string;
    totalText: string;
    instruction: string;
    notaFiscal: string;
    serie: string;
  } | null = null;

  if (prefix) {
    const remainder = prefix[5].trim();
    const nfMatch = remainder.match(/(\d{5,9})\/(\d{2,4})\s*$/);
    if (nfMatch) {
      const beforeNf = remainder.slice(0, nfMatch.index).trim();

      // Exige três números brasileiros consecutivos. O primeiro grupo é
      // deliberadamente guloso: assim "20" de "GARRAFAO 20 LT" e "1500" de
      // "1500ML C/6" permanecem na descrição, e as três ÚLTIMAS colunas
      // numéricas antes da cobrança são Qtde / Prc.Unit / Tot.Frete.
      const valuesMatch = beforeNf.match(
        /^(.*)\s+([\d.]+,\d{1,3})\s+([\d.]+,\d{1,3})\s+([\d.]+,\d{1,3})\s*(.*?)$/,
      );

      if (valuesMatch) {
        matchParts = {
          romaneio: prefix[1],
          data: prefix[2],
          item: prefix[3].replace(/[OQ]/gi, "0").replace(/[Il]/g, "1"),
          codigo: prefix[4],
          description: valuesMatch[1].trim(),
          quantityText: valuesMatch[2],
          unitText: valuesMatch[3],
          totalText: valuesMatch[4],
          instruction: valuesMatch[5].trim(),
          notaFiscal: nfMatch[1],
          serie: nfMatch[2],
        };
      }
    }
  }

  /**
   * Fallback para PDFs cujo extrator entrega a linha inteira sem espaços.
   * Aqui usamos o início fixo (romaneio/data/item/código) e a NF fixa no fim.
   * A separação dos valores é feita de trás para frente para impedir que uma
   * quantidade seja tomada da descrição do produto.
   */
  if (!matchParts) {
    const compact = compactLine(ocrNormalized);
    const compactPrefix = compact.match(
      /^(\d{5,8})(\d{2}\/\d{2}\/\d{2})([0-9OQIl]{2})(\d{4,10})-(.+)$/i,
    );

    if (compactPrefix) {
      const compactRemainder = compactPrefix[5];
      const nfMatch = compactRemainder.match(/(\d{5,9})\/(\d{2,4})$/);
      if (nfMatch) {
        const beforeNf = compactRemainder.slice(0, nfMatch.index);

        // A instrução possui vocabulário conhecido. Localizá-la antes de
        // separar os valores elimina a ambiguidade de descrições com números.
        const instructionMarker = beforeNf.search(
          /(?:Receberc\/Cliente|InclusoNF-?Acertarc\/Lebrinha|Bonificacao-?Acertarc\/Lebrinha|--x--)/i,
        );
        if (instructionMarker >= 0) {
          const left = beforeNf.slice(0, instructionMarker);
          const instruction = beforeNf.slice(instructionMarker);

          const numericTail = splitCompactNumericTail(left);

          if (numericTail) {
            matchParts = {
              romaneio: compactPrefix[1],
              data: compactPrefix[2],
              item: compactPrefix[3].replace(/[OQ]/gi, "0").replace(/[Il]/g, "1"),
              codigo: compactPrefix[4],
              description: numericTail.description,
              quantityText: numericTail.quantityText,
              unitText: numericTail.unitText,
              totalText: numericTail.totalText,
              instruction,
              notaFiscal: nfMatch[1],
              serie: nfMatch[2],
            };
          }
        }
      }
    }
  }

  if (!matchParts) return null;

  // Uma linha individual jamais deve conter o início de outro registro.
  // Esta checagem é feita somente DEPOIS de separar as colunas, para não
  // descartar linhas válidas por causa dos próprios números do produto.
  if (hasEmbeddedRecordBoundary(matchParts.description)) return null;

  let quantidade = parseBrazilianNumber(matchParts.quantityText);
  const descricaoLegivel = humanizeProduct(matchParts.description);
  const ehVasilhame = isVasilhameDescription(descricaoLegivel);
  const valorUnitarioLido = parseBrazilianNumber(matchParts.unitText);
  const valorTotalLido = parseBrazilianNumber(matchParts.totalText);

  if (!ehVasilhame && valorUnitarioLido > 0 && valorTotalLido > 0) {
    const expectedTotal = quantidade * valorUnitarioLido;
    if (Math.abs(expectedTotal - valorTotalLido) > 0.03) {
      const inferredQuantity = Math.round((valorTotalLido / valorUnitarioLido) * 100) / 100;
      const inferredTotal = inferredQuantity * valorUnitarioLido;
      if (
        inferredQuantity > 0 &&
        inferredQuantity <= 10000 &&
        Math.abs(inferredTotal - valorTotalLido) <= 0.03
      ) {
        quantidade = inferredQuantity;
      }
    }
  }

  const valorUnitario = ehVasilhame ? 0 : valorUnitarioLido;
  const valorTotal = ehVasilhame ? 0 : valorTotalLido;
  const instrucaoCobranca = humanizeInstruction(matchParts.instruction, valorTotal);

  return {
    romaneio: matchParts.romaneio,
    data: toIsoDate(matchParts.data),
    item: matchParts.item,
    codigo: matchParts.codigo,
    descricao: descricaoLegivel,
    quantidade,
    valorUnitario,
    valorTotal,
    instrucaoCobranca,
    notaFiscal: matchParts.notaFiscal,
    serie: matchParts.serie,
    tipoManifesto: inferTipo(instrucaoCobranca, valorTotal),
    clienteCodigo: cliente.codigo,
    clienteNome: cliente.nome,
    blocoCliente,
  };
}

function productKey(item: RomaneioPdfProduto) {
  // O cliente faz parte da identidade da linha. Isso evita que duas vendas
  // legítimas com os mesmos dados de item/NF, mas para clientes diferentes,
  // sejam colapsadas durante a leitura do PDF. Vários produtos do mesmo cliente
  // continuam sendo preservados individualmente pelo item/código do produto.
  return [
    digits(item.clienteCodigo),
    item.romaneio,
    item.item,
    item.codigo,
    item.notaFiscal,
    item.serie,
    item.blocoCliente,
    item.quantidade,
    item.valorUnitario,
    item.valorTotal,
  ].join("|");
}


/**
 * Identidade física de uma linha impressa no romaneio. Diferente de productKey,
 * ela inclui o bloco CLIENTE porque cada ocorrência de CLIENTE no PDF é
 * independente. Assim, duas linhas idênticas em blocos diferentes continuam
 * sendo lançamentos separados, enquanto duplicatas da mesma linha/bloco são removidas.
 */
function printedLineKey(item: RomaneioPdfProduto) {
  return [
    digits(item.clienteCodigo),
    item.blocoCliente,
    item.romaneio,
    item.item,
    item.codigo,
    item.notaFiscal,
    item.serie,
    item.quantidade,
    item.valorUnitario,
    item.valorTotal,
  ].join("|");
}

function physicalLineKey(item: RomaneioPdfProduto) {
  // Chave física da linha impressa. Não usa quantidade/valores/romaneio porque
  // justamente esses campos podem ser corrompidos pelo OCR. O bloco CLIENTE +
  // item + produto + NF/série é estável e continua preservando ocorrências
  // legítimas repetidas em blocos diferentes do mesmo cliente.
  return [
    digits(item.clienteCodigo),
    item.blocoCliente,
    item.item,
    item.codigo,
    item.notaFiscal,
    item.serie,
  ].join("|");
}

function digitEditDistance(left: string, right: string) {
  if (left === right) return 0;
  if (Math.abs(left.length - right.length) > 1) return 2;

  if (left.length === right.length) {
    let differences = 0;
    for (let index = 0; index < left.length; index += 1) {
      if (left[index] !== right[index]) differences += 1;
      if (differences > 1) return differences;
    }
    return differences;
  }

  const longer = left.length > right.length ? left : right;
  const shorter = left.length > right.length ? right : left;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < longer.length && j < shorter.length) {
    if (longer[i] === shorter[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    i += 1;
    if (edits > 1) return edits;
  }
  if (i < longer.length) edits += 1;
  return edits;
}

function repairOcrRomaneioNumbers(produtos: RomaneioPdfProduto[]) {
  const counts = new Map<string, number>();
  for (const item of produtos) {
    counts.set(item.romaneio, (counts.get(item.romaneio) ?? 0) + 1);
  }

  const trusted = Array.from(counts.entries())
    .filter(([value, count]) => /^\d{6}$/.test(value) && count >= 2)
    .sort((left, right) => right[1] - left[1]);

  for (const item of produtos) {
    const ownCount = counts.get(item.romaneio) ?? 0;
    const candidates = trusted.filter(([candidate, candidateCount]) =>
      candidate !== item.romaneio &&
      (candidateCount > ownCount || (item.romaneio.length !== 6 && candidateCount >= ownCount)) &&
      digitEditDistance(item.romaneio, candidate) <= 1
    );
    if (!candidates.length) continue;

    const bestCount = candidates[0][1];
    const best = candidates.filter((candidate) => candidate[1] === bestCount);
    if (best.length === 1) item.romaneio = best[0][0];
  }
}

function repairOcrProductCodesByFamily(items: RomaneioPdfProduto[]) {
  // Primeiro corrige códigos OCR com um caractere extra usando outros códigos
  // de 5 dígitos já lidos no mesmo documento. Ex.: 0030B8 -> 003088 contém
  // 00308; O0O308 -> 000308 também contém 00308.
  const trustedFiveDigitCodes = Array.from(new Set(
    items
      .map((item) => repairOcrNumericToken(item.codigo).replace(/\D/g, ""))
      .filter((code) => /^\d{5}$/.test(code)),
  ));
  for (const item of items) {
    const current = repairOcrNumericToken(item.codigo).replace(/\D/g, "");
    if (current.length <= 5 || current.length > 8 || !trustedFiveDigitCodes.length) continue;
    const matches = trustedFiveDigitCodes.filter((trusted) => current.includes(trusted));
    if (matches.length === 1) item.codigo = matches[0];
  }

  const byFamily = new Map<string, RomaneioPdfProduto[]>();
  for (const item of items) {
    const family = hybridProductFamily(item.descricao);
    if (!family) continue;
    const group = byFamily.get(family) ?? [];
    group.push(item);
    byFamily.set(family, group);
  }

  for (const group of byFamily.values()) {
    if (group.length < 2) continue;
    const counts = new Map<string, number>();
    for (const item of group) {
      const code = repairOcrNumericToken(item.codigo).replace(/\D/g, "");
      if (code.length < 4 || code.length > 8) continue;
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }

    const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].length - b[0].length);
    const [trustedCode, trustedCount] = ranked[0] ?? [];
    if (!trustedCode || !trustedCount || trustedCount < 2) continue;

    for (const item of group) {
      const current = repairOcrNumericToken(item.codigo).replace(/\D/g, "");
      if (!current) continue;
      if (
        current === trustedCode ||
        current.endsWith(trustedCode) ||
        trustedCode.endsWith(current) ||
        digitEditDistance(current, trustedCode) <= 1
      ) {
        item.codigo = trustedCode;
      }
    }
  }
}

function hasEmbeddedRecordBoundary(value: string) {
  const normalized = normalizeOcrDigits(value);
  return (
    /CLIENTE\s*[:;]/i.test(normalized) ||
    /\d{5,8}\s+\d{2}\/\d{2}\/\d{2}\s+[0-9OQIl]{2}\s+\d{4,10}-/i.test(normalized)
  );
}

/**
 * Recuperação conservadora para VASILHAME. Estes itens têm uma assinatura muito
 * forte no documento (valor unitário e total 0,00). Se o OCR quebrar colunas,
 * ainda conseguimos preservar a linha sem herdar preço do produto seguinte.
 */
function parseLooseVasilhameLine(
  line: string,
  cliente: RomaneioPdfCliente,
  blocoCliente = 0,
): RomaneioPdfProduto | null {
  const normalized = normalizeOcrDigits(line).replace(/\s+/g, " ").trim();
  // Aceita as variações reais observadas no OCR: VASILEAME, "oo" no unitário,
  // "00" no total e quantidades com 1 a 3 casas decimais.
  const visualMatch = normalized.match(
    /^(\d{5,8})\s+(\d{2}\/\d{2}\/\d{2})\s+([0-9OQIl]{2})\s+(\d{4,10})-([^\n]*?VASI[^\n]*?AME[^\n]*?)\s+([\d.]+,\d{1,3})\s+(?:0(?:,0{1,3})?|00|[oO]{1,3})\s+(?:0(?:,0{1,3})?|00|[oO]{1,3})\s+(.*?)\s+(\d{5,9})\/(\d{2,4})(?:\s|$)/i,
  );

  const compact = compactLine(normalized);
  const compactMatch = compact.match(
    /^(\d{5,8})(\d{2}\/\d{2}\/\d{2})([0-9OQIl]{2})(\d{4,10})-(.*?VASI.*?AME.*?)([\d.]+,\d{1,3})(?:0,00|0,0|00|0|OO|oo)(?:0,00|0,0|00|0|OO|oo)(.*?)(\d{5,9})\/(\d{2,4})(?:CLIENTE|\d{5,8}|$)/i,
  );
  const match = visualMatch ?? compactMatch;
  if (!match) return null;

  const description = humanizeProduct(match[5]);
  if (!isVasilhameDescription(description) || hasEmbeddedRecordBoundary(description)) return null;
  const instruction = humanizeInstruction(match[7], 0);

  return {
    romaneio: match[1],
    data: toIsoDate(match[2]),
    item: match[3].replace(/[OQ]/gi, "0").replace(/[Il]/g, "1"),
    codigo: match[4],
    descricao: description.replace(/VASILEAME/gi, "VASILHAME"),
    quantidade: parseBrazilianNumber(match[6]),
    valorUnitario: 0,
    valorTotal: 0,
    instrucaoCobranca: instruction,
    notaFiscal: match[8],
    serie: match[9],
    tipoManifesto: inferTipo(instruction, 0),
    clienteCodigo: cliente.codigo,
    clienteNome: cliente.nome,
    blocoCliente,
  };
}

function parseClientsFromDocument(text: string) {
  const sections = text.split(/(?=C\s*L\s*I\s*E\s*N\s*T\s*E\s*[:;]?)/i);
  const clients: RomaneioPdfCliente[] = [];
  for (const section of sections) {
    const client = parseClientLine(section);
    if (client && !clients.some((item) => digits(item.codigo) === digits(client.codigo))) {
      clients.push(client);
    }
  }
  return clients;
}

/**
 * Alguns builds do PDF.js entregam o mesmo PDF sem as quebras de linha/colunas
 * usadas na impressão. Este fallback interpreta um fluxo totalmente compacto,
 * delimitando cada cliente e cada início de item pelos campos fixos do romaneio.
 */
function parseCompactDocument(
  text: string,
  knownClients: RomaneioPdfCliente[],
): RomaneioPdfProduto[] {
  const compact = compactLine(normalizeOcrDigits(text));
  const sections = compact.split(/(?=CLIENTE[:;]?\d+\/\d+-)/i).filter((section) =>
    /^CLIENTE[:;]?\d+\/\d+-/i.test(section),
  );
  const result: RomaneioPdfProduto[] = [];
  const itemBoundary = /(?:^|\d{5,9}\/\d{3})(\d{5,8})(?=\d{2}\/\d{2}\/\d{2}\d{2}\d{4,10}-)/g;

  for (const [sectionIndex, section] of sections.entries()) {
    const header = section.match(
      /^CLIENTE[:;]?(\d+\/\d+)-(.+?)(?=\d{5,8}\d{2}\/\d{2}\/\d{2}\d{2}\d{4,10}-)/i,
    );
    if (!header) continue;

    const code = header[1];
    const known = knownClients.find((client) => digits(client.codigo) === digits(code));
    const client = known ?? {
      codigo: code,
      nome: humanizeProduct(header[2]),
    };
    const payload = section.slice(header[0].length);
    const starts = Array.from(payload.matchAll(itemBoundary), (match) =>
      match.index + match[0].length - match[1].length,
    );
    const candidates = starts.map((start, index) =>
      payload.slice(start, starts[index + 1] ?? payload.length),
    );

    for (const candidate of candidates) {
      const product = parseProductLine(candidate, client, sectionIndex + 1);
      if (product && !result.some((item) => productKey(item) === productKey(product))) {
        result.push(product);
      }
    }
  }

  return result;
}


/**
 * Último fallback para ROMANEIO DE FRETE do SIGA.
 *
 * Não depende de espaços nem de quebras de linha. O texto inteiro é compactado
 * e reconstruído pelos marcadores estruturais do relatório. Os números de
 * romaneio impressos pelo SIGA neste layout têm 6 dígitos; usar exatamente 6
 * aqui é importante para não confundir os últimos dígitos da Série (ex. /004)
 * com o começo do romaneio seguinte.
 */
function parseSigaCompactStream(
  rawText: string,
): { clientes: RomaneioPdfCliente[]; produtos: RomaneioPdfProduto[] } {
  const compact = compactLine(
    normalizeOcrDigits(
      repairGlyphSpacedText(
        rawText
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, ""),
      ),
    ),
  );

  const clientes: RomaneioPdfCliente[] = [];
  const produtos: RomaneioPdfProduto[] = [];

  const clientRegex = /CLIENTE[:;]?(\d{4,10}\/\d{2})-/gi;
  const clientMatches = Array.from(compact.matchAll(clientRegex));

  // Exatamente 6 dígitos: evita falso início em "...059544/00417459420/07..."
  // onde um regex 5-8 dígitos podia ler "04174594" como romaneio.
  const productRegex =
    /(\d{6})(\d{2}\/\d{2}\/\d{2})([0-9OQIl]{2})(\d{4,10})-/gi;

  for (let clientIndex = 0; clientIndex < clientMatches.length; clientIndex += 1) {
    const clientMatch = clientMatches[clientIndex];
    if (clientMatch.index == null) continue;

    const sectionStart = clientMatch.index + clientMatch[0].length;
    const sectionEnd =
      clientMatches[clientIndex + 1]?.index ?? compact.length;
    let section = compact.slice(sectionStart, sectionEnd);

    const resumoIndex = section.search(/RESUMO/i);
    if (resumoIndex >= 0) section = section.slice(0, resumoIndex);
    if (!section) continue;

    const productMatches = Array.from(section.matchAll(productRegex));
    if (!productMatches.length) continue;

    const firstProduct = productMatches[0];
    const clientName = humanizeProduct(
      section.slice(0, firstProduct.index ?? 0),
    );

    const client: RomaneioPdfCliente = {
      codigo: clientMatch[1],
      nome: clientName,
    };

    if (
      !clientes.some(
        (existing) => digits(existing.codigo) === digits(client.codigo),
      )
    ) {
      clientes.push(client);
    }

    for (let productIndex = 0; productIndex < productMatches.length; productIndex += 1) {
      const match = productMatches[productIndex];
      if (match.index == null) continue;

      const payloadStart = match.index + match[0].length;
      const payloadEnd =
        productMatches[productIndex + 1]?.index ?? section.length;
      const payload = section.slice(payloadStart, payloadEnd);

      const nfMatch = payload.match(/(\d{5,9})\/(\d{3})$/);
      if (!nfMatch || nfMatch.index == null) continue;

      const beforeNf = payload.slice(0, nfMatch.index);

      const instructionMatch = beforeNf.match(
        /(Receberc\/Cliente|InclusoNF-?Acertarc\/Lebrinha|Bonificacao-?Acertarc\/Lebrinha|--x--)$/i,
      );
      if (!instructionMatch || instructionMatch.index == null) continue;

      const instruction = instructionMatch[1];
      const numericPart = beforeNf.slice(0, instructionMatch.index);
      const numericTail = splitCompactNumericTail(numericPart);
      if (!numericTail) continue;

      const descricao = humanizeProduct(numericTail.description);
      const ehVasilhame = isVasilhameDescription(descricao);
      let quantidade = parseBrazilianNumber(numericTail.quantityText);
      const unitarioLido = parseBrazilianNumber(numericTail.unitText);
      const totalLido = parseBrazilianNumber(numericTail.totalText);

      if (!ehVasilhame && unitarioLido > 0 && totalLido > 0) {
        if (Math.abs(quantidade * unitarioLido - totalLido) > 0.06) {
          const inferida =
            Math.round((totalLido / unitarioLido) * 100) / 100;
          if (
            inferida <= 0 ||
            inferida > 10000 ||
            Math.abs(inferida * unitarioLido - totalLido) > 0.06
          ) {
            continue;
          }
          quantidade = inferida;
        }
      }

      const valorUnitario = ehVasilhame ? 0 : unitarioLido;
      const valorTotal = ehVasilhame ? 0 : totalLido;
      const instrucaoCobranca = humanizeInstruction(instruction, valorTotal);

      const product: RomaneioPdfProduto = {
        romaneio: match[1],
        data: toIsoDate(match[2]),
        item: match[3]
          .replace(/[OQ]/gi, "0")
          .replace(/[Il]/g, "1"),
        codigo: match[4],
        descricao,
        quantidade,
        valorUnitario,
        valorTotal,
        instrucaoCobranca,
        notaFiscal: nfMatch[1],
        serie: nfMatch[2],
        tipoManifesto: inferTipo(instrucaoCobranca, valorTotal),
        clienteCodigo: client.codigo,
        clienteNome: client.nome,
        blocoCliente: clientIndex + 1,
      };

      if (
        !produtos.some(
          (existing) => printedLineKey(existing) === printedLineKey(product),
        )
      ) {
        produtos.push(product);
      }
    }
  }

  return { clientes, produtos };
}


const RADASA_DIGITAL_TEXT_MARKER = "[[RADASA_DIGITAL_TEXT]]";
const RADASA_OCR_TEXT_MARKER = "[[RADASA_OCR_TEXT]]";

type HybridSupportRow = {
  quantidade: number;
  valorUnitario: number | null;
  valorTotal: number | null;
  notaFiscal: string;
  serie: string;
  instrucaoCobranca: string;
};

type LooseOcrProduct = {
  cliente: RomaneioPdfCliente;
  blocoCliente: number;
  romaneio: string;
  data: string;
  item: string;
  codigo: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number | null;
  valorTotal: number | null;
  instrucaoCobranca: string;
  notaFiscal: string;
  serie: string;
};

function splitHybridPdfSources(rawText: string) {
  if (!rawText.includes(RADASA_DIGITAL_TEXT_MARKER) || !rawText.includes(RADASA_OCR_TEXT_MARKER)) {
    return null;
  }

  const digital: string[] = [];
  const ocr: string[] = [];
  const regex = /\[\[RADASA_(DIGITAL|OCR)_TEXT\]\]\s*([\s\S]*?)(?=\[\[RADASA_(?:DIGITAL|OCR)_TEXT\]\]|$)/g;
  for (const match of rawText.matchAll(regex)) {
    if (match[1] === "DIGITAL") digital.push(match[2].trim());
    else ocr.push(match[2].trim());
  }

  return {
    digital: digital.filter(Boolean).join("\n"),
    ocr: ocr.filter(Boolean).join("\n"),
  };
}

/**
 * Converte somente trechos que deveriam ser numéricos. Não aplicamos isso ao
 * texto inteiro porque letras como S/G/T são legítimas em nomes de produtos.
 */
function repairOcrNumericToken(value: string) {
  return value
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[OQD]/g, "0")
    .replace(/[IL|]/g, "1")
    .replace(/Z/g, "2")
    .replace(/S/g, "5")
    .replace(/G/g, "6")
    .replace(/T/g, "7")
    .replace(/B/g, "8")
    .replace(/[^0-9.,/]/g, "");
}

function parseOcrBrazilianNumber(value: string) {
  const repaired = repairOcrNumericToken(value)
    .replace(/,(?=\d{3}(?:,|$))/g, ".")
    .replace(/(\d)\.(?=\d{2}$)/, "$1,");
  return parseBrazilianNumber(repaired);
}

function normalizeHybridDescription(value: string) {
  let description = humanizeProduct(value)
    .replace(/[|¦]/g, "I")
    .replace(/\b20\s+LI\b/gi, "20 LT")
    .replace(/\bGARRAF[ÃA]O\b/gi, "GARRAFAO")
    .replace(/\s+/g, " ")
    .trim();

  const n = normalize(description);
  if (/VASI[A-Z0-9]{0,8}(?:LH|LE)[A-Z0-9]{0,5}AME/.test(n) || n.includes("VASILHAME")) {
    description = description.replace(/VASI\S*AME/gi, "VASILHAME");
  }
  return description;
}

function hybridProductFamily(value: string) {
  const n = normalize(value);
  if (n.includes("VASI") && (n.includes("20L") || n.includes("20LT"))) return "VASILHAME20L";
  if ((n.includes("GARR") || n.includes("GARA")) && (n.includes("20L") || n.includes("20LT"))) {
    return "GARRAFAO20L";
  }
  return n;
}

function humanizeLooseInstruction(value: string, total: number) {
  const n = normalize(value);
  if ((n.includes("CLIENTE") && (n.includes("RECEB") || n.includes("RECEH"))) || n.includes("RECEBERCCLIENTE")) {
    return "Receber c/ Cliente";
  }
  if (
    n.includes("LEBRINHA") &&
    (n.includes("ACERT") || n.includes("INCLUS") || n.includes("INCLUG"))
  ) {
    return "Incluso NF - Acertar c/ Lebrinha";
  }
  return humanizeInstruction(value, total);
}

function parseLooseOcrClient(line: string): RomaneioPdfCliente | null {
  const match = line.match(/CLIENTE\s*[:;o]?\s*(.*?)\s*-\s*(.+)$/i);
  if (!match) return null;

  const rawCode = match[1].replace(/\s+/g, "");
  const codeCandidate = rawCode.match(/(.{4,18})\/\s*(.{1,5})/i);
  let codigo = "";
  if (codeCandidate) {
    // Aceita ruídos visuais dentro do código (ex.: 001]J833/01). O campo é
    // numérico no SIGA, então somente aqui podemos eliminar/reparar letras sem
    // risco de alterar o nome do cliente.
    const left = repairOcrNumericToken(codeCandidate[1]).replace(/\D/g, "");
    const right = repairOcrNumericToken(codeCandidate[2]).replace(/\D/g, "");
    if (left.length >= 4 && right.length >= 1) {
      const normalizedLeft = left.length > 6 ? left.slice(-6) : left;
      codigo = `${normalizedLeft}/${right.padEnd(2, "0").slice(0, 2)}`;
    }
  }

  const nome = match[2]
    .replace(/\s+/g, " ")
    .replace(/^[^A-ZÀ-Ü0-9]+/i, "")
    .trim();
  if (!nome) return null;
  return { codigo, nome };
}

function parseLooseOcrProductLine(
  line: string,
  cliente: RomaneioPdfCliente,
  blocoCliente: number,
): LooseOcrProduct | null {
  const normalizedLine = line.replace(/\t/g, " ").replace(/\s+/g, " ").trim();
  const prefix = normalizedLine.match(
    /^([A-Z0-9]{5,8})\s+([A-Z0-9'.,/-]{6,14})\s+([A-Z0-9]{2})\s+([A-Z0-9]{4,12})-(.+)$/i,
  );
  if (!prefix) return null;

  const romaneioDigits = repairOcrNumericToken(prefix[1]).replace(/\D/g, "");
  const dateDigits = repairOcrNumericToken(prefix[2]).replace(/[^0-9/]/g, "");
  const dateMatch = dateDigits.match(/^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/);
  const itemDigits = repairOcrNumericToken(prefix[3]).replace(/\D/g, "");
  if (romaneioDigits.length < 5 || !dateMatch || itemDigits.length < 1) return null;

  const remainder = prefix[5];
  const quantityRegex = /[0-9OQILDSBGTZ.]+\s*,\s*[0-9OQILDSBGTZ]{1,3}/gi;
  const quantityMatch = quantityRegex.exec(remainder);
  if (!quantityMatch || quantityMatch.index == null) return null;

  const descricao = normalizeHybridDescription(remainder.slice(0, quantityMatch.index).trim());
  if (!descricao || !/[A-ZÀ-Ü]/i.test(descricao)) return null;

  const quantidade = parseOcrBrazilianNumber(quantityMatch[0]);
  if (!(quantidade > 0) || quantidade > 100000) return null;

  const afterQuantity = remainder.slice(quantityMatch.index + quantityMatch[0].length);
  // Depois da quantidade, as duas próximas colunas monetárias do SIGA são
  // sempre Prc.Unit e Tot.Frete. A implementação anterior usava o MAIOR
  // número encontrado depois da quantidade; isso podia promover um valor
  // incorreto do texto digital/OCR a total e gerar somas absurdas (ex. R$ 233 mil).
  // Preservamos a ordem física das colunas e validamos pela multiplicação.
  const numericCandidates = Array.from(
    afterQuantity.matchAll(/[0-9OQILDSBGTZ.]+\s*,\s*[0-9OQILDSBGTZ]{1,3}/gi),
    (match) => parseOcrBrazilianNumber(match[0]),
  ).filter((value) => Number.isFinite(value) && value >= 0);
  let valorUnitario: number | null = numericCandidates[0] ?? null;
  let valorTotal: number | null = numericCandidates[1] ?? null;

  // Alguns OCRs perdem a vírgula do unitário, mas preservam o total. Se houver
  // apenas um valor monetário, tratamos esse valor como total e só inferimos o
  // unitário quando Qtde × Unitário fecha em centavos.
  if (numericCandidates.length === 1) {
    valorTotal = numericCandidates[0];
    valorUnitario = null;
  }

  if (valorUnitario != null && valorTotal != null && quantidade > 0) {
    const expected = quantidade * valorUnitario;
    const tolerance = Math.max(0.08, Math.abs(valorTotal) * 0.0025);
    if (Math.abs(expected - valorTotal) > tolerance) {
      const inferredUnit = Math.round((valorTotal / quantidade) * 100) / 100;
      if (Math.abs(quantidade * inferredUnit - valorTotal) <= tolerance) {
        valorUnitario = inferredUnit;
      }
    }
  }

  let notaFiscal = "";
  let serie = "";
  const nfMatch =
    afterQuantity.match(/([0-9OQILDSBGTZ]{5,9})\s*\/\s*([0-9OQILDSBGTZ]{3,4})\s*$/i) ??
    afterQuantity.match(/([A-Z0-9§|]{4,14})\s*\/\s*([A-Z0-9]{3,4})\s*$/i);
  if (nfMatch) {
    const nfRaw = nfMatch[1];
    const nfDigits = repairOcrNumericToken(nfRaw).replace(/\D/g, "");
    const serieDigits = repairOcrNumericToken(nfMatch[2]).replace(/\D/g, "");
    // No OCR completo podem aparecer 1 ou 2 caracteres espúrios colados à
    // NF (ex.: "a060630"). Como este trecho está imediatamente antes de /SÉRIE,
    // aceitamos a versão reparada desde que ainda tenha tamanho plausível.
    const nfNoise = nfRaw.replace(/[0-9OQDIL|ZSBGT]/gi, "").length;
    if (nfDigits.length >= 5 && nfDigits.length <= 9 && nfNoise <= 2) notaFiscal = nfDigits;
    if (serieDigits.length >= 2) serie = serieDigits.padStart(3, "0").slice(-3);
  }

  const totalForInstruction = valorTotal ?? 0;
  const instrucaoCobranca = humanizeLooseInstruction(afterQuantity, totalForInstruction);

  return {
    cliente,
    blocoCliente,
    romaneio: romaneioDigits,
    data: toIsoDate(`${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}`),
    item: itemDigits.padStart(2, "0").slice(-2),
    codigo: prefix[4].replace(/[^A-Z0-9]/gi, "").toUpperCase(),
    descricao,
    quantidade,
    valorUnitario,
    valorTotal,
    instrucaoCobranca,
    notaFiscal,
    serie,
  };
}

function parseLooseOcrDocument(text: string) {
  const clientes: RomaneioPdfCliente[] = [];
  const produtos: LooseOcrProduct[] = [];
  const lines = text.replace(/\r/g, "").split("\n").map((line) => line.trim()).filter(Boolean);
  let currentClient: RomaneioPdfCliente | null = null;
  let block = 0;

  for (const line of lines) {
    const client = parseLooseOcrClient(line);
    if (client) {
      currentClient = client;
      block += 1;
      if (!clientes.some((existing) =>
        (client.codigo && digits(existing.codigo) === digits(client.codigo)) ||
        normalize(existing.nome) === normalize(client.nome)
      )) {
        clientes.push(client);
      }
      continue;
    }
    if (!currentClient) continue;
    const product = parseLooseOcrProductLine(line, currentClient, block);
    if (product) produtos.push(product);
  }

  return { clientes, produtos };
}

function convertLooseOcrProducts(produtos: LooseOcrProduct[]): RomaneioPdfProduto[] {
  return produtos.map((product) => {
    const ehVasilhame = isVasilhameDescription(product.descricao);
    let valorUnitario = ehVasilhame ? 0 : (product.valorUnitario ?? 0);
    let valorTotal = ehVasilhame ? 0 : (product.valorTotal ?? 0);

    if (!ehVasilhame && product.quantidade > 0) {
      if (valorTotal > 0 && !(valorUnitario > 0)) {
        valorUnitario = Math.round((valorTotal / product.quantidade) * 100) / 100;
      } else if (!(valorTotal > 0) && valorUnitario > 0) {
        valorTotal = Math.round(product.quantidade * valorUnitario * 100) / 100;
      } else if (valorTotal > 0 && valorUnitario > 0) {
        const expected = product.quantidade * valorUnitario;
        const tolerance = Math.max(0.08, Math.abs(valorTotal) * 0.0025);
        if (Math.abs(expected - valorTotal) > tolerance) {
          // Em OCR-primary, quantidade e total são as colunas mais estáveis.
          // Um unitário incoerente é reconstruído apenas quando fecha em centavos.
          const inferredUnit = Math.round((valorTotal / product.quantidade) * 100) / 100;
          if (Math.abs(product.quantidade * inferredUnit - valorTotal) <= tolerance) {
            valorUnitario = inferredUnit;
          }
        }
      }
    }

    const instrucaoCobranca = humanizeLooseInstruction(product.instrucaoCobranca, valorTotal);
    return {
      romaneio: product.romaneio,
      data: product.data,
      item: product.item,
      codigo: product.codigo,
      descricao: product.descricao,
      quantidade: product.quantidade,
      valorUnitario: ehVasilhame ? 0 : valorUnitario,
      valorTotal: ehVasilhame ? 0 : valorTotal,
      instrucaoCobranca,
      notaFiscal: product.notaFiscal,
      serie: product.serie,
      tipoManifesto: inferTipo(instrucaoCobranca, ehVasilhame ? 0 : valorTotal),
      clienteCodigo: product.cliente.codigo,
      clienteNome: product.cliente.nome,
      blocoCliente: product.blocoCliente,
    };
  });
}

function parseDigitalSupportRows(text: string): HybridSupportRow[] {
  const rows: HybridSupportRow[] = [];
  const lines = text.replace(/\r/g, "").split("\n").map((line) => line.trim()).filter(Boolean);

  for (const rawLine of lines) {
    const line = rawLine
      // PDF.js às vezes representa 7.157,60 como "7,157, 60".
      .replace(/(\d{1,3}),(\d{3}),\s*(\d{2})/g, "$1.$2,$3")
      .replace(/(\d)\s*,\s*(\d{2})/g, "$1,$2");

    const nfMatch = line.match(/([0-9OQILDSBGTZ§]{4,12})\s*\/\s*([0-9OQILDSBGTZ]{3,4})\s*$/i);
    if (!nfMatch || nfMatch.index == null) continue;

    const beforeNf = line.slice(0, nfMatch.index);
    const decimalMatches = Array.from(
      beforeNf.matchAll(/(?:\d{1,3}(?:\.\d{3})*|\d+)\s*,\s*\d{2}/g),
    );
    if (!decimalMatches.length) continue;

    let quantidade = 0;
    let valorUnitario: number | null = null;
    let valorTotal: number | null = null;

    if (decimalMatches.length >= 3) {
      // As TRÊS ÚLTIMAS colunas decimais antes da cobrança/NF são
      // Qtde / Prc.Unit / Tot.Frete. Não usamos o primeiro número da linha,
      // pois ele pode ser o próprio romaneio (175513), data, item ou código.
      const [q, u, t] = decimalMatches.slice(-3);
      quantidade = parseBrazilianNumber(q[0]);
      valorUnitario = parseBrazilianNumber(u[0]);
      valorTotal = parseBrazilianNumber(t[0]);
    } else if (decimalMatches.length === 2) {
      const [first, second] = decimalMatches;
      const firstValue = parseBrazilianNumber(first[0]);
      const secondValue = parseBrazilianNumber(second[0]);
      const prefix = beforeNf.slice(0, first.index ?? 0).trim();
      const integerBefore = prefix.match(/(?:^|\s)(\d{1,6})\s*$/);
      const integerQuantity = integerBefore ? Number(integerBefore[1]) : 0;

      // Ex.: "920 7,78 7.157,60" -> 920 / 7,78 / 7.157,60.
      // Só aceitamos essa reconstrução quando a multiplicação fecha.
      if (integerQuantity > 0) {
        const tolerance = Math.max(0.08, Math.abs(secondValue) * 0.0025);
        if (Math.abs(integerQuantity * firstValue - secondValue) <= tolerance) {
          quantidade = integerQuantity;
          valorUnitario = firstValue;
          valorTotal = secondValue;
        }
      }

      // Ex.: "80,00 622,40" quando o PDF perdeu visualmente a coluna do
      // unitário. Mantemos quantidade/total e deixamos o unitário nulo; o OCR
      // visual é quem deve fornecer o preço, sem inventar valor pelo texto.
      if (!(quantidade > 0)) {
        quantidade = firstValue;
        valorTotal = secondValue;
      }
    } else {
      // Uma única coluna decimal não é suficiente para reconstruir com
      // segurança quantidade/preço/total. Ignoramos essa linha de apoio.
      continue;
    }

    if (!(quantidade > 0) || quantidade > 100000) continue;

    const nfRaw = nfMatch[1];
    const nfDigitsRaw = repairOcrNumericToken(nfRaw).replace(/\D/g, "");
    const rawWasPureDigits = /^\d+$/.test(nfRaw);
    const nfDigits = nfDigitsRaw.length === 5 && rawWasPureDigits
      ? nfDigitsRaw.padStart(6, "0")
      : nfDigitsRaw;
    const serieDigits = repairOcrNumericToken(nfMatch[2]).replace(/\D/g, "");

    rows.push({
      quantidade,
      valorUnitario,
      valorTotal,
      notaFiscal: rawWasPureDigits && nfDigits.length >= 4 && nfDigits.length <= 9 ? nfDigits : "",
      serie: serieDigits.length >= 2 ? serieDigits.padStart(3, "0").slice(-3) : "",
      instrucaoCobranca: humanizeLooseInstruction(beforeNf, valorTotal ?? 0),
    });
  }

  return rows;
}

function supportArithmeticIsValid(row: HybridSupportRow) {
  if (!(row.quantidade > 0)) return false;
  if (row.valorUnitario == null || row.valorTotal == null) return false;
  const tolerance = Math.max(0.08, Math.abs(row.valorTotal) * 0.0025);
  return Math.abs(row.quantidade * row.valorUnitario - row.valorTotal) <= tolerance;
}

function findSupportForOcrProduct(product: LooseOcrProduct, rows: HybridSupportRow[]) {
  let best: { row: HybridSupportRow; score: number } | null = null;
  for (const row of rows) {
    let score = 0;
    const quantityMatches = Math.abs(row.quantidade - product.quantidade) <= 0.01;
    if (quantityMatches) score += 6;

    // Só usamos divergência monetária como evidência negativa quando a própria
    // linha digital fecha Qtde × Unitário = Total. Linhas digitais incompletas
    // (por exemplo 146,00 4,46 sem o total 651,16) continuam úteis para NF/série.
    const arithmeticValid = supportArithmeticIsValid(row);
    if (product.valorTotal != null && row.valorTotal != null && arithmeticValid) {
      const tolerance = Math.max(0.08, Math.abs(product.valorTotal) * 0.003);
      if (Math.abs(row.valorTotal - product.valorTotal) <= tolerance) score += 5;
      else if (quantityMatches && product.valorTotal > 0 && row.valorTotal > 0) score -= 5;
    }

    if (product.notaFiscal && row.notaFiscal && product.notaFiscal === row.notaFiscal) score += 5;
    if (product.serie && row.serie && product.serie === row.serie) score += 1;
    if (arithmeticValid) score += 2;

    // Nunca pareamos apenas por posição quando a quantidade de linhas difere.
    // Uma linha digital pode sumir e deslocar todas as seguintes.
    if (score < 6) continue;
    if (!best || score > best.score) best = { row, score };
  }
  return best?.row ?? null;
}

function repairRepeatedVasilhameInvoices(items: RomaneioPdfProduto[]) {
  const groups = new Map<string, RomaneioPdfProduto[]>();
  for (const item of items) {
    if (!isVasilhameDescription(item.descricao)) continue;
    const key = [digits(item.clienteCodigo), item.romaneio, item.serie].join("|");
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const valid = group.map((item) => item.notaFiscal).filter((nf) => /^\d{6}$/.test(nf));
    const unique = Array.from(new Set(valid));
    if (unique.length !== 1) continue;
    const trusted = unique[0];
    for (const item of group) {
      if (!/^\d{6}$/.test(item.notaFiscal)) item.notaFiscal = trusted;
      else if (item.notaFiscal !== trusted && digitEditDistance(item.notaFiscal, trusted) <= 2) item.notaFiscal = trusted;
    }
  }
}

function repairSuspiciousInvoiceFromPrevious(items: RomaneioPdfProduto[]) {
  let previous: RomaneioPdfProduto | null = null;
  for (const item of items) {
    const currentDigits = digits(item.notaFiscal);
    if (previous && /^\d{6}$/.test(previous.notaFiscal) && currentDigits.length > 6 && currentDigits.length <= 9) {
      const expected = String(Number(previous.notaFiscal) + 1).padStart(6, "0");
      const matches = new Set<string>();
      const choose = (start: number, built: string) => {
        if (built.length === 6) {
          if (built === expected) matches.add(built);
          return;
        }
        const remainingNeeded = 6 - built.length;
        for (let index = start; index <= currentDigits.length - remainingNeeded; index += 1) {
          choose(index + 1, built + currentDigits[index]);
        }
      };
      choose(0, "");
      if (matches.size === 1) item.notaFiscal = expected;
    }
    if (/^\d{6}$/.test(item.notaFiscal)) previous = item;
  }
}

function repairSequentialInvoiceNumbers(items: RomaneioPdfProduto[]) {
  // Só inferimos sequência quando AS DUAS PRIMEIRAS linhas já comprovam uma
  // progressão +1. Procurar um par consecutivo em qualquer ponto do documento
  // é perigoso porque a mesma NF pode aparecer em vários produtos/clientes.
  if (items.length < 3) return;
  const first = items[0]?.notaFiscal ?? "";
  const second = items[1]?.notaFiscal ?? "";
  if (!/^\d{6}$/.test(first) || !/^\d{6}$/.test(second)) return;
  const firstNumber = Number(first);
  const secondNumber = Number(second);
  if (secondNumber !== firstNumber + 1) return;

  const base = firstNumber;
  for (let index = 2; index < items.length; index += 1) {
    const expected = base + index;
    const current = items[index].notaFiscal;
    if (/^\d{6}$/.test(current)) {
      // Se a sequência impressa deixa de ser compatível, paramos de inferir.
      if (Number(current) !== expected) break;
      continue;
    }
    items[index].notaFiscal = String(expected).padStart(6, "0");
  }
}

function parseHybridSigaDocument(rawText: string) {
  const sources = splitHybridPdfSources(rawText);
  if (!sources) return { clientes: [] as RomaneioPdfCliente[], produtos: [] as RomaneioPdfProduto[] };

  const loose = parseLooseOcrDocument(sources.ocr);
  const supportRows = parseDigitalSupportRows(sources.digital);
  if (!loose.produtos.length) {
    return { clientes: loose.clientes, produtos: [] as RomaneioPdfProduto[] };
  }

  const supportsArePositionallyAligned = supportRows.length === loose.produtos.length;

  const produtos: RomaneioPdfProduto[] = loose.produtos.map((product, index) => {
    // Posição só é considerada quando as duas fontes possuem exatamente a
    // mesma quantidade de linhas. Caso contrário, usamos apenas pareamento por
    // conteúdo (quantidade/NF/série/aritmética).
    const positionalSupport = supportsArePositionallyAligned ? supportRows[index] : null;
    const matchedSupport = findSupportForOcrProduct(product, supportRows);
    const support = positionalSupport ?? matchedSupport;
    let quantidade = product.quantidade;
    const ehVasilhame = isVasilhameDescription(product.descricao);

    let valorUnitario = 0;
    let valorTotal = 0;

    if (!ehVasilhame) {
      const ocrUnit = product.valorUnitario;
      const ocrTotal = product.valorTotal;

      // Em alguns PDFs o OCR troca 80,00 por 20,00 e, ao mesmo tempo, lê o
      // unitário como 31,12; a multiplicação continua fechando e parece válida.
      // Quando a camada digital está perfeitamente alinhada por linha, sua
      // quantidade é usada como contraprova e o total do OCR, que costuma ser
      // mais estável, reconstrói o preço unitário correto.
      if (
        positionalSupport &&
        positionalSupport.quantidade > 0 &&
        Math.abs(positionalSupport.quantidade - quantidade) > 0.01 &&
        ocrTotal != null && ocrTotal > 0
      ) {
        const inferredUnitFromDigitalQuantity = Math.round((ocrTotal / positionalSupport.quantidade) * 100) / 100;
        const tolerance = Math.max(0.08, Math.abs(ocrTotal) * 0.0025);
        if (
          inferredUnitFromDigitalQuantity > 0 &&
          Math.abs(positionalSupport.quantidade * inferredUnitFromDigitalQuantity - ocrTotal) <= tolerance
        ) {
          quantidade = positionalSupport.quantidade;
        }
      }

      if (ocrUnit != null && ocrTotal != null && quantidade > 0) {
        const tolerance = Math.max(0.08, Math.abs(ocrTotal) * 0.0025);
        if (Math.abs(quantidade * ocrUnit - ocrTotal) <= tolerance) {
          // Melhor cenário: as três colunas do OCR fecham matematicamente.
          valorUnitario = ocrUnit;
          valorTotal = ocrTotal;
        } else {
          // Quando apenas um dígito do unitário foi corrompido, o total/qtde
          // costuma reconstruir exatamente um preço de 2 casas decimais.
          const inferredUnit = Math.round((ocrTotal / quantidade) * 100) / 100;
          if (Math.abs(quantidade * inferredUnit - ocrTotal) <= tolerance) {
            valorUnitario = inferredUnit;
            valorTotal = ocrTotal;
          }
        }
      } else if (ocrTotal != null && quantidade > 0) {
        const inferredUnit = Math.round((ocrTotal / quantidade) * 100) / 100;
        const tolerance = Math.max(0.08, Math.abs(ocrTotal) * 0.0025);
        if (inferredUnit > 0 && Math.abs(quantidade * inferredUnit - ocrTotal) <= tolerance) {
          valorUnitario = inferredUnit;
          valorTotal = ocrTotal;
        }
      } else if (ocrUnit != null && ocrUnit > 0 && quantidade > 0) {
        valorUnitario = ocrUnit;
        valorTotal = Math.round(quantidade * ocrUnit * 100) / 100;
      }

      // A camada digital é SOMENTE fallback. Ela nunca substitui uma leitura
      // OCR que já fecha Qtde × Unitário = Total. E só entra quando foi
      // pareada por quantidade/NF/total, nunca pelo índice da linha.
      if (!(valorTotal > 0) && support && supportArithmeticIsValid(support)) {
        valorUnitario = support.valorUnitario ?? 0;
        valorTotal = support.valorTotal ?? 0;
      }
    }

    let notaFiscal = product.notaFiscal;
    let serie = product.serie;
    // NF/serie do OCR são preservadas quando já são numéricas e completas.
    // A camada digital só corrige campo AUSENTE/corrompido; nunca troca uma NF
    // válida apenas porque outra linha tem a mesma quantidade.
    if (support) {
      if (!/^\d{6,9}$/.test(notaFiscal) && support.notaFiscal) notaFiscal = support.notaFiscal;
      if (!/^\d{3,4}$/.test(serie) && support.serie) serie = support.serie;
    }
    if (notaFiscal.length === 5) notaFiscal = notaFiscal.padStart(6, "0");

    const productInstructionNormalized = normalize(product.instrucaoCobranca);
    const productInstructionIsKnown =
      productInstructionNormalized.includes("RECEBERCCLIENTE") ||
      productInstructionNormalized.includes("LEBRINHA") ||
      productInstructionNormalized.includes("BONIFICACAO");
    const instructionSource = !productInstructionIsKnown && support?.instrucaoCobranca
      ? support.instrucaoCobranca
      : product.instrucaoCobranca;
    const instrucaoCobranca = humanizeLooseInstruction(instructionSource, valorTotal);

    return {
      romaneio: product.romaneio,
      data: product.data,
      item: product.item,
      codigo: product.codigo,
      descricao: product.descricao,
      quantidade,
      valorUnitario: ehVasilhame ? 0 : valorUnitario,
      valorTotal: ehVasilhame ? 0 : valorTotal,
      instrucaoCobranca,
      notaFiscal,
      serie,
      tipoManifesto: inferTipo(instrucaoCobranca, ehVasilhame ? 0 : valorTotal),
      clienteCodigo: product.cliente.codigo,
      clienteNome: product.cliente.nome,
      blocoCliente: product.blocoCliente,
    };
  });

  repairSequentialInvoiceNumbers(produtos);
  return { clientes: loose.clientes, produtos };
}

export function interpretarTextoManifestoPdf(
  rawText: string,
): RomaneioPdfInterpretado {
  const ocrPrimary = rawText.includes(RADASA_OCR_PRIMARY_MARKER);
  const sourceText = rawText.replaceAll(RADASA_OCR_PRIMARY_MARKER, "");
  const text = normalizeOcrDigits(repairGlyphSpacedText(sourceText.replace(/\r/g, "")));
  if (!text.trim()) throw new Error("O PDF não possui texto legível após OCR.");

  // Alguns OCRs devolvem "CLIENTE:" colado no fim do item anterior.
  // Forçamos cada marcador CLIENTE a iniciar um novo trecho para impedir que
  // uma linha de produto atravesse a fronteira entre clientes/blocos.
  const textWithClientBoundaries = text.replace(/(?<!^)(?=CLIENTE\s*(?:[:;]|\d))/gim, "\n");
  const lines = textWithClientBoundaries.split("\n").map((line) => line.trim()).filter(Boolean);
  const compact = compactLine(text);
  const accentlessCompact = compact
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const avisos: string[] = [];

  const emissionMatch = accentlessCompact.match(
    /(?:EMISSAO|DT\.REF\.?):(\d{2}\/\d{2}\/\d{4})/i,
  );
  const dataEmissao = emissionMatch ? toIsoDate(emissionMatch[1]) : "";

  const headerMetadata = parseRomaneioHeaderMetadata(text);

  const clientes: RomaneioPdfCliente[] = [];
  const produtos: RomaneioPdfProduto[] = [];
  let currentClient: RomaneioPdfCliente | null = null;
  let currentClientBlock = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const parsedClient = parseClientLine(lines[index]);
    if (parsedClient) {
      currentClient = parsedClient;
      currentClientBlock += 1;
      if (!clientes.some((item) => digits(item.codigo) === digits(parsedClient.codigo))) {
        clientes.push(parsedClient);
      }
      continue;
    }
    if (!currentClient || normalize(lines[index]).includes("RESUMO")) continue;

    const candidateParts = [lines[index]];
    for (let offset = 1; offset <= 2; offset += 1) {
      const nextLine = lines[index + offset];
      if (!nextLine) break;
      if (parseClientLine(nextLine) || /^CLIENTE\s*[:;]/i.test(nextLine) || normalize(nextLine).includes("RESUMO")) break;
      // Nunca una duas linhas físicas de produto. Em PDFs do SIGA com colunas
      // muito próximas, uma linha isolada pode falhar no regex; juntar a linha
      // seguinte fazia a descrição do primeiro produto engolir o segundo e
      // herdar quantidade/preço/NF dele (ex.: GARRAFAO + 1500ML C/6).
      const compactNext = compactLine(normalizeOcrDigits(nextLine));
      if (/^\d{5,8}\d{2}\/\d{2}\/\d{2}[0-9OQIl]{2}\d{4,10}-/i.test(compactNext)) break;
      candidateParts.push(nextLine);
    }
    const candidates = candidateParts.map((_, candidateIndex) =>
      candidateParts.slice(0, candidateIndex + 1).join(" "),
    );
    const product = candidates
      .map((candidate) =>
        parseLooseVasilhameLine(candidate, currentClient!, currentClientBlock) ??
        parseProductLine(candidate, currentClient!, currentClientBlock),
      )
      .find(Boolean);
    if (product && !produtos.some((item) =>
      printedLineKey(item) === printedLineKey(product),
    )) {
      produtos.push(product);
    }
  }

  for (const client of parseClientsFromDocument(text)) {
    if (!clientes.some((item) => digits(item.codigo) === digits(client.codigo))) {
      clientes.push(client);
    }
  }

  const compactProducts = parseCompactDocument(text, clientes);
  let recoveredItems = 0;
  for (const product of compactProducts) {
    if (!produtos.some((item) => printedLineKey(item) === printedLineKey(product))) {
      produtos.push(product);
      recoveredItems += 1;
    }
  }

  // Fallback totalmente independente da fragmentação do PDF.js/OCR.
  const streamParsed = parseSigaCompactStream(sourceText);
  for (const client of streamParsed.clientes) {
    if (!clientes.some((item) => digits(item.codigo) === digits(client.codigo))) {
      clientes.push(client);
    }
  }
  for (const product of streamParsed.produtos) {
    if (!produtos.some((item) => printedLineKey(item) === printedLineKey(product))) {
      produtos.push(product);
      recoveredItems += 1;
    }
  }

  // Quando o navegador marca OCR_PRIMARY, todo o PDF já foi convertido para
  // imagem e reconhecido visualmente antes de chegar aqui. Nesse modo o parser
  // OCR solto é a fonte autoritativa para CLIENTE + linha de produto + valores.
  // Isso impede que uma camada digital incompleta desloque colunas e transforme
  // 653 × 5,40 em números sem relação com a linha impressa.
  if (ocrPrimary) {
    const primary = parseLooseOcrDocument(sourceText);
    if (primary.produtos.length > 0) {
      clientes.splice(0, clientes.length);
      for (const client of primary.clientes) {
        if (!clientes.some((item) =>
          (client.codigo && digits(item.codigo) === digits(client.codigo)) ||
          normalize(item.nome) === normalize(client.nome)
        )) {
          clientes.push(client);
        }
      }
      produtos.splice(0, produtos.length, ...convertLooseOcrProducts(primary.produtos));
      avisos.push(`${primary.produtos.length} item(ns) lido(s) pelo OCR completo em alta resolução.`);
    }
  }

  // PDFs híbridos do SIGA podem ter CLIENTE/produto rasterizados e
  // quantidade/total/NF na camada textual. Nessa situação juntamos as duas
  // fontes em vez de exigir que uma única extração esteja perfeita.
  const hybridParsed = ocrPrimary
    ? { clientes: [] as RomaneioPdfCliente[], produtos: [] as RomaneioPdfProduto[] }
    : parseHybridSigaDocument(rawText);
  // Quando o cliente envia as duas fontes marcadas (digital + OCR), o parser
  // híbrido já fez o pareamento e a validação aritmética. Misturar novamente
  // esses itens com o parser genérico reintroduzia duplicatas e linhas
  // corrompidas da camada digital. Portanto o híbrido é a fonte autoritativa.
  if (hybridParsed.produtos.length > 0) {
    clientes.splice(0, clientes.length);
    for (const client of hybridParsed.clientes) {
      if (!clientes.some((item) =>
        (client.codigo && digits(item.codigo) === digits(client.codigo)) ||
        normalize(item.nome) === normalize(client.nome)
      )) {
        clientes.push(client);
      }
    }
    produtos.splice(0, produtos.length, ...hybridParsed.produtos);
    avisos.push(`${hybridParsed.produtos.length} item(ns) reconstruído(s) pela leitura híbrida PDF + OCR.`);
  }

  // Corrige substituições/inserções de um único dígito quando o mesmo romaneio
  // aparece corretamente em outras linhas do documento (ex.: 275190/2175190
  // -> 175190). Isso é especialmente útil no OCR de páginas digitalizadas.
  repairOcrRomaneioNumbers(produtos);
  repairOcrProductCodesByFamily(produtos);
  repairRepeatedVasilhameInvoices(produtos);
  repairSuspiciousInvoiceFromPrevious(produtos);

  // Corrige romaneio com primeiro dígito perdido pelo OCR quando existe no mesmo
  // documento uma versão mais longa e inequívoca com o mesmo sufixo (ex.: 75646 -> 175646).
  const fullRomaneios = Array.from(new Set(produtos.map((item) => item.romaneio).filter((value) => value.length >= 6)));
  const sixDigitPrefixOne = fullRomaneios.some((value) => /^1\d{5}$/.test(value));
  for (const product of produtos) {
    if (product.romaneio.length >= 6) continue;
    const candidates = fullRomaneios.filter((value) => value.endsWith(product.romaneio));
    if (candidates.length === 1) {
      product.romaneio = candidates[0];
      continue;
    }
    // Nos relatórios SIGA deste conjunto os romaneios são 6 dígitos iniciados
    // por 1. Se o OCR-primary leu apenas 5 dígitos (75601), e o próprio PDF
    // confirma esse padrão em outras linhas, recuperamos 175601.
    if (ocrPrimary && sixDigitPrefixOne && /^\d{5}$/.test(product.romaneio)) {
      product.romaneio = `1${product.romaneio}`;
    }
  }

  // Última barreira contra duplicidade entre a leitura visual e a compacta.
  // Mantém a primeira ocorrência, isto é, a que respeita melhor a ordem do PDF.
  const uniqueProducts: RomaneioPdfProduto[] = [];
  const seenPrintedLines = new Set<string>();
  for (const product of produtos) {
    const key = physicalLineKey(product);
    if (seenPrintedLines.has(key)) continue;
    seenPrintedLines.add(key);
    uniqueProducts.push(product);
  }
  produtos.splice(0, produtos.length, ...uniqueProducts);
  if (recoveredItems > 0) {
    avisos.push(`${recoveredItems} item(ns) recuperado(s) pela leitura alternativa do PDF.`);
  }

  // O valor total do documento deve ser SEMPRE derivado dos itens que passaram
  // pela validação do parser. O OCR do RESUMO é apenas uma contraprova.
  //
  // Motivo: em PDFs SIGA com fonte pequena o Tesseract pode transformar
  // "4.935,00" em "49.350,00" (ou outra ordem de grandeza). A implementação
  // anterior aceitava qualquer TOTAL positivo do RESUMO como autoritativo e
  // substituía a soma correta dos itens, fazendo a importação em massa exibir
  // dezenas/centenas de milhares de reais mesmo com as linhas individuais
  // corretas.
  const calculatedTotal = Math.round(
    produtos.reduce((sum, produto) => sum + produto.valorTotal, 0) * 100,
  ) / 100;
  const printedSummaryTotal = parsePrintedSummaryTotal(text);
  if (printedSummaryTotal > 0) {
    const totalTolerance = Math.max(0.08, Math.abs(calculatedTotal) * 0.003);
    if (calculatedTotal > 0 && Math.abs(calculatedTotal - printedSummaryTotal) > totalTolerance) {
      avisos.push(
        `Total impresso pelo OCR (${printedSummaryTotal.toFixed(2)}) foi ignorado porque diverge da soma validada dos itens (${calculatedTotal.toFixed(2)}).`,
      );
    }
  }

  if (!dataEmissao) avisos.push("Data de emissão não identificada.");
  if (!headerMetadata.transportadoraCodigo && !headerMetadata.transportadoraNome) avisos.push("Transportadora não identificada.");
  if (!headerMetadata.placaVeiculo) avisos.push("Placa do veículo não identificada.");
  else if (!headerMetadata.modeloVeiculo) avisos.push("Modelo do veículo não identificado.");
  if (!clientes.length) avisos.push("Nenhum cliente foi identificado.");
  if (!produtos.length) avisos.push("Nenhuma linha de produto foi identificada.");

  return {
    parserVersion: ROMANEIO_PARSER_VERSION,
    dataEmissao: dataEmissao || produtos[0]?.data || "",
    transportadoraCodigo: headerMetadata.transportadoraCodigo,
    transportadoraNome: headerMetadata.transportadoraNome,
    veiculoCodigo: headerMetadata.veiculoCodigo,
    placaVeiculo: headerMetadata.placaVeiculo,
    modeloVeiculo: headerMetadata.modeloVeiculo,
    clientes,
    produtos,
    romaneios: Array.from(new Set(produtos.map((produto) => produto.romaneio))),
    notasFiscais: Array.from(new Set(produtos.map((produto) => `${produto.notaFiscal}/${produto.serie}`))),
    valorTotal: calculatedTotal > 0 ? calculatedTotal : printedSummaryTotal,
    avisos,
  };
}

type VinculoSession = {
  clientes: Awaited<ReturnType<typeof prisma.cliente.findMany>>;
  produtos: Awaited<ReturnType<typeof prisma.produto.findMany>>;
  clientesCriados: Set<string>;
  produtosCriados: Set<string>;
};

async function criarVinculoSession(): Promise<VinculoSession> {
  const [clientes, produtos] = await Promise.all([
    prisma.cliente.findMany(),
    prisma.produto.findMany(),
  ]);
  return {
    clientes,
    produtos,
    clientesCriados: new Set<string>(),
    produtosCriados: new Set<string>(),
  };
}

async function sugerirVinculosComSession(
  documento: RomaneioPdfInterpretado,
  session: VinculoSession,
) {
  const { clientes, produtos, clientesCriados, produtosCriados } = session;

  function textEditDistance(left: string, right: string) {
    const a = normalize(left);
    const b = normalize(right);
    if (a === b) return 0;
    const previous = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i += 1) {
      const current = [i];
      for (let j = 1; j <= b.length; j += 1) {
        current[j] = Math.min(
          current[j - 1] + 1,
          previous[j] + 1,
          previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
        );
      }
      previous.splice(0, previous.length, ...current);
    }
    return previous[b.length];
  }

  async function ensureCliente(pdf: RomaneioPdfCliente) {
    const code = digits(pdf.codigo);
    let cadastro = clientes.find((item) =>
      (code && digits(item.codigoInterno ?? "") === code) ||
      normalize(item.nomeFantasia ?? "") === normalize(pdf.nome),
    );
    if (!cadastro && pdf.nome) {
      const pdfName = normalize(pdf.nome);
      cadastro = clientes
        .map((item) => ({ item, distance: textEditDistance(item.nomeFantasia ?? "", pdf.nome) }))
        .filter(({ item, distance }) => {
          const dbName = normalize(item.nomeFantasia ?? "");
          const maxLen = Math.max(pdfName.length, dbName.length);
          return maxLen >= 6 && distance <= Math.max(2, Math.floor(maxLen * 0.16));
        })
        .sort((a, b) => a.distance - b.distance)[0]?.item;
    }
    if (!cadastro) {
      cadastro = await prisma.cliente.create({
        data: {
          nomeFantasia: pdf.nome,
          razaoSocial: pdf.nome,
          codigoInterno: pdf.codigo,
          cnpj: "",
          email: "",
          telefone: "",
          enderecoFiscal: "",
        },
      });
      clientes.push(cadastro);
      clientesCriados.add(cadastro.id);
    }
    return cadastro;
  }

  async function ensureProduto(pdf: RomaneioPdfProduto) {
    const code = digits(pdf.codigo);
    const nomePdf = normalize(pdf.descricao);
    let cadastro = produtos.find((item) => normalize(item.nome ?? "") === nomePdf);

    if (!cadastro) {
      const family = hybridProductFamily(pdf.descricao);
      if (family && family !== nomePdf) {
        cadastro = produtos.find((item) => hybridProductFamily(item.nome ?? "") === family);
      }
    }

    if (!cadastro && code) {
      const porCodigo = produtos.find((item) => digits(item.codigoInterno ?? "") === code);
      if (porCodigo) {
        const nomeCadastro = normalize(porCodigo.nome ?? "");
        const pdfVasilhame = nomePdf.includes("VASILHAME");
        const cadastroVasilhame = nomeCadastro.includes("VASILHAME");
        const pdfGarrafao = nomePdf.includes("GARRAFAO");
        const cadastroGarrafao = nomeCadastro.includes("GARRAFAO");
        const familiasConflitantes =
          (pdfVasilhame && cadastroGarrafao) ||
          (pdfGarrafao && cadastroVasilhame);

        if (!familiasConflitantes) cadastro = porCodigo;
      }
    }

    if (!cadastro) {
      cadastro = await prisma.produto.create({
        data: {
          nome: pdf.descricao,
          codigoInterno: pdf.codigo,
          categoriaEstoque: "Produtos de gás",
        },
      });
      produtos.push(cadastro);
      produtosCriados.add(cadastro.id);
    }
    return cadastro;
  }

  const clientesCriadosAntes = clientesCriados.size;
  const produtosCriadosAntes = produtosCriados.size;
  const clientesPorCodigo = new Map<string, Awaited<ReturnType<typeof ensureCliente>>>();

  for (const clientePdf of documento.clientes) {
    clientesPorCodigo.set(digits(clientePdf.codigo), await ensureCliente(clientePdf));
  }

  const itens = [];
  for (const produtoPdf of documento.produtos) {
    const cliente = clientesPorCodigo.get(digits(produtoPdf.clienteCodigo)) ??
      await ensureCliente({ codigo: produtoPdf.clienteCodigo, nome: produtoPdf.clienteNome });
    const cadastro = await ensureProduto(produtoPdf);

    // Depois do vínculo, o cadastro mestre é a fonte de verdade para campos
    // que o OCR pode confundir. Isso impede gravar código/nome corrompidos
    // quando cliente/produto já existem no sistema.
    if (cliente.codigoInterno) produtoPdf.clienteCodigo = cliente.codigoInterno;
    if (cliente.nomeFantasia) produtoPdf.clienteNome = cliente.nomeFantasia;
    if (cadastro.codigoInterno) produtoPdf.codigo = cadastro.codigoInterno;
    if (cadastro.nome) produtoPdf.descricao = cadastro.nome;

    itens.push({
      produto: produtoPdf,
      cliente: { ...cliente, criadoAutomaticamente: clientesCriados.has(cliente.id) },
      cadastro: { ...cadastro, criadoAutomaticamente: produtosCriados.has(cadastro.id) },
    });
  }

  return {
    cliente: itens[0]?.cliente ?? null,
    clientes: Array.from(clientesPorCodigo.values()).map((cliente) => ({
      ...cliente,
      criadoAutomaticamente: clientesCriados.has(cliente.id),
    })),
    produtos: itens,
    clientesCriados: clientesCriados.size - clientesCriadosAntes,
    produtosCriados: produtosCriados.size - produtosCriadosAntes,
  };
}

export async function sugerirVinculosManifestoPdf(documento: RomaneioPdfInterpretado) {
  const session = await criarVinculoSession();
  return sugerirVinculosComSession(documento, session);
}

/**
 * Versão em lote usada pela importação em massa. Clientes e produtos são
 * carregados uma única vez do banco e reutilizados entre todos os PDFs do lote,
 * evitando duas consultas completas às tabelas para cada arquivo.
 */
export async function sugerirVinculosManifestosPdf(documentos: RomaneioPdfInterpretado[]) {
  const session = await criarVinculoSession();
  const resultados = [];
  for (const documento of documentos) {
    resultados.push(await sugerirVinculosComSession(documento, session));
  }
  return resultados;
}

export type ManifestoPdfInterpretado = RomaneioPdfInterpretado;
export type ManifestoPdfProduto = RomaneioPdfProduto;
