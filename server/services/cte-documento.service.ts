import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  parseTagValue: false,
});

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function digits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function numberValue(value: unknown) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function findInfCte(root: any) {
  return (
    root?.cteProc?.CTe?.infCte ??
    root?.CTe?.infCte ??
    root?.infCte ??
    root?.procEventoCTe?.eventoCTe?.infEvento ??
    null
  );
}

function componentValue(vPrest: any, names: string[]) {
  const comps = asArray(vPrest?.Comp);
  const found = comps.find((comp: any) =>
    names.some((name) =>
      String(comp?.xNome ?? "")
        .toLowerCase()
        .includes(name.toLowerCase()),
    ),
  );
  return numberValue(found?.vComp);
}

export interface CteInterpretado {
  chave: string;
  numero: string;
  serie: string;
  emitenteCnpj: string;
  emitenteNome: string;
  emitenteNomeFantasia: string;
  emitenteInscricaoEstadual: string;
  emitenteEndereco: string;
  emitenteCidade: string;
  emitenteUf: string;
  remetenteCnpj: string;
  remetenteNome: string;
  destinatarioCnpj: string;
  destinatarioNome: string;
  destinatarioNomeFantasia: string;
  destinatarioInscricaoEstadual: string;
  destinatarioEndereco: string;
  destinatarioCidade: string;
  destinatarioUf: string;
  tomadorCnpj: string;
  tomadorNome: string;
  origemCidade: string;
  origemUf: string;
  origemCodigoIbge: string;
  origemCep: string;
  destinoCidade: string;
  destinoUf: string;
  destinoCodigoIbge: string;
  destinoCep: string;
  produto: string;
  ncm: string;
  pesoKg: number;
  valorMercadoria: number;
  valorFrete: number;
  valorPedagio: number;
  dataEmissao: string;
}

export function interpretarCteXml(xml: string): CteInterpretado {
  const root = parser.parse(xml);
  const infCte = findInfCte(root);

  if (!infCte) {
    throw new Error("O arquivo não contém uma estrutura válida de CT-e.");
  }

  const ide = infCte.ide ?? {};
  const emit = infCte.emit ?? {};
  const rem = infCte.rem ?? {};
  const dest = infCte.dest ?? {};
  const toma = infCte.toma4 ?? infCte.toma3 ?? {};
  const infCarga = infCte.infCTeNorm?.infCarga ?? {};
  const vPrest = infCte.vPrest ?? {};

  const infQ = asArray(infCarga.infQ);
  const peso =
    infQ.find((item: any) =>
      String(item?.cUnid ?? "").toUpperCase().includes("KG"),
    ) ??
    infQ.find((item: any) =>
      String(item?.tpMed ?? "").toLowerCase().includes("peso"),
    );

  const produtoPredominante = firstText(
    infCarga.proPred,
    infCte.infCTeNorm?.infDoc?.infNFe?.xNome,
  );

  const chave = digits(
    infCte["@_Id"] ??
      root?.cteProc?.protCTe?.infProt?.chCTe ??
      root?.protCTe?.infProt?.chCTe,
  ).replace(/^CTe/, "");

  const valorFrete =
    numberValue(vPrest.vTPrest) ||
    componentValue(vPrest, ["frete", "valor transporte"]);

  const valorPedagio = componentValue(vPrest, [
    "pedagio",
    "pedágio",
    "vale pedagio",
    "vale-pedágio",
  ]);

  const tomaCode = String(infCte.toma3?.toma ?? "");
  let tomador = toma;
  if (!infCte.toma4) {
    if (tomaCode === "0") tomador = rem;
    else if (tomaCode === "3") tomador = dest;
    else if (tomaCode === "4") tomador = infCte.receb ?? {};
  }

  return {
    chave,
    numero: String(ide.nCT ?? ""),
    serie: String(ide.serie ?? ""),
    emitenteCnpj: digits(emit.CNPJ ?? emit.CPF),
    emitenteNome: firstText(emit.xNome, emit.xFant),
    emitenteNomeFantasia: firstText(emit.xFant),
    emitenteInscricaoEstadual: firstText(emit.IE),
    emitenteEndereco: [
      firstText(emit.enderEmit?.xLgr),
      firstText(emit.enderEmit?.nro),
      firstText(emit.enderEmit?.xCpl),
      firstText(emit.enderEmit?.xBairro),
      firstText(emit.enderEmit?.CEP),
    ].filter(Boolean).join(", "),
    emitenteCidade: firstText(emit.enderEmit?.xMun),
    emitenteUf: firstText(emit.enderEmit?.UF).toUpperCase(),
    remetenteCnpj: digits(rem.CNPJ ?? rem.CPF),
    remetenteNome: firstText(rem.xNome, rem.xFant),
    destinatarioCnpj: digits(dest.CNPJ ?? dest.CPF),
    destinatarioNome: firstText(dest.xNome, dest.xFant),
    destinatarioNomeFantasia: firstText(dest.xFant),
    destinatarioInscricaoEstadual: firstText(dest.IE),
    destinatarioEndereco: [
      firstText(dest.enderDest?.xLgr),
      firstText(dest.enderDest?.nro),
      firstText(dest.enderDest?.xCpl),
      firstText(dest.enderDest?.xBairro),
      firstText(dest.enderDest?.CEP),
    ].filter(Boolean).join(", "),
    destinatarioCidade: firstText(dest.enderDest?.xMun),
    destinatarioUf: firstText(dest.enderDest?.UF).toUpperCase(),
    tomadorCnpj: digits(tomador.CNPJ ?? tomador.CPF),
    tomadorNome: firstText(tomador.xNome, tomador.xFant),
    origemCidade: firstText(ide.xMunIni, rem.enderReme?.xMun),
    origemUf: firstText(ide.UFIni, rem.enderReme?.UF).toUpperCase(),
    origemCodigoIbge: digits(firstText(ide.cMunIni, rem.enderReme?.cMun)),
    origemCep: digits(
      firstText(rem.enderReme?.CEP, emit.enderEmit?.CEP),
    ).slice(0, 8),
    destinoCidade: firstText(ide.xMunFim, dest.enderDest?.xMun),
    destinoUf: firstText(ide.UFFim, dest.enderDest?.UF).toUpperCase(),
    destinoCodigoIbge: digits(firstText(ide.cMunFim, dest.enderDest?.cMun)),
    destinoCep: digits(firstText(dest.enderDest?.CEP)).slice(0, 8),
    produto: produtoPredominante,
    ncm: firstText(infCarga.infQ?.NCM, infCarga.NCM),
    pesoKg: numberValue(peso?.qCarga),
    valorMercadoria: numberValue(infCarga.vCarga),
    valorFrete,
    valorPedagio,
    dataEmissao: String(ide.dhEmi ?? ide.dEmi ?? "").slice(0, 10),
  };
}
