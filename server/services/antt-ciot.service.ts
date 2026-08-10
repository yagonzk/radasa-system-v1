import https from "node:https";
import tls from "node:tls";
import axios, { type AxiosInstance } from "axios";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";

const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "");
const text = (value: unknown) => String(value ?? "").trim();
const numeric = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const compactPlate = (value: unknown) => text(value).replace(/[^A-Z0-9]/gi, "").toUpperCase();
const asArray = (value: unknown): unknown[] => value === undefined || value === null ? [] : Array.isArray(value) ? value : [value];
const messagesFrom = (result: any) => asArray(result?.Mensagem).map(String).filter(Boolean);
const codesFrom = (result: any) => asArray(result?.Codigo).map(String).filter(Boolean);

function decodeCertificate(value: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error("Certificado digital não cadastrado.");
  const comma = normalized.indexOf(",");
  const base64 = normalized.startsWith("data:") && comma >= 0
    ? normalized.slice(comma + 1)
    : normalized;
  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length) throw new Error("O certificado digital cadastrado está vazio ou inválido.");
  return buffer;
}

function normalizeRntrc(value: unknown) {
  const normalized = digits(value);
  return normalized.length === 8 ? `0${normalized}` : normalized;
}

function serviceUrl(path: string) {
  const base = env.ANTT_CIOT_BASE_URL.replace(/\/$/, "");
  return `${base}/${path.replace(/^\//, "")}`;
}

async function getCompany(companyId?: string | null) {
  const company = companyId
    ? await prisma.empresa.findUnique({ where: { id: companyId } })
    : await prisma.empresa.findFirst({
        where: { ativa: true },
        orderBy: [{ empresaPadrao: "desc" }, { createdAt: "desc" }],
      });

  if (!company) throw new Error("Empresa emitente não encontrada.");
  if (!company.certificadoArquivo?.trim()) throw new Error("A empresa não possui certificado A1 cadastrado.");
  if (!company.certificadoSenha?.trim()) throw new Error("A senha do certificado A1 não está cadastrada.");
  return company;
}

type Company = Awaited<ReturnType<typeof getCompany>>;

function validateCertificateLocally(company: Company) {
  try {
    tls.createSecureContext({
      pfx: decodeCertificate(company.certificadoArquivo ?? ""),
      passphrase: company.certificadoSenha ?? "",
      minVersion: "TLSv1.2",
    });
    return { ok: true as const, message: "Certificado A1 e senha validados localmente." };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

function createClient(company: Company): AxiosInstance {
  const agent = new https.Agent({
    pfx: decodeCertificate(company.certificadoArquivo ?? ""),
    passphrase: company.certificadoSenha ?? "",
    minVersion: "TLSv1.2",
    rejectUnauthorized: true,
    keepAlive: true,
  });

  return axios.create({
    timeout: env.ANTT_CIOT_TIMEOUT_MS,
    httpsAgent: agent,
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    validateStatus: () => true,
  });
}

async function postService(company: Company, path: string, payload: unknown) {
  const response = await createClient(company).post(serviceUrl(path), payload);
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`ANTT respondeu HTTP ${response.status}: ${JSON.stringify(response.data)}`);
  }
  return response.data;
}

async function getService(company: Company, path: string, params: Record<string, unknown>) {
  const response = await createClient(company).get(serviceUrl(path), { params });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`ANTT respondeu HTTP ${response.status}: ${JSON.stringify(response.data)}`);
  }
  return response.data;
}

function firstUseful(...values: unknown[]) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}


export type PisoMinimoResult = {
  aplicavel: boolean;
  tabela: "A" | "C" | null;
  codigoTipoCarga: number | null;
  numeroEixos: number | null;
  distanciaKm: number;
  ccd: number | null;
  cc: number | null;
  valorPiso: number | null;
  valorFrete: number;
  diferenca: number | null;
  abaixoDoPiso: boolean;
  fundamento: string;
};

type CoeficientePiso = { ccd: number; cc: number };
type TabelaPiso = Record<number, Partial<Record<number, CoeficientePiso>>>;

// Resolução ANTT nº 6.084/2026, Tabelas A e C.
const PISO_TABELA_A: TabelaPiso = {
  1:{2:{ccd:4.0144,cc:460.59},3:{ccd:5.1355,cc:552.24},4:{ccd:5.8118,cc:597},5:{ccd:6.6983,cc:664.83},6:{ccd:7.3841,cc:680.01},7:{ccd:8.0516,cc:820.34},9:{ccd:9.2231,cc:908.91}},
  2:{2:{ccd:4.0884,cc:471.98},3:{ccd:5.2311,cc:569.57},4:{ccd:5.9661,cc:621.52},5:{ccd:6.8661,cc:693.08},6:{ccd:7.5572,cc:709.72},7:{ccd:8.19,cc:840.50},9:{ccd:9.3822,cc:934.76}},
  3:{2:{ccd:4.7095,cc:520.07},3:{ccd:6.0159,cc:623.27},4:{ccd:6.8646,cc:686.63},5:{ccd:7.8666,cc:757.98},6:{ccd:8.6661,cc:772.35},7:{ccd:9.5884,cc:982.76},9:{ccd:10.887,cc:1067.06}},
  4:{3:{ccd:5.1082,cc:544.75},4:{ccd:5.7396,cc:577.15},5:{ccd:6.6345,cc:647.29},6:{ccd:7.3186,cc:662.01},7:{ccd:8.0492,cc:819.69},9:{ccd:9.1399,cc:886.05}},
  5:{2:{ccd:3.9826,cc:451.84},3:{ccd:5.0977,cc:541.86},4:{ccd:5.7822,cc:588.86},5:{ccd:6.6718,cc:657.56},6:{ccd:7.3547,cc:671.93},7:{ccd:8.0927,cc:831.66},9:{ccd:9.2027,cc:903.32}},
  6:{2:{ccd:3.6023,cc:451.84},3:{ccd:5.0962,cc:541.44},4:{ccd:5.8094,cc:596.35},5:{ccd:6.6718,cc:657.56},6:{ccd:7.3547,cc:671.93},7:{ccd:8.0927,cc:831.66},9:{ccd:9.2027,cc:903.32}},
  7:{2:{ccd:4.7845,cc:608.79},3:{ccd:5.9154,cc:703.16},4:{ccd:6.6285,cc:753.03},5:{ccd:7.515,cc:820.86},6:{ccd:8.2008,cc:836.04},7:{ccd:8.8866,cc:981.39},9:{ccd:10.066,cc:1072.15}},
  8:{2:{ccd:4.871,cc:632.58},3:{ccd:6.0236,cc:732.90},4:{ccd:6.7628,cc:789.96},5:{ccd:7.6628,cc:861.51},6:{ccd:8.3539,cc:878.16},7:{ccd:9.0049,cc:1013.95},9:{ccd:10.2051,cc:1110.41}},
  9:{2:{ccd:5.3176,cc:630.88},3:{ccd:6.6369,cc:737.63},4:{ccd:7.502,cc:807.63},5:{ccd:8.5039,cc:878.98},6:{ccd:9.3034,cc:893.35},7:{ccd:10.2495,cc:1110.28},9:{ccd:11.5584,cc:1197.43}},
  10:{3:{ccd:5.4926,cc:645.45},4:{ccd:6.1608,cc:682.95},5:{ccd:7.0556,cc:753.10},6:{ccd:7.7398,cc:767.81},7:{ccd:8.4886,cc:930.51},9:{ccd:9.5873,cc:999.06}},
  11:{2:{ccd:4.3571,cc:549.81},3:{ccd:5.4821,cc:642.55},4:{ccd:6.2033,cc:694.66},5:{ccd:7.093,cc:763.36},6:{ccd:7.7758,cc:777.73},7:{ccd:8.5321,cc:942.48},9:{ccd:9.6501,cc:1016.33}},
  12:{5:{ccd:7.0364,cc:757.81},6:{ccd:7.7652,cc:784.82},9:{ccd:9.7444,cc:1052.26}},
};

const PISO_TABELA_C: TabelaPiso = {
  1:{2:{ccd:3.3964,cc:174.38},3:{ccd:4.3276,cc:198.05},4:{ccd:4.9441,cc:215.03},5:{ccd:5.6725,cc:229.64},6:{ccd:6.3229,cc:232.91},7:{ccd:6.7071,cc:270.36},9:{ccd:7.6912,cc:292.59}},
  2:{2:{ccd:3.4439,cc:176.84},3:{ccd:4.3828,cc:201.78},4:{ccd:5.0412,cc:220.31},5:{ccd:5.7745,cc:235.73},6:{ccd:6.4268,cc:239.32},7:{ccd:6.7985,cc:274.70},9:{ccd:7.7901,cc:298.16}},
  3:{2:{ccd:4.0647,cc:205.65},3:{ccd:5.1615,cc:232.97},4:{ccd:5.9203,cc:256.16},5:{ccd:6.756,cc:271.54},6:{ccd:7.522,cc:274.63},7:{ccd:8.0108,cc:329.34},9:{ccd:9.1377,cc:351.60}},
  4:{3:{ccd:4.3178,cc:196.43},4:{ccd:4.9182,cc:210.75},5:{ccd:5.6496,cc:225.87},6:{ccd:6.2994,cc:229.04},7:{ccd:6.7062,cc:270.22},9:{ccd:7.6614,cc:287.67}},
  5:{2:{ccd:3.385,cc:172.50},3:{ccd:4.3141,cc:195.81},4:{ccd:4.9335,cc:213.27},5:{ccd:5.663,cc:228.08},6:{ccd:6.3124,cc:231.17},7:{ccd:6.7218,cc:272.80},9:{ccd:7.6839,cc:291.39}},
  6:{2:{ccd:3.0047,cc:172.50},3:{ccd:4.3135,cc:195.72},4:{ccd:4.9432,cc:214.89},5:{ccd:5.663,cc:228.08},6:{ccd:6.3124,cc:231.17},7:{ccd:6.7218,cc:272.80},9:{ccd:7.6839,cc:291.39}},
  7:{2:{ccd:3.9329,cc:224.77},3:{ccd:4.8748,cc:250.19},4:{ccd:5.5294,cc:270.47},5:{ccd:6.2578,cc:285.09},6:{ccd:6.9083,cc:288.36},7:{ccd:7.3121,cc:329.05},9:{ccd:8.3048,cc:352.70}},
  8:{2:{ccd:3.964,cc:229.89},3:{ccd:4.9136,cc:256.60},4:{ccd:5.5777,cc:278.43},5:{ccd:6.3109,cc:293.85},6:{ccd:6.9633,cc:297.43},7:{ccd:7.3546,cc:336.06},9:{ccd:8.3548,cc:360.94}},
  9:{2:{ccd:4.5599,cc:253.51},3:{ccd:5.6705,cc:283.12},4:{ccd:6.4476,cc:310.60},5:{ccd:7.2833,cc:325.98},6:{ccd:8.0493,cc:329.07},7:{ccd:8.5636,cc:388},9:{ccd:9.7016,cc:412.10}},
  10:{3:{ccd:4.5865,cc:237.75},4:{ccd:5.225,cc:255.37},5:{ccd:5.9564,cc:270.49},6:{ccd:6.6062,cc:273.66},7:{ccd:7.0327,cc:318.08},9:{ccd:7.9965,cc:336.95}},
  11:{2:{ccd:3.643,cc:212.06},3:{ccd:4.5827,cc:237.13},4:{ccd:5.2403,cc:257.89},5:{ccd:5.9698,cc:272.70},6:{ccd:6.6192,cc:275.79},7:{ccd:7.0483,cc:320.66},9:{ccd:8.019,cc:340.67}},
  12:{5:{ccd:5.7939,cc:249.68},6:{ccd:6.4598,cc:255.50},9:{ccd:7.8784,cc:323.48}},
};

function calculatePisoMinimo(ciot: { tipoOperacao: string; valorFrete: unknown }, fields: AnttCiotOverrides): PisoMinimoResult {
  const valorFrete = numeric(ciot.valorFrete);
  const distanciaKm = numeric(fields.distanciaPercorrida);
  const codigoTipoCarga = fields.codigoTipoCarga ?? null;
  const numeroEixos = fields.numeroEixos ?? null;
  const aplicavel = ciot.tipoOperacao === "LOTACAO";
  const tabela = aplicavel ? (fields.indAltoDesempenho ? "C" : "A") : null;
  const coeficiente = aplicavel && codigoTipoCarga && numeroEixos
    ? (tabela === "C" ? PISO_TABELA_C : PISO_TABELA_A)[codigoTipoCarga]?.[numeroEixos]
    : undefined;
  const valorPiso = coeficiente && distanciaKm > 0
    ? Number((distanciaKm * coeficiente.ccd + coeficiente.cc).toFixed(2))
    : null;
  const diferenca = valorPiso === null ? null : Number((valorFrete - valorPiso).toFixed(2));
  return {
    aplicavel, tabela, codigoTipoCarga, numeroEixos, distanciaKm,
    ccd: coeficiente?.ccd ?? null, cc: coeficiente?.cc ?? null, valorPiso,
    valorFrete, diferenca, abaixoDoPiso: valorPiso !== null && valorFrete < valorPiso,
    fundamento: "Resolução ANTT nº 6.084/2026",
  };
}

export type AnttInstallment = {
  numeroParcela: number;
  dataVencimento: string;
  valorParcela: number;
};

export type AnttCiotOverrides = {
  idOperacaoTransporte?: string;
  distanciaPercorrida?: number;
  codigoMunicipioOrigem?: number;
  codigoMunicipioDestino?: number;
  cepOrigem?: string;
  cepDestino?: string;
  latitudeOrigem?: number;
  longitudeOrigem?: number;
  latitudeDestino?: number;
  longitudeDestino?: number;
  codigoNaturezaCarga?: number;
  codigoTipoCarga?: number;
  numeroEixos?: number;
  tipoPagamento?: number;
  codigoInstituicaoFinanceira?: number;
  numeroAgencia?: string;
  numeroConta?: string;
  chavePix?: string;
  cpfCnpjCreditado?: string;
  codigoPagamento?: number;
  identificadorPix?: string;
  indPagamento?: number;
  parcelas?: AnttInstallment[];
  indAltoDesempenho?: boolean;
  indRetornoVazio?: boolean;
  composicaoVeicular?: boolean;
  indContingencia?: boolean;
  justificativaContingencia?: string;
  rntrcContratante?: string;
};

function locationObject(prefix: "origem" | "destino", fields: AnttCiotOverrides) {
  const object: Record<string, unknown> = {};
  if (prefix === "origem") {
    if (fields.codigoMunicipioOrigem) object.CodigoMunicipioOrigem = fields.codigoMunicipioOrigem;
    if (digits(fields.cepOrigem).length === 8) object.CepOrigem = digits(fields.cepOrigem);
    if (fields.latitudeOrigem !== undefined) object.LatitudeOrigem = fields.latitudeOrigem;
    if (fields.longitudeOrigem !== undefined) object.LongitudeOrigem = fields.longitudeOrigem;
  } else {
    if (fields.codigoMunicipioDestino) object.CodigoMunicipioDestino = fields.codigoMunicipioDestino;
    if (digits(fields.cepDestino).length === 8) object.CepDestino = digits(fields.cepDestino);
    if (fields.latitudeDestino !== undefined) object.LatitudeDestino = fields.latitudeDestino;
    if (fields.longitudeDestino !== undefined) object.LongitudeDestino = fields.longitudeDestino;
  }
  return object;
}

function hasLocation(prefix: "origem" | "destino", fields: AnttCiotOverrides) {
  if (prefix === "origem") {
    return Boolean(
      fields.codigoMunicipioOrigem ||
      digits(fields.cepOrigem).length === 8 ||
      (fields.latitudeOrigem !== undefined && fields.longitudeOrigem !== undefined),
    );
  }
  return Boolean(
    fields.codigoMunicipioDestino ||
    digits(fields.cepDestino).length === 8 ||
    (fields.latitudeDestino !== undefined && fields.longitudeDestino !== undefined),
  );
}

export async function prepareOfficialPayload(ciotId: string, overrides: AnttCiotOverrides = {}) {
  const ciot = await prisma.ciot.findUnique({
    where: { id: ciotId },
    include: { ctes: true, empresa: true, veiculo: true, motorista: true },
  });
  if (!ciot) throw new Error("CIOT não encontrado.");

  const company = ciot.empresa ?? (await getCompany(ciot.empresaId));
  const cte = ciot.ctes[0];
  const rawPayload = (ciot.payloadAntt ?? {}) as any;
  const savedOverrides = (rawPayload?.antt?.camposComplementares ?? rawPayload?.camposComplementares ?? {}) as AnttCiotOverrides;
  const fields: AnttCiotOverrides = { ...savedOverrides, ...overrides };
  if (!fields.tipoPagamento && /pix/i.test(text(ciot.formaPagamento))) fields.tipoPagamento = 6;
  if (!text(fields.chavePix) && text(ciot.favorecidoPix)) fields.chavePix = text(ciot.favorecidoPix);
  if (!text(fields.cpfCnpjCreditado)) fields.cpfCnpjCreditado = digits(company.cnpj);

  const typeMap: Record<string, number> = { LOTACAO: 1, FRACIONADA: 2, TAC_AGREGADO: 3 };
  const contractorCnpj = digits(firstUseful(ciot.contratanteCnpj, cte?.tomadorCnpj, cte?.remetenteCnpj, ""));
  const recipientCnpj = digits(firstUseful(cte?.destinatarioCnpj, ciot.contratadoCnpj, ""));
  const operationId = digits(fields.idOperacaoTransporte);

  const payment: Record<string, unknown> = {
    TipoPagamento: fields.tipoPagamento,
    CpfCnpjCreditado: digits(fields.cpfCnpjCreditado || company.cnpj),
    IndPagamento: fields.indPagamento ?? 0,
  };
  if ([1, 2, 3, 4].includes(fields.tipoPagamento ?? 0)) {
    if (fields.codigoInstituicaoFinanceira) payment.CodigoInstituicaoFinanceira = fields.codigoInstituicaoFinanceira;
    if (text(fields.numeroAgencia)) payment.NumeroAgencia = text(fields.numeroAgencia);
    if (text(fields.numeroConta)) payment.NumeroConta = text(fields.numeroConta);
  }
  if (fields.tipoPagamento === 6) {
    if (text(fields.chavePix)) payment.ChavePix = text(fields.chavePix);
    if (text(fields.identificadorPix)) payment.IdentificadorPix = text(fields.identificadorPix);
  }
  if (fields.codigoPagamento) payment.CodigoPagamento = fields.codigoPagamento;
  if ((fields.indPagamento ?? 0) === 1 && fields.parcelas?.length) {
    payment.Parcelas = fields.parcelas.map((item) => ({
      NumeroParcela: item.numeroParcela,
      DataVencimento: item.dataVencimento,
      ValorParcela: item.valorParcela,
    }));
  }

  const origemDestino = {
    Origem: locationObject("origem", fields),
    Destino: locationObject("destino", fields),
    DistanciaPercorrida: fields.distanciaPercorrida,
  };

  const payload: Record<string, unknown> = {
    IdOperacaoTransporte: operationId,
    TipoOperacao: typeMap[ciot.tipoOperacao],
    CpfCnpjContratado: digits(company.cnpj),
    RNTRCContratado: normalizeRntrc(company.rntrc),
    CpfCnpjContratante: contractorCnpj,
    ...(normalizeRntrc(fields.rntrcContratante) ? { RNTRCContratante: normalizeRntrc(fields.rntrcContratante) } : {}),
    ...(ciot.tipoOperacao !== "TAC_AGREGADO" ? { CpfCnpjDestinatario: recipientCnpj } : {}),
    ValorFrete: numeric(ciot.valorFrete),
    DataDeclaracao: new Date().toISOString().slice(0, 19),
    IndContingencia: fields.indContingencia ?? false,
    ...(fields.indContingencia && text(fields.justificativaContingencia)
      ? { JustificativaContingencia: text(fields.justificativaContingencia) }
      : {}),
    DataInicioViagem: ciot.dataInicio.toISOString().slice(0, 10),
    ...(ciot.dataFim ? { DataFimViagem: ciot.dataFim.toISOString().slice(0, 10) } : {}),
    Veiculos: [{
      Placa: compactPlate(ciot.veiculo.placa),
      RNTRC: normalizeRntrc(company.rntrc),
      NumeroEixos: fields.numeroEixos,
    }],
    OrigemDestino: [origemDestino],
    DadosCarga: {
      CodigoNaturezaCarga: fields.codigoNaturezaCarga,
      PesoCarga: numeric(ciot.pesoKg),
      CodigoTipoCarga: fields.codigoTipoCarga,
      ...(ciot.tipoOperacao === "FRACIONADA"
        ? { ContratantesCargFrac: ciot.cnpjsCargaFracionada.split(",").map(digits).filter(Boolean) }
        : {}),
    },
    InfPagamento: [payment],
    ...(ciot.tipoOperacao === "LOTACAO"
      ? { InfIndicadoresOperacionais: {
          IndAltoDesempenho: fields.indAltoDesempenho ?? false,
          IndRetornoVazio: fields.indRetornoVazio ?? false,
          ComposicaoVeicular: fields.composicaoVeicular ?? false,
        } }
      : {}),
  };

  const missing: string[] = [];
  if (operationId.length !== 12) missing.push("ID oficial da operação com 12 dígitos, gerado pela ferramenta ANTT");
  if (digits(company.cnpj).length !== 14) missing.push("CNPJ válido da empresa transportadora");
  if (normalizeRntrc(company.rntrc).length !== 9) missing.push("RNTRC da empresa com 8 ou 9 dígitos");
  if (![11, 14].includes(contractorCnpj.length)) missing.push("CPF/CNPJ do contratante");
  if (ciot.tipoOperacao !== "TAC_AGREGADO" && ![11, 14].includes(recipientCnpj.length)) missing.push("CPF/CNPJ do destinatário");
  if (!fields.distanciaPercorrida || fields.distanciaPercorrida <= 0) missing.push("distância percorrida em km");
  if (!hasLocation("origem", fields)) missing.push("localização oficial da origem (IBGE, CEP ou coordenadas)");
  if (!hasLocation("destino", fields)) missing.push("localização oficial do destino (IBGE, CEP ou coordenadas)");
  if (!fields.codigoNaturezaCarga) missing.push("código ANTT da natureza da carga");
  if (!fields.codigoTipoCarga) missing.push("código ANTT do tipo de carga");
  if (!fields.numeroEixos || fields.numeroEixos < 2) missing.push("quantidade de eixos do veículo");
  if (!fields.tipoPagamento) missing.push("tipo de pagamento conforme DCS");
  if (![11, 14].includes(digits(fields.cpfCnpjCreditado || company.cnpj).length)) missing.push("CPF/CNPJ do creditado");
  if (fields.tipoPagamento === 6 && !text(fields.chavePix)) missing.push("chave PIX");
  if (fields.tipoPagamento === 6 && !text(fields.identificadorPix)) missing.push("identificador PIX");
  if ([1, 2, 3, 4].includes(fields.tipoPagamento ?? 0) && !fields.codigoInstituicaoFinanceira) missing.push("código da instituição financeira");
  if ((fields.indPagamento ?? 0) === 1 && !fields.parcelas?.length) missing.push("parcelas do pagamento a prazo");
  if (fields.indContingencia && !text(fields.justificativaContingencia)) missing.push("justificativa de contingência");

  const pisoMinimo = calculatePisoMinimo(ciot, fields);
  if (pisoMinimo.aplicavel && pisoMinimo.valorPiso === null) {
    missing.push("dados completos para cálculo do piso mínimo (distância, tipo de carga e eixos)");
  }
  if (pisoMinimo.abaixoDoPiso) {
    missing.push(`frete abaixo do piso mínimo em R$ ${Math.abs(pisoMinimo.diferenca ?? 0).toFixed(2)}`);
  }

  const uniqueMissing = Array.from(new Set(missing));
  const checklist = [
    { key: "certificado", label: "Certificado A1 cadastrado", ok: Boolean(company.certificadoArquivo?.trim()) },
    { key: "rntrc", label: "RNTRC da empresa válido", ok: normalizeRntrc(company.rntrc).length === 9 },
    { key: "cte", label: "CT-e vinculado", ok: ciot.ctes.length > 0 },
    { key: "motorista", label: "Motorista selecionado", ok: Boolean(ciot.motoristaId) },
    { key: "veiculo", label: "Veículo e placa selecionados", ok: Boolean(compactPlate(ciot.veiculo.placa)) },
    { key: "localizacao", label: "Origem e destino oficiais", ok: hasLocation("origem", fields) && hasLocation("destino", fields) },
    { key: "carga", label: "Tipo de carga e eixos informados", ok: Boolean(fields.codigoTipoCarga && fields.numeroEixos) },
    { key: "pagamento", label: "Pagamento configurado", ok: Boolean(fields.tipoPagamento) },
    { key: "piso", label: "Frete atende ao piso mínimo", ok: !pisoMinimo.aplicavel || (pisoMinimo.valorPiso !== null && !pisoMinimo.abaixoDoPiso) },
    { key: "payload", label: "Payload sem pendências", ok: uniqueMissing.length === 0 },
  ];

  return { ciot, company, payload, missing: uniqueMissing, fields, pisoMinimo, checklist };
}

function fullCiotCode(ciot: { numeroCiot: string | null; codigoVerificador: string | null }) {
  const direct = digits(ciot.numeroCiot);
  if (direct.length === 16) return direct;
  const verifier = digits(ciot.codigoVerificador);
  return `${direct}${verifier}`;
}

async function loadAuthorizedCiot(ciotId: string) {
  const ciot = await prisma.ciot.findUnique({ where: { id: ciotId }, include: { empresa: true } });
  if (!ciot) throw new Error("CIOT não encontrado.");
  const company = ciot.empresa ?? (await getCompany(ciot.empresaId));
  const code = fullCiotCode(ciot);
  if (code.length !== 16) throw new Error("O CIOT ainda não possui código completo de 16 dígitos.");
  return { ciot, company, code };
}

export const anttCiotService = {
  async configuration(companyId?: string | null) {
    const company = await getCompany(companyId);
    const certificateValidation = validateCertificateLocally(company);
    return {
      company: {
        id: company.id,
        razaoSocial: company.razaoSocial,
        nomeFantasia: company.nomeFantasia,
        cnpj: digits(company.cnpj),
        rntrc: normalizeRntrc(company.rntrc),
        certificateConfigured: Boolean(company.certificadoArquivo?.trim()),
        passwordConfigured: Boolean(company.certificadoSenha?.trim()),
        certificateValidity: company.certificadoValidade?.toISOString() ?? null,
        active: company.ativa,
        default: company.empresaPadrao,
      },
      integration: {
        environment: env.ANTT_CIOT_ENVIRONMENT,
        baseUrl: env.ANTT_CIOT_BASE_URL,
        networkEnabled: env.ANTT_CIOT_ENABLE_NETWORK,
        timeoutMs: env.ANTT_CIOT_TIMEOUT_MS,
      },
      certificate: certificateValidation,
    };
  },

  async certificate(companyId?: string | null) {
    const company = await getCompany(companyId);
    const validation = validateCertificateLocally(company);
    return {
      ok: validation.ok,
      message: validation.message,
      companyId: company.id,
      cnpj: digits(company.cnpj),
      rntrc: normalizeRntrc(company.rntrc),
      validity: company.certificadoValidade?.toISOString() ?? null,
    };
  },
  async diagnostic(companyId?: string | null) {
    const company = await getCompany(companyId);
    const certificateValidation = validateCertificateLocally(company);
    const local = {
      companyId: company.id,
      cnpj: digits(company.cnpj),
      rntrc: normalizeRntrc(company.rntrc),
      certificateConfigured: Boolean(company.certificadoArquivo?.trim()),
      passwordConfigured: Boolean(company.certificadoSenha?.trim()),
      environment: env.ANTT_CIOT_ENVIRONMENT,
      baseUrl: env.ANTT_CIOT_BASE_URL,
      networkEnabled: env.ANTT_CIOT_ENABLE_NETWORK,
      certificateValidation,
    };
    if (!certificateValidation.ok) {
      return { ok: false, local, message: `Certificado inválido: ${certificateValidation.message}` };
    }
    if (!env.ANTT_CIOT_ENABLE_NETWORK) {
      return { ok: true, local, message: "Configuração local validada. Chamadas externas estão desativadas." };
    }
    const result = await postService(company, env.ANTT_CIOT_PATH_TRANSPORTER, {
      CpfCnpjInteressado: digits(company.cnpj),
      CpfCnpjTransportador: digits(company.cnpj),
      RNTRCTransportador: normalizeRntrc(company.rntrc),
    });
    return { ok: Boolean(result?.RNTRCAtivo), local, antt: result };
  },

  async fleet(companyId: string | undefined, plates: string[]) {
    const company = await getCompany(companyId);
    const normalizedPlates = Array.from(new Set(plates.map(compactPlate).filter(Boolean)));
    if (!normalizedPlates.length) throw new Error("Informe ao menos uma placa para consultar a frota.");
    if (!env.ANTT_CIOT_ENABLE_NETWORK) {
      return { simulated: true, payload: {
        CpfCnpjInteressado: digits(company.cnpj),
        CpfCnpjTransportador: digits(company.cnpj),
        RNTRCTransportador: normalizeRntrc(company.rntrc),
        Placas: normalizedPlates,
      } };
    }
    return postService(company, env.ANTT_CIOT_PATH_FLEET, {
      CpfCnpjInteressado: digits(company.cnpj),
      CpfCnpjTransportador: digits(company.cnpj),
      RNTRCTransportador: normalizeRntrc(company.rntrc),
      Placas: normalizedPlates,
    });
  },

  async prepare(ciotId: string, overrides: AnttCiotOverrides = {}) {
    const prepared = await prepareOfficialPayload(ciotId, overrides);
    await prisma.ciot.update({
      where: { id: ciotId },
      data: {
        payloadAntt: {
          antt: {
            versaoDcs: "1.1",
            ambiente: env.ANTT_CIOT_ENVIRONMENT,
            camposComplementares: prepared.fields as any,
            declaracaoOperacaoTransporte: prepared.payload as any,
            pendencias: prepared.missing,
            pisoMinimo: prepared.pisoMinimo as any,
            checklist: prepared.checklist as any,
          },
        },
        preparadoEm: new Date(),
        status: prepared.missing.length ? "RASCUNHO" : "PRONTO_ENVIO",
        mensagemRetorno: prepared.missing.length
          ? `Pendências ANTT: ${prepared.missing.join(", ")}`
          : "Payload DCS v1.1 validado e pronto para homologação.",
      },
    });
    return { payload: prepared.payload, missing: prepared.missing, fields: prepared.fields, pisoMinimo: prepared.pisoMinimo, checklist: prepared.checklist };
  },

  async simulate(ciotId: string, overrides: AnttCiotOverrides = {}) {
    const prepared = await prepareOfficialPayload(ciotId, overrides);
    const certificate = validateCertificateLocally(prepared.company);
    const blockers = prepared.checklist
      .filter((item) => !item.ok)
      .map((item) => item.label);

    const warnings: string[] = [];
    if (env.ANTT_CIOT_ENVIRONMENT !== "homologacao") {
      warnings.push(
        "O ambiente configurado não é homologação. A simulação não realizou chamada externa.",
      );
    }
    if (env.ANTT_CIOT_ENABLE_NETWORK) {
      warnings.push(
        "A rede externa está habilitada, mas o modo simulação nunca envia dados à ANTT.",
      );
    }
    if (!certificate.ok) {
      warnings.push(`Certificado A1: ${certificate.message}`);
    }

    const report = {
      mode: "SIMULACAO",
      generatedAt: new Date().toISOString(),
      ciotId,
      environment: env.ANTT_CIOT_ENVIRONMENT,
      externalRequestPerformed: false,
      readyForHomologation: blockers.length === 0,
      company: {
        id: prepared.company.id,
        cnpj: digits(prepared.company.cnpj),
        rntrc: normalizeRntrc(prepared.company.rntrc),
        certificateConfigured: Boolean(
          prepared.company.certificadoArquivo?.trim(),
        ),
        certificateValid: certificate.ok,
        certificateMessage: certificate.message,
        certificateValidity:
          prepared.company.certificadoValidade?.toISOString() ?? null,
      },
      summary: {
        checklistTotal: prepared.checklist.length,
        checklistOk: prepared.checklist.filter((item) => item.ok).length,
        blockers: blockers.length,
        warnings: warnings.length,
        floorApplicable: prepared.pisoMinimo.aplicavel,
        belowMinimumFloor: prepared.pisoMinimo.abaixoDoPiso,
      },
      blockers,
      warnings,
      checklist: prepared.checklist,
      minimumFreightFloor: prepared.pisoMinimo,
      complementaryFields: prepared.fields,
      officialPayload: prepared.payload,
    };

    const currentPayload =
      prepared.ciot.payloadAntt &&
      typeof prepared.ciot.payloadAntt === "object" &&
      !Array.isArray(prepared.ciot.payloadAntt)
        ? (prepared.ciot.payloadAntt as Record<string, unknown>)
        : {};

    await prisma.ciot.update({
      where: { id: ciotId },
      data: {
        payloadAntt: {
          ...currentPayload,
          antt: {
            versaoDcs: "1.1",
            ambiente: env.ANTT_CIOT_ENVIRONMENT,
            camposComplementares: prepared.fields as any,
            declaracaoOperacaoTransporte: prepared.payload as any,
            pendencias: prepared.missing,
            pisoMinimo: prepared.pisoMinimo as any,
            checklist: prepared.checklist as any,
            ultimaSimulacao: report as any,
          },
        },
        preparadoEm: new Date(),
        status: blockers.length ? "RASCUNHO" : "PRONTO_ENVIO",
        mensagemRetorno: blockers.length
          ? `Simulação concluída com ${blockers.length} bloqueio(s): ${blockers.join(", ")}`
          : "Simulação concluída sem bloqueios. CIOT pronto para homologação.",
      },
    });

    return report;
  },

  async emit(ciotId: string, overrides: AnttCiotOverrides = {}) {
    if (!env.ANTT_CIOT_ENABLE_NETWORK) throw new Error("A emissão externa está desativada. Habilite somente no ambiente de homologação.");
    const prepared = await prepareOfficialPayload(ciotId, overrides);
    if (prepared.pisoMinimo.abaixoDoPiso) {
      throw new Error(`Frete abaixo do piso mínimo. Mínimo: R$ ${prepared.pisoMinimo.valorPiso?.toFixed(2)}; informado: R$ ${prepared.pisoMinimo.valorFrete.toFixed(2)}.`);
    }
    if (prepared.missing.length) throw new Error(`Campos obrigatórios pendentes: ${prepared.missing.join(", ")}`);

    await prisma.ciot.update({ where: { id: ciotId }, data: { status: "PROCESSANDO" } });
    try {
      const result: any = await postService(prepared.company, env.ANTT_CIOT_PATH_DECLARE, prepared.payload);
      const numeroCiot = digits(firstUseful(result?.CodigoIdentificacaoOperacao, result?.IdOperacaoTransporte, ""));
      const verifier = digits(result?.CodigoVerificador);
      const success = numeroCiot.length === 12 && verifier.length === 4;
      const messages = messagesFrom(result);
      const updated = await prisma.ciot.update({
        where: { id: ciotId },
        data: {
          status: success ? "AUTORIZADO" : "REJEITADO",
          numeroCiot: numeroCiot || null,
          codigoVerificador: verifier || null,
          protocolo: text(result?.Protocolo) || null,
          mensagemRetorno: [messages.join(" | "), text(result?.AvisoTransportador)].filter(Boolean).join(" | ") || JSON.stringify(result),
          payloadAntt: { antt: {
            versaoDcs: "1.1",
            ambiente: env.ANTT_CIOT_ENVIRONMENT,
            camposComplementares: prepared.fields as any,
            declaracaoOperacaoTransporte: prepared.payload as any,
            retornoDeclaracao: result,
          } },
        },
        include: { ctes: true },
      });
      return { item: updated, result, codes: codesFrom(result), success };
    } catch (error) {
      await prisma.ciot.update({
        where: { id: ciotId },
        data: { status: "REJEITADO", mensagemRetorno: error instanceof Error ? error.message : String(error) },
      });
      throw error;
    }
  },

  async query(ciotId: string) {
    const { ciot, company } = await loadAuthorizedCiot(ciotId);
    if (!env.ANTT_CIOT_ENABLE_NETWORK) throw new Error("A consulta externa está desativada.");
    const result: any = await postService(company, env.ANTT_CIOT_PATH_QUERY, {
      CodigoIdentificacaoOperacao: digits(ciot.numeroCiot),
      AnoDeclaracao: ciot.createdAt.getUTCFullYear(),
    });
    await prisma.ciot.update({
      where: { id: ciotId },
      data: {
        protocolo: text(result?.Protocolo) || ciot.protocolo,
        mensagemRetorno: messagesFrom(result).join(" | ") || ciot.mensagemRetorno,
        payloadAntt: { ...(ciot.payloadAntt as any ?? {}), ultimaConsulta: result },
      },
    });
    return result;
  },

  async cancel(ciotId: string, reason: string) {
    const { ciot, company, code } = await loadAuthorizedCiot(ciotId);
    if (!text(reason)) throw new Error("Informe o motivo do cancelamento.");
    if (!env.ANTT_CIOT_ENABLE_NETWORK) throw new Error("O cancelamento externo está desativado.");
    const result: any = await postService(company, env.ANTT_CIOT_PATH_CANCEL, {
      CodigoIdentificacaoOperacao: code,
      MotivoCancelamento: text(reason).slice(0, 500),
    });
    const success = Boolean(result?.DataCancelamento);
    const updated = await prisma.ciot.update({
      where: { id: ciotId },
      data: {
        status: success ? "CANCELADO" : ciot.status,
        protocolo: text(result?.Protocolo) || ciot.protocolo,
        mensagemRetorno: messagesFrom(result).join(" | ") || JSON.stringify(result),
        payloadAntt: { ...(ciot.payloadAntt as any ?? {}), retornoCancelamento: result },
      },
    });
    return { item: updated, result, success };
  },

  async rectify(ciotId: string, overrides: AnttCiotOverrides = {}) {
    const { ciot, company, code } = await loadAuthorizedCiot(ciotId);
    if (!env.ANTT_CIOT_ENABLE_NETWORK) throw new Error("A retificação externa está desativada.");
    const prepared = await prepareOfficialPayload(ciotId, overrides);
    const declaration: any = prepared.payload;
    const payload = {
      CodigoIdentificacaoOperacao: code,
      ValorFrete: numeric(ciot.valorFrete),
      ...(ciot.dataFim ? { DataFimViagem: ciot.dataFim.toISOString().slice(0, 10) } : {}),
      ...(ciot.tipoOperacao === "TAC_AGREGADO" ? {
        OrigemDestino: declaration.OrigemDestino,
        DadosCarga: declaration.DadosCarga,
      } : {}),
    };
    const result: any = await postService(company, env.ANTT_CIOT_PATH_RECTIFY, payload);
    const success = Boolean(result?.DataRetificacao);
    await prisma.ciot.update({
      where: { id: ciotId },
      data: {
        protocolo: text(result?.Protocolo) || ciot.protocolo,
        mensagemRetorno: messagesFrom(result).join(" | ") || JSON.stringify(result),
        payloadAntt: { ...(ciot.payloadAntt as any ?? {}), retornoRetificacao: result },
      },
    });
    return { result, success };
  },

  async close(ciotId: string, overrides: AnttCiotOverrides & { quantidadeViagens?: number } = {}) {
    const { ciot, company, code } = await loadAuthorizedCiot(ciotId);
    if (!env.ANTT_CIOT_ENABLE_NETWORK) throw new Error("O encerramento externo está desativado.");
    const payload: Record<string, unknown> = { CodigoIdentificacaoOperacao: code };
    if (ciot.tipoOperacao === "TAC_AGREGADO") {
      payload.OrigemDestino = [{
        Origem: locationObject("origem", overrides),
        Destino: locationObject("destino", overrides),
        DistanciaPercorrida: overrides.distanciaPercorrida,
        QtdViagens: overrides.quantidadeViagens,
      }];
    }
    if (ciot.tipoOperacao === "LOTACAO") payload.DadosCarga = { PesoTotalCarga: numeric(ciot.pesoKg) };
    const result: any = await postService(company, env.ANTT_CIOT_PATH_CLOSE, payload);
    const success = Boolean(result?.DataEncerramento);
    const updated = await prisma.ciot.update({
      where: { id: ciotId },
      data: {
        status: success ? "ENCERRADO" : ciot.status,
        protocolo: text(result?.Protocolo) || ciot.protocolo,
        mensagemRetorno: messagesFrom(result).join(" | ") || JSON.stringify(result),
        payloadAntt: { ...(ciot.payloadAntt as any ?? {}), retornoEncerramento: result },
      },
    });
    return { item: updated, result, success };
  },

  async exception(companyId?: string) {
    const company = await getCompany(companyId);
    if (!env.ANTT_CIOT_ENABLE_NETWORK) throw new Error("A consulta externa está desativada.");
    return getService(company, env.ANTT_CIOT_PATH_EXCEPTION, { CPFCNPJTransportador: digits(company.cnpj) });
  },
};
