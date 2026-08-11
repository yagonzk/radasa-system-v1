export interface RomaneioQualityProduto {
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  descricao?: string;
  codigo?: string;
  clienteCodigo?: string;
  clienteNome?: string;
}

export interface RomaneioQualityResult {
  documento: {
    dataEmissao?: string;
    transportadoraCodigo?: string;
    transportadoraNome?: string;
    placaVeiculo?: string;
    romaneios?: string[];
    notasFiscais?: string[];
    valorTotal?: number;
    avisos?: string[];
  };
  sugestoes: {
    produtos: Array<{ produto: RomaneioQualityProduto }>;
  };
  pendencias?: string[];
}

export interface RomaneioReadQuality {
  score: number;
  productCount: number;
  candidateRows: number;
  arithmeticErrors: number;
  missingCandidateRows: number;
  totalMismatch: number;
  hasPlate: boolean;
  hasTransportadora: boolean;
  hasDate: boolean;
  reasons: string[];
}

function compactForStructure(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, "");
}

export function countLikelyProductRows(text: string) {
  const countOneSource = (value: string) => {
    const compact = compactForStructure(value);
    // Estrutura observada no SIGA/FATRU41: romaneio (6 dígitos), data,
    // item (2 posições), código do produto e hífen que inicia a descrição.
    const matches = compact.match(/\d{6}\d{2}\/\d{2}\/\d{2}[0-9OQIL]{2}\d{4,10}-/g);
    return matches?.length ?? 0;
  };

  // No texto híbrido há uma cópia DIGITAL e uma cópia OCR da mesma página.
  // Somar as duas fazia a checagem acreditar que metade dos itens estava
  // faltando. A quantidade esperada é o MAIOR número de linhas encontrado em
  // uma das fontes, não a soma das duas.
  const digitalMarker = "[[RADASA_DIGITAL_TEXT]]";
  const ocrMarker = "[[RADASA_OCR_TEXT]]";
  if (text.includes(digitalMarker) && text.includes(ocrMarker)) {
    const digitalStart = text.indexOf(digitalMarker) + digitalMarker.length;
    const ocrStart = text.indexOf(ocrMarker);
    const digital = text.slice(digitalStart, ocrStart);
    const ocr = text.slice(ocrStart + ocrMarker.length);
    return Math.max(countOneSource(digital), countOneSource(ocr));
  }

  return countOneSource(text);
}

function isVasilhame(description = "") {
  return /VASILH|VASILAME|VASILEAME/i.test(description);
}

export function analyzeRomaneioReadQuality(
  result: RomaneioQualityResult,
  sourceText: string,
): RomaneioReadQuality {
  const products = result?.sugestoes?.produtos ?? [];
  const candidateRows = countLikelyProductRows(sourceText);
  const productCount = products.length;
  let arithmeticErrors = 0;

  for (const entry of products) {
    const product = entry.produto;
    if (isVasilhame(product.descricao)) continue;
    const quantity = Number(product.quantidade) || 0;
    const unit = Number(product.valorUnitario) || 0;
    const total = Number(product.valorTotal) || 0;
    if (quantity <= 0 || unit < 0 || total < 0) {
      arithmeticErrors += 1;
      continue;
    }
    if (unit > 0 || total > 0) {
      const tolerance = Math.max(0.08, Math.abs(total) * 0.0025);
      if (Math.abs(quantity * unit - total) > tolerance) arithmeticErrors += 1;
    }
  }

  const calculatedTotal = products.reduce(
    (sum, entry) => sum + (Number(entry.produto.valorTotal) || 0),
    0,
  );
  const documentTotal = Number(result?.documento?.valorTotal) || 0;
  const totalMismatch = documentTotal > 0
    ? Math.abs(calculatedTotal - documentTotal)
    : 0;
  const totalTolerance = Math.max(0.15, Math.abs(documentTotal) * 0.003);
  const missingCandidateRows = Math.max(0, candidateRows - productCount);

  const hasPlate = Boolean(result?.documento?.placaVeiculo?.trim());
  const hasTransportadora = Boolean(
    result?.documento?.transportadoraCodigo?.trim() || result?.documento?.transportadoraNome?.trim(),
  );
  const hasDate = Boolean(result?.documento?.dataEmissao?.trim());
  const pendencias = result?.pendencias?.length ?? 0;
  const warnings = result?.documento?.avisos?.length ?? 0;

  let score = productCount * 100;
  score += Math.max(0, productCount - arithmeticErrors) * 12;
  score += hasPlate ? 35 : 0;
  score += hasTransportadora ? 25 : 0;
  score += hasDate ? 20 : 0;
  score += (result?.documento?.romaneios?.length ?? 0) > 0 ? 20 : 0;
  score += (result?.documento?.notasFiscais?.length ?? 0) > 0 ? 15 : 0;
  if (documentTotal > 0 && totalMismatch <= totalTolerance) score += 60;

  score -= arithmeticErrors * 140;
  score -= missingCandidateRows * 90;
  score -= pendencias * 25;
  score -= warnings * 5;
  if (documentTotal > 0 && totalMismatch > totalTolerance) {
    score -= Math.min(350, 80 + (totalMismatch / Math.max(1, documentTotal)) * 500);
  }

  const reasons: string[] = [];
  if (!productCount) reasons.push("nenhum item reconhecido");
  if (missingCandidateRows > 0) {
    reasons.push(`${missingCandidateRows} linha(s) provável(is) não foram convertidas em item`);
  }
  if (arithmeticErrors > 0) reasons.push(`${arithmeticErrors} item(ns) com cálculo inconsistente`);
  if (documentTotal > 0 && totalMismatch > totalTolerance) {
    reasons.push(`soma dos itens diverge do total do documento em ${totalMismatch.toFixed(2)}`);
  }
  if (!hasPlate && /PLACAVEICULO|PLACA/i.test(compactForStructure(sourceText))) {
    reasons.push("placa presente no documento, mas não reconhecida");
  }
  if (!hasTransportadora && /TRANSPORTADORA/i.test(compactForStructure(sourceText))) {
    reasons.push("transportadora presente no documento, mas não reconhecida");
  }

  return {
    score,
    productCount,
    candidateRows,
    arithmeticErrors,
    missingCandidateRows,
    totalMismatch,
    hasPlate,
    hasTransportadora,
    hasDate,
    reasons,
  };
}

export function shouldTryOcrFallback(
  result: RomaneioQualityResult,
  sourceText: string,
) {
  const quality = analyzeRomaneioReadQuality(result, sourceText);
  if (quality.productCount === 0) return true;
  if (quality.arithmeticErrors > 0) return true;
  if (quality.missingCandidateRows > 0) return true;

  const documentTotal = Number(result?.documento?.valorTotal) || 0;
  const totalTolerance = Math.max(0.15, Math.abs(documentTotal) * 0.003);
  if (documentTotal > 0 && quality.totalMismatch > totalTolerance) return true;

  const compact = compactForStructure(sourceText);
  if (!quality.hasPlate && compact.includes("PLACAVEICULO")) return true;
  if (!quality.hasTransportadora && compact.includes("TRANSPORTADORA")) return true;
  return false;
}

export function chooseBestRomaneioRead<T extends RomaneioQualityResult>(
  first: T,
  firstText: string,
  second: T,
  secondText: string,
) {
  const firstQuality = analyzeRomaneioReadQuality(first, firstText);
  const secondQuality = analyzeRomaneioReadQuality(second, secondText);

  // Se só uma leitura encontrou itens, ela vence independentemente do score.
  if (firstQuality.productCount > 0 && secondQuality.productCount === 0) {
    return { result: first, text: firstText, quality: firstQuality, source: "digital" as const };
  }
  if (secondQuality.productCount > 0 && firstQuality.productCount === 0) {
    return { result: second, text: secondText, quality: secondQuality, source: "ocr" as const };
  }

  // Empates favorecem a camada digital, porque ela preserva melhor códigos,
  // placa e pontuação quando as duas leituras são igualmente consistentes.
  if (secondQuality.score > firstQuality.score) {
    return { result: second, text: secondText, quality: secondQuality, source: "ocr" as const };
  }
  return { result: first, text: firstText, quality: firstQuality, source: "digital" as const };
}
