import pdf from "pdf-parse";
import type { CteInterpretado } from "./cte-documento.service.js";

function cleanText(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function digits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

/** DACTEs brasileiros usam ponto para milhar e vírgula para centavos. */
function parsePdfNumber(value: string) {
  const raw = value.replace(/R\$/gi, "").replace(/\s/g, "").trim();
  if (!raw) return 0;

  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw.replace(/\./g, "");

  const parsed = Number(normalized.replace(/[^0-9+-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = match?.[1]?.trim();
    if (value) return value;
  }
  return "";
}

function isHeading(value: string) {
  const upper = normalize(value);
  return (
    !value.trim() ||
    /^(SERIE|NUMERO|MODELO|FOLHA|DATA|CNPJ|CPF|CNPJ\/CPF|IE|INSCRICAO|ENDERECO|MUNICIPIO|CEP|FONE|PAIS|TIPO|VALOR|NOME)$/.test(upper) ||
    /TP\. DOC\.|CNPJ\/CPF EMITENTE|DOCUMENTOS ORIGINARIOS/.test(upper)
  );
}

function validCnpj(value: string) {
  return digits(value).length === 14;
}

function extractCityUfPairs(value: string) {
  const pairs: Array<{ cidade: string; uf: string }> = [];
  const regex = /([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9 .'-]*?)\s*-\s*([A-Z]{2})\b/g;
  for (const match of value.matchAll(regex)) {
    const cidade = match[1].trim().replace(/^(ORIGEM|DESTINO).*?:?\s*/i, "");
    if (cidade && !isHeading(cidade)) pairs.push({ cidade, uf: match[2].toUpperCase() });
  }
  return pairs;
}

function valueNearLabel(lines: string[], label: RegExp, direction: "before" | "after", distance = 3) {
  const index = lines.findIndex((line) => label.test(normalize(line)));
  if (index < 0) return "";

  const offsets = direction === "before"
    ? Array.from({ length: distance }, (_, i) => -(i + 1))
    : Array.from({ length: distance }, (_, i) => i + 1);

  for (const offset of offsets) {
    const candidate = lines[index + offset]?.trim() ?? "";
    const match = candidate.match(/(?:R\$\s*)?([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{1,4})|[0-9]+,[0-9]{1,4}|[0-9]+)/);
    if (match?.[1]) return match[1];
  }
  return "";
}

function extractParty(lines: string[], startLabel: RegExp, endLabels: RegExp[]) {
  const start = lines.findIndex((line) => startLabel.test(normalize(line)));
  if (start < 0) {
    return { nome: "", cnpj: "", ie: "", endereco: "", cidade: "", uf: "" };
  }

  let end = Math.min(lines.length, start + 18);
  for (let i = start + 1; i < Math.min(lines.length, start + 25); i += 1) {
    if (endLabels.some((pattern) => pattern.test(normalize(lines[i])))) {
      end = i;
      break;
    }
  }

  const blockLines = lines.slice(start, end);
  const block = blockLines.join("\n");
  const firstLine = blockLines[0] ?? "";
  let nome = firstLine.replace(/^.*?:\s*/i, "").trim();
  if (!nome || nome === firstLine || isHeading(nome)) {
    nome = blockLines
      .slice(1)
      .find((line) => line.length > 3 && !isHeading(line) && !/^(ENDERECO|MUNICIPIO|CNPJ|CPF|INSC|PAIS|FONE)/i.test(normalize(line))) ?? "";
  }

  const cnpj = digits(firstMatch(block, [
    /CNPJ(?:\s*\/\s*CPF)?\s*[:\-]?\s*([0-9.\/-]{14,18})/i,
    /([0-9]{2}\.?[0-9]{3}\.?[0-9]{3}\/?[0-9]{4}-?[0-9]{2})/,
  ]));
  const ie = firstMatch(block, [/(?:INSC\.?\s*ESTADUAL|INSCRICAO\s*ESTADUAL|IE\.?)\s*[:\-]?\s*([0-9A-Z.-]+)/i]);
  const endereco = firstMatch(block, [/ENDERE[CÇ]O\s*:\s*([^\n]+)/i]);
  const cityPair = blockLines.flatMap(extractCityUfPairs)[0];

  return {
    nome: isHeading(nome) ? "" : nome,
    cnpj: validCnpj(cnpj) ? cnpj : "",
    ie,
    endereco,
    cidade: cityPair?.cidade ?? "",
    uf: cityPair?.uf ?? "",
  };
}

function extractEmitenteHeader(lines: string[]) {
  const dacteIndex = lines.findIndex((line) => /DOCUMENTO AUXILIAR DO CONHECIMENTO/i.test(line));
  const headerEnd = lines.findIndex((line) => /TIPO DO CT-?E/i.test(line));
  const end = headerEnd > 0 ? headerEnd : Math.min(lines.length, 35);
  const header = lines.slice(0, end);

  let nome = "";
  if (dacteIndex > 0) {
    for (let i = dacteIndex - 1; i >= Math.max(0, dacteIndex - 6); i -= 1) {
      const candidate = lines[i].trim();
      if (candidate.length > 3 && !isHeading(candidate) && !/^(CT-E|DACTE|MODAL|DOCUMENTO)/i.test(normalize(candidate))) {
        nome = candidate;
        break;
      }
    }
  }

  const headerText = header.join("\n");
  const cnpj = digits(firstMatch(headerText, [/CNPJ\s*:\s*([0-9.\/-]{14,18})/i]));
  const ie = firstMatch(headerText, [/(?:IE\.?|INSC\.?\s*ESTADUAL)\s*:\s*([0-9A-Z.-]+)/i]);
  const cnpjLine = header.findIndex((line) => /CNPJ\s*:/i.test(line));
  const cityPair = header.slice(0, cnpjLine >= 0 ? cnpjLine + 1 : header.length).flatMap(extractCityUfPairs).at(-1);

  const addressCandidates = header.filter((line) => {
    const upper = normalize(line);
    return /\b(AV|AVENIDA|RUA|ROD|RODOVIA|ESTRADA|BR)\b/.test(upper) || /\d{5}-?\d{3}/.test(line);
  });

  return {
    nome: isHeading(nome) ? "" : nome,
    cnpj: validCnpj(cnpj) ? cnpj : "",
    ie,
    endereco: addressCandidates.join(", "),
    cidade: cityPair?.cidade ?? "",
    uf: cityPair?.uf ?? "",
  };
}

function extractDate(text: string) {
  const raw = firstMatch(text, [
    /DATA E HORA DE EMISS[AÃ]O[\s\S]{0,80}?(\d{2}\/\d{2}\/\d{4})/i,
    /\b(\d{2}\/\d{2}\/\d{4})\s+\d{2}:\d{2}(?::\d{2})?\b/,
  ]);
  if (!raw) return "";
  const [day, month, year] = raw.split("/");
  return `${year}-${month}-${day}`;
}

export async function interpretarCtePdf(buffer: Buffer): Promise<CteInterpretado> {
  const parsed = await pdf(buffer);
  const text = cleanText(parsed.text ?? "");
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);

  if (text.length < 80) {
    throw new Error("O PDF não possui texto pesquisável. Envie o XML do CT-e ou um DACTE digital.");
  }
  if (!/CT-?E|DACTE|CONHECIMENTO DE TRANSPORTE/i.test(text)) {
    throw new Error("O PDF enviado não parece ser um DACTE/CT-e válido.");
  }

  const emitente = extractEmitenteHeader(lines);
  const remetente = extractParty(lines, /^REMETENTE\s*:/, [/^DESTINATARIO\s*:/, /^EXPEDIDOR\s*:/]);
  const destinatario = extractParty(lines, /^DESTINATARIO\s*:/, [/^EXPEDIDOR\s*:/, /^RECEBEDOR\s*:/]);
  const tomador = extractParty(lines, /^TOMADOR(?: DO SERVICO)?\s*:/, [/^PRODUTO PREDOMINANTE/, /^COMPONENTES/]);

  const chave = digits(firstMatch(text, [
    /CHAVE DE ACESSO\s*\n?\s*((?:\d[ .-]?){44})/i,
    /((?:\d[ .-]?){44})/,
  ])).slice(0, 44);

  let numero = firstMatch(text, [
    /\b57\s+(\d{3})\s+(\d{6,12})\s+\d\s+\d{2}\/\d{2}\/\d{4}/,
    /CT-?E\s*\n?\s*(\d{6,12})/i,
  ]);
  let serie = "";
  const modelRow = text.match(/\b57\s+(\d{3})\s+(\d{6,12})\s+\d\s+\d{2}\/\d{2}\/\d{4}/);
  if (modelRow) {
    serie = modelRow[1];
    numero = modelRow[2];
  }

  const prestacaoIndex = lines.findIndex((line) => /ORIGEM DA PRESTA[CÇ][AÃ]O/i.test(line));
  const routeLines = prestacaoIndex >= 0 ? lines.slice(prestacaoIndex, prestacaoIndex + 6) : lines;
  const routePairs = routeLines.flatMap(extractCityUfPairs);
  const origem = routePairs[0] ?? { cidade: "", uf: "" };
  const destino = routePairs[1] ?? { cidade: "", uf: "" };

  const produtoLabel = lines.findIndex((line) => /^PRODUTO PREDOMINANTE$/i.test(normalize(line)));
  let produto = produtoLabel > 0 ? lines[produtoLabel - 1] : "";
  if (!produto || isHeading(produto) || /^[\d.,]+$/.test(produto)) {
    produto = produtoLabel >= 0 ? (lines[produtoLabel + 1] ?? "") : "";
  }

  const valorMercadoria = parsePdfNumber(
    valueNearLabel(lines, /VALOR TOTAL DA MERCADORIA/, "before", 4) ||
    valueNearLabel(lines, /VALOR TOTAL DA MERCADORIA/, "after", 4),
  );

  const valorFrete = parsePdfNumber(
    valueNearLabel(lines, /VALOR TOTAL DO SERVICO/, "before", 4) ||
    valueNearLabel(lines, /VALOR TOTAL DA PRESTACAO/, "before", 4) ||
    firstMatch(text, [/\bFRETE\s+([0-9.]+,[0-9]{2})/i]),
  );

  const pesoRaw = firstMatch(text, [
    /PESO BRUTO\s+([0-9.]+(?:,[0-9]+)?)\s*\/\s*KG/i,
    /PESO BRUTO\s+([0-9.]+(?:,[0-9]+)?)\s*KG/i,
    /PESO TOTAL\s*\(?KG\)?\s*[:\-]?\s*([0-9.,]+)/i,
  ]);
  const pesoKg = parsePdfNumber(pesoRaw);

  if (chave.length !== 44) throw new Error("Não foi possível localizar a chave de acesso de 44 dígitos no PDF.");
  if (!validCnpj(emitente.cnpj)) throw new Error("Não foi possível identificar com segurança o CNPJ do emitente no PDF.");
  if (!emitente.nome || isHeading(emitente.nome)) throw new Error("Não foi possível identificar com segurança a razão social do emitente no PDF.");
  if (!numero) throw new Error("Não foi possível identificar o número do CT-e no PDF.");

  return {
    chave,
    numero: numero.replace(/^0+/, "") || "0",
    serie,
    emitenteCnpj: emitente.cnpj,
    emitenteNome: emitente.nome,
    emitenteNomeFantasia: "",
    emitenteInscricaoEstadual: emitente.ie,
    emitenteEndereco: emitente.endereco,
    emitenteCidade: emitente.cidade,
    emitenteUf: emitente.uf,
    remetenteCnpj: remetente.cnpj,
    remetenteNome: remetente.nome,
    destinatarioCnpj: destinatario.cnpj,
    destinatarioNome: destinatario.nome,
    destinatarioNomeFantasia: "",
    destinatarioInscricaoEstadual: destinatario.ie,
    destinatarioEndereco: destinatario.endereco,
    destinatarioCidade: destinatario.cidade,
    destinatarioUf: destinatario.uf,
    tomadorCnpj: tomador.cnpj,
    tomadorNome: tomador.nome,
    origemCidade: origem.cidade,
    origemUf: origem.uf,
    origemCodigoIbge: "",
    origemCep: "",
    destinoCidade: destino.cidade,
    destinoUf: destino.uf,
    destinoCodigoIbge: "",
    destinoCep: "",
    produto: isHeading(produto) ? "" : produto,
    ncm: firstMatch(text, [/\bNCM\s*[:\-]?\s*(\d{8})/i]),
    pesoKg,
    valorMercadoria,
    valorFrete,
    valorPedagio: parsePdfNumber(firstMatch(text, [/VALE[- ]PED[ÁA]GIO\s*[:\-]?\s*(?:R\$\s*)?([\d.,]+)/i])),
    dataEmissao: extractDate(text),
  };
}
