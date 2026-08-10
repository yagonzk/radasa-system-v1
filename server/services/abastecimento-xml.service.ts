import { XMLParser } from "fast-xml-parser";
import { prisma } from "../lib/prisma";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  parseTagValue: false,
});

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function onlyDigits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }

  return "";
}

function decimalValue(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;

  // Nos campos numéricos oficiais da NF-e o separador decimal é ponto.
  const normalized =
    raw.includes(",") && raw.includes(".")
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw.replace(",", ".");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeSearch(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findInfNfe(root: any) {
  return (
    root?.nfeProc?.NFe?.infNFe ??
    root?.NFe?.infNFe ??
    root?.infNFe ??
    null
  );
}

function joinAddress(address: any) {
  return [
    firstText(address?.xLgr),
    firstText(address?.nro),
    firstText(address?.xCpl),
    firstText(address?.xBairro),
    firstText(address?.xMun),
    firstText(address?.UF),
    onlyDigits(address?.CEP),
  ]
    .filter(Boolean)
    .join(", ");
}

function noteTexts(infNfe: any) {
  const combinedObservations = [
    ...asArray(infNfe?.infAdic?.obsCont),
    ...asArray(infNfe?.infAdic?.obsFisco),
  ].flatMap((item: any) => {
    const field = firstText(item?.["@_xCampo"]);
    const value = firstText(item?.xTexto, item?.["@_xTexto"]);

    return [
      field && value ? `${field}: ${value}` : "",
      value,
    ].filter(Boolean);
  });

  const itemNotes = asArray(infNfe?.det).flatMap((det: any) => [
    det?.infAdProd,
    det?.prod?.xProd,
  ]);

  return [
    infNfe?.infAdic?.infCpl,
    infNfe?.infAdic?.infAdFisco,
    ...combinedObservations,
    ...itemNotes,
  ]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
}

function parseOdometerCandidate(raw: string) {
  const cleaned = raw
    .trim()
    .replace(/\s/g, "")
    .replace(/[^0-9.,]/g, "");

  if (!cleaned) return null;

  let value: number;

  if (cleaned.includes(",")) {
    // Formatos brasileiros:
    // 485.869,8 -> 485869
    // 485869,8  -> 485869
    const integerPart = cleaned.split(",")[0];
    value = Number(onlyDigits(integerPart));
  } else if (cleaned.includes(".")) {
    const parts = cleaned.split(".");
    const decimalPart = parts.at(-1) ?? "";

    if (parts.length === 2 && decimalPart.length <= 2) {
      // Formato decimal usado por alguns XMLs:
      // 485869.8 -> 485869
      value = Math.trunc(Number(cleaned));
    } else {
      // Ponto como separador de milhar:
      // 485.869 -> 485869
      value = Number(onlyDigits(cleaned));
    }
  } else {
    value = Number(cleaned);
  }

  if (!Number.isFinite(value)) return null;

  // 0 e 1 são usados por vários postos como preenchimento genérico.
  if (value < 100) return null;

  // Evita aceitar valores claramente incompatíveis com odômetros de frota.
  if (value > 1_999_999) return null;

  return Math.trunc(value);
}

function normalizePlate(value: unknown) {
  return String(value ?? "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
}

function isStrictPlate(value: string) {
  return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(value);
}

function isLoosePlateCandidate(value: string) {
  const letters = (value.match(/[A-Z]/g) ?? []).length;
  const digits = (value.match(/[0-9]/g) ?? []).length;

  return value.length >= 5 && value.length <= 8 && letters >= 2 && digits >= 2;
}

function findLabeledPlate(text: string) {
  const normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  const patterns = [
    /\bPLACA\s*\/\s*(?:KM|HM|ODOM(?:ETRO)?)\s*[:=\-]?\s*([A-Z0-9.\s/_-]{5,14})/,
    /\b(?:PLACA|VEICULO|CAVALO|TRATOR|FROTA|PREFIXO)(?:\s+(?:DO\s+)?(?:VEICULO|CAVALO|TRATOR))?\s*[:=\-#]?\s*([A-Z0-9.\s/_-]{5,14})/,
    /\b(?:PCA|PLAQ)\s*[:=\-#]?\s*([A-Z0-9.\s/_-]{5,14})/,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match?.[1]) continue;

    // Interrompe antes do próximo campo do rodapé.
    const token = match[1].split(
      /\s+(?:KM|HM|HODOMETRO|ODOMETRO|HORIMETRO|QUILOMETRAGEM|MOTORISTA|FRETISTA|VEICULO)\b|\||;|,|\//,
    )[0];

    const candidate = normalizePlate(token);

    if (isStrictPlate(candidate) || isLoosePlateCandidate(candidate)) {
      return candidate;
    }
  }

  return "";
}

export function extrairHodometro(texts: string[]) {
  const candidates: Array<{
    value: number;
    alias: string;
    source: string;
    confidence: number;
  }> = [];

  const patterns: Array<{
    alias: string;
    confidence: number;
    regex: RegExp;
  }> = [
    {
      alias: "PLACA/KM",
      confidence: 125,
      regex:
        /\bPLACA\s*\/\s*(?:KM|KMS?|OD(?:OM(?:ETRO)?)?|HOD(?:OM(?:ETRO)?)?|HD|HO|HM|HORIMETRO)\s*[:=\-#.]?\s*[A-Z0-9.\s/_-]{5,14}\s*[\/;|,\-]\s*(\d{3,8}(?:[\.,]\d{1,3})?)/i,
    },
    {
      alias: "PLACA + ODOMETRO",
      confidence: 123,
      regex:
        /\bPLACA\s*[:=\-#.]?\s*[A-Z0-9.-]{5,10}.{0,100}?\b(?:KM|KMS?|OD|ODOM|ODOMETRO|HOD|HODOM|HODOMETRO|HD|HO|HM|HORIMETRO|QUILOMETRAGEM)\s*[:=\-/#.]?\s*(\d{3,8}(?:[\.,]\d{1,3})?)/i,
    },
    {
      alias: "ODOMETRO COMPLETO",
      confidence: 121,
      regex:
        /\b(?:HODOMETRO|ODOMETRO|HORIMETRO|QUILOMETRAGEM)(?:\s+(?:ATUAL|FINAL|INICIAL|VEICULO|RODADO|TOTAL))?\s*[:=\-/#.]?\s*(\d{3,8}(?:[\.,]\d{1,3})?)/i,
    },
    {
      alias: "KM QUALIFICADO",
      confidence: 119,
      regex:
        /(?:^|[\s;|,(])(?:-\s*)?KM(?:S)?(?:\s+(?:ATUAL|FINAL|INICIAL|VEICULO|RODADO|TOTAL|ODOMETRO|HODOMETRO))?\s*[:=\-/#.]?\s*(\d{3,8}(?:[\.,]\d{1,3})?)/i,
    },
    {
      alias: "ABREVIACAO ODOMETRO",
      confidence: 117,
      regex:
        /(?:^|[\s;|,(])(?:ODOM|HODOM|HOD|OD|HD|HO|HM)\.?\s*(?:ATUAL|FINAL|INICIAL|VEICULO|RODADO|TOTAL)?\s*[:=\-/#.]?\s*(\d{3,8}(?:[\.,]\d{1,3})?)/i,
    },
    {
      alias: "KM/ODOMETRO",
      confidence: 115,
      regex:
        /\b(?:KM|ODOMETRO|HODOMETRO|ODOM|HODOM|OD|HOD)\s*\/\s*(?:HM|HD|HO|HORIMETRO|ODOM(?:ETRO)?|HODOM(?:ETRO)?)\s*[:=\-/]\s*(\d{3,8}(?:[\.,]\d{1,3})?)/i,
    },
    {
      alias: "ROTULO CURTO COLADO",
      confidence: 110,
      regex:
        /(?:^|[\s;|,(])(?:KM|KMS|ODOM|HODOM|HOD|OD|HD|HO|HM)\.?\s*(\d{3,8})(?=\D|$)/i,
    },
    {
      alias: "PLACA E NUMERO",
      confidence: 103,
      regex:
        /\b[A-Z]{2,3}[0-9A-Z]{3,5}\s*[;|,/\-]\s*(\d{4,8})(?=\D|$)/i,
    },
  ];

  for (const source of texts) {
    const normalizedSource = source
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    for (const pattern of patterns) {
      const match = normalizedSource.match(pattern.regex);
      if (!match?.[1]) continue;

      const value = parseOdometerCandidate(match[1]);
      if (value === null) continue;

      candidates.push({
        value,
        alias: pattern.alias,
        source: source.slice(0, 500),
        confidence: pattern.confidence,
      });
    }

    // Alguns emissores gravam apenas: ;RAX6E36;410890;
    const adjacent = normalizedSource.match(
      /(?:^|;|\||,)\s*([A-Z0-9-]{5,9})\s*[;|/,\-]\s*(\d{3,8})(?:;|\||,|$)/i,
    );

    if (adjacent?.[1] && adjacent?.[2]) {
      const plate = normalizePlate(adjacent[1]);
      const value = parseOdometerCandidate(adjacent[2]);

      if (isLoosePlateCandidate(plate) && value !== null) {
        candidates.push({
          value,
          alias: "PLACA/ODÔMETRO SEM RÓTULO",
          source: source.slice(0, 500),
          confidence: 90,
        });
      }
    }
  }

  candidates.sort((a, b) => b.confidence - a.confidence);

  return candidates[0] ?? null;
}

function extractPlate(infNfe: any, texts: string[]) {
  // 1. Campo oficial da NF-e.
  const directCandidates = [
    infNfe?.transp?.veicTransp?.placa,
    ...asArray(infNfe?.transp?.reboque).map((item: any) => item?.placa),
  ];

  for (const candidate of directCandidates) {
    const plate = normalizePlate(candidate);
    if (isStrictPlate(plate)) return plate;
  }

  // 2. Campo PLACA escrito nas informações complementares/rodapé.
  // Também preserva candidatos com um caractere faltando, pois eles podem
  // ser conciliados com a frota cadastrada por similaridade.
  for (const text of texts) {
    const plate = findLabeledPlate(text);
    if (plate) return plate;
  }

  // 3. Último recurso: qualquer placa estritamente válida no texto.
  for (const text of texts) {
    const normalizedText = text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();

    const match = normalizedText.match(
      /(?:^|[^A-Z0-9])([A-Z]{3})[\s.\-]?([0-9][A-Z0-9][0-9]{2})(?![A-Z0-9])/,
    );

    if (match?.[1] && match?.[2]) {
      return `${match[1]}${match[2]}`;
    }

    // Formato sem rótulo: ;RAX6E36;410890;
    const adjacent = normalizedText.match(
      /(?:^|;|\||,)\s*([A-Z0-9-]{5,9})\s*[;|/,\-]\s*\d{3,8}(?:;|\||,|$)/,
    );

    const candidate = normalizePlate(adjacent?.[1]);
    if (isLoosePlateCandidate(candidate)) return candidate;
  }

  return "";
}

function levenshteinDistance(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost =
        left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;

      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + substitutionCost,
      );
    }

    for (let index = 0; index < current.length; index += 1) {
      previous[index] = current[index];
    }
  }

  return previous[right.length];
}

export interface AbastecimentoXmlProduto {
  codigo: string;
  ean: string;
  nome: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  desconto: number;
  combustivel: {
    codigoAnp: string;
    descricaoAnp: string;
    ufConsumo: string;
  } | null;
}

export interface AbastecimentoXmlInterpretado {
  chaveNfe: string;
  numero: string;
  serie: string;
  dataEmissao: string;
  naturezaOperacao: string;
  emitente: {
    cnpj: string;
    razaoSocial: string;
    nomeFantasia: string;
    inscricaoEstadual: string;
    endereco: string;
    cidade: string;
    uf: string;
  };
  destinatario: {
    cnpjCpf: string;
    razaoSocial: string;
    endereco: string;
    cidade: string;
    uf: string;
  };
  placa: string;
  hodometro: number | null;
  hodometroOrigem: string;
  hodometroConfianca: number;
  produtos: AbastecimentoXmlProduto[];
  totais: {
    produtos: number;
    desconto: number;
    frete: number;
    seguro: number;
    outros: number;
    nota: number;
    icms: number;
    pis: number;
    cofins: number;
  };
  informacoesComplementares: string;
}

export function interpretarAbastecimentoXml(
  xml: string,
): AbastecimentoXmlInterpretado {
  const root = parser.parse(xml);
  const infNfe = findInfNfe(root);

  if (!infNfe) {
    throw new Error("O arquivo não contém uma estrutura válida de NF-e.");
  }

  const ide = infNfe.ide ?? {};
  const emit = infNfe.emit ?? {};
  const dest = infNfe.dest ?? {};
  const total = infNfe.total?.ICMSTot ?? {};
  const texts = noteTexts(infNfe);
  const odometer = extrairHodometro(texts);

  const produtos = asArray(infNfe.det).map((det: any) => {
    const prod = det?.prod ?? {};
    const imposto = det?.imposto ?? {};
    const comb = prod?.comb ?? null;

    return {
      codigo: firstText(prod.cProd),
      ean: firstText(prod.cEAN, prod.cEANTrib),
      nome: firstText(prod.xProd),
      ncm: firstText(prod.NCM),
      cfop: firstText(prod.CFOP),
      unidade: firstText(prod.uCom, prod.uTrib),
      quantidade: decimalValue(prod.qCom ?? prod.qTrib),
      valorUnitario: decimalValue(prod.vUnCom ?? prod.vUnTrib),
      valorTotal: decimalValue(prod.vProd),
      desconto: decimalValue(prod.vDesc),
      combustivel: comb
        ? {
            codigoAnp: firstText(comb.cProdANP),
            descricaoAnp: firstText(comb.descANP),
            ufConsumo: firstText(comb.UFCons).toUpperCase(),
          }
        : null,
    };
  });

  const chaveNfe = onlyDigits(
    infNfe?.["@_Id"] ??
      root?.nfeProc?.protNFe?.infProt?.chNFe ??
      root?.protNFe?.infProt?.chNFe,
  ).replace(/^NFe/, "");

  return {
    chaveNfe,
    numero: firstText(ide.nNF),
    serie: firstText(ide.serie),
    dataEmissao: firstText(ide.dhEmi, ide.dEmi).slice(0, 10),
    naturezaOperacao: firstText(ide.natOp),
    emitente: {
      cnpj: onlyDigits(emit.CNPJ ?? emit.CPF),
      razaoSocial: firstText(emit.xNome),
      nomeFantasia: firstText(emit.xFant),
      inscricaoEstadual: firstText(emit.IE),
      endereco: joinAddress(emit.enderEmit),
      cidade: firstText(emit.enderEmit?.xMun),
      uf: firstText(emit.enderEmit?.UF).toUpperCase(),
    },
    destinatario: {
      cnpjCpf: onlyDigits(dest.CNPJ ?? dest.CPF),
      razaoSocial: firstText(dest.xNome),
      endereco: joinAddress(dest.enderDest),
      cidade: firstText(dest.enderDest?.xMun),
      uf: firstText(dest.enderDest?.UF).toUpperCase(),
    },
    placa: extractPlate(infNfe, texts),
    hodometro: odometer?.value ?? null,
    hodometroOrigem: odometer?.source ?? "",
    hodometroConfianca: odometer?.confidence ?? 0,
    produtos,
    totais: {
      produtos: decimalValue(total.vProd),
      desconto: decimalValue(total.vDesc),
      frete: decimalValue(total.vFrete),
      seguro: decimalValue(total.vSeg),
      outros: decimalValue(total.vOutro),
      nota: decimalValue(total.vNF),
      icms: decimalValue(total.vICMS),
      pis: decimalValue(total.vPIS),
      cofins: decimalValue(total.vCOFINS),
    },
    informacoesComplementares: texts.join("\n"),
  };
}

async function findClienteSuggestion(document: AbastecimentoXmlInterpretado) {
  const cnpj = document.emitente.cnpj;

  if (cnpj) {
    const exact = await prisma.cliente.findFirst({
      where: { cnpj },
      select: {
        id: true,
        nomeFantasia: true,
        razaoSocial: true,
        cnpj: true,
      },
    });

    if (exact) return exact;
  }

  const name = firstText(
    document.emitente.nomeFantasia,
    document.emitente.razaoSocial,
  );

  if (!name) return null;

  const words = normalizeSearch(name)
    .split(" ")
    .filter((word) => word.length >= 3)
    .slice(0, 3);

  if (!words.length) return null;

  return prisma.cliente.findFirst({
    where: {
      OR: words.flatMap((word) => [
        { nomeFantasia: { contains: word, mode: "insensitive" } },
        { razaoSocial: { contains: word, mode: "insensitive" } },
      ]),
    },
    select: {
      id: true,
      nomeFantasia: true,
      razaoSocial: true,
      cnpj: true,
    },
  });
}

async function findVehicleSuggestion(plate: string) {
  const normalizedPlate = normalizePlate(plate);

  if (!normalizedPlate) return null;

  const candidates = await prisma.veiculo.findMany({
    select: {
      id: true,
      placa: true,
      modelo: true,
    },
  });

  const normalizedCandidates = candidates.map((vehicle) => ({
    vehicle,
    normalized: normalizePlate(vehicle.placa),
  }));

  const exact = normalizedCandidates.find(
    (candidate) => candidate.normalized === normalizedPlate,
  );

  if (exact) return exact.vehicle;

  // Nos 192 XMLs analisados apareceram placas com um caractere omitido,
  // por exemplo RAQF96 no lugar de RAQ5F96 e RATF79 no lugar de RAT8F79.
  // Só aceita aproximação quando existe um único melhor resultado na frota.
  if (!isLoosePlateCandidate(normalizedPlate)) return null;

  const ranked = normalizedCandidates
    .map((candidate) => ({
      ...candidate,
      distance: levenshteinDistance(normalizedPlate, candidate.normalized),
    }))
    .filter((candidate) => candidate.distance <= 1)
    .sort((a, b) => a.distance - b.distance);

  if (!ranked.length) return null;

  const bestDistance = ranked[0].distance;
  const bestMatches = ranked.filter(
    (candidate) => candidate.distance === bestDistance,
  );

  return bestMatches.length === 1 ? bestMatches[0].vehicle : null;
}


function isFuelProduct(product: AbastecimentoXmlProduto) {
  if (product.combustivel) return true;

  const text = normalizeSearch(
    [product.nome, product.ncm].join(" "),
  );

  return /\b(?:diesel|gasolina|etanol|alcool|arla|gnv|gas natural veicular|combustivel|s10|s 10|s500|s 500)\b/.test(
    text,
  );
}

function generatedInternalCode(product: AbastecimentoXmlProduto) {
  const source = firstText(
    product.codigo,
    product.combustivel?.codigoAnp,
    product.ean,
    product.ncm,
    product.nome,
  );

  const normalized = String(source)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return `ABAST-${normalized || "PRODUTO"}`;
}

async function createFuelProductIfMissing(product: AbastecimentoXmlProduto) {
  if (!isFuelProduct(product)) return null;

  const exactName = firstText(product.nome, product.combustivel?.descricaoAnp);
  if (!exactName) return null;

  const existingByName = await prisma.produto.findFirst({
    where: {
      nome: { equals: exactName, mode: "insensitive" },
      categoriaEstoque: { equals: "Combustível", mode: "insensitive" },
    },
    select: { id: true, nome: true, codigoInterno: true },
  });

  if (existingByName) return { ...existingByName, criadoAutomaticamente: false };

  const baseCode = generatedInternalCode(product);
  let code = baseCode;
  let suffix = 2;

  while (
    await prisma.produto.findFirst({
      where: { codigoInterno: { equals: code, mode: "insensitive" } },
      select: { id: true },
    })
  ) {
    const sameProduct = await prisma.produto.findFirst({
      where: {
        codigoInterno: { equals: code, mode: "insensitive" },
        nome: { equals: exactName, mode: "insensitive" },
      },
      select: { id: true, nome: true, codigoInterno: true },
    });

    if (sameProduct) {
      return { ...sameProduct, criadoAutomaticamente: false };
    }

    code = `${baseCode}-${suffix}`;
    suffix += 1;
  }

  const created = await prisma.produto.create({
    data: {
      nome: exactName,
      codigoInterno: code,
      categoriaEstoque: "Combustível",
    },
    select: { id: true, nome: true, codigoInterno: true },
  });

  return { ...created, criadoAutomaticamente: true };
}

async function findProductSuggestion(product: AbastecimentoXmlProduto) {
  const code = product.codigo.trim();

  if (code) {
    const byCode = await prisma.produto.findFirst({
      where: {
        categoriaEstoque: { equals: "Combustível", mode: "insensitive" },
        codigoInterno: {
          equals: code,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        nome: true,
        codigoInterno: true,
      },
    });

    if (byCode) return { ...byCode, criadoAutomaticamente: false };
  }

  const normalizedName = normalizeSearch(
    product.combustivel?.descricaoAnp || product.nome,
  );

  const terms = normalizedName
    .split(" ")
    .filter((term) => term.length >= 3)
    .slice(0, 4);

  const matched = terms.length
    ? await prisma.produto.findFirst({
        where: {
          categoriaEstoque: { equals: "Combustível", mode: "insensitive" },
          OR: terms.map((term) => ({
            nome: {
              contains: term,
              mode: "insensitive",
            },
          })),
        },
        select: {
          id: true,
          nome: true,
          codigoInterno: true,
        },
      })
    : null;

  if (matched) return { ...matched, criadoAutomaticamente: false };

  return createFuelProductIfMissing(product);
}

export async function sugerirVinculosAbastecimento(
  document: AbastecimentoXmlInterpretado,
) {
  const [cliente, veiculo] = await Promise.all([
    findClienteSuggestion(document),
    findVehicleSuggestion(document.placa),
  ]);

  // Processa em sequência para evitar criar produtos duplicados quando
  // o mesmo combustível aparece mais de uma vez no mesmo lote/documento.
  const produtos = [];
  for (const produto of document.produtos) {
    produtos.push({
      produto,
      cadastro: await findProductSuggestion(produto),
    });
  }

  return {
    cliente,
    veiculo,
    produtos,
  };
}
