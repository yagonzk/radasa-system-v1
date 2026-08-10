import { GENERATED_TOLL_PLAZAS, GENERATED_TOLL_META } from "./pedagios-nacional.generated";

export type TollPricingRule =
  | { kind: "PER_AXLE"; perAxle: number; maxPrice?: number }
  | { kind: "BY_AXLES"; values: Record<number, number>; nineOrMore?: number }
  | { kind: "UNKNOWN" };

export interface LocalTollPlaza {
  id: string;
  name: string;
  road: string;
  km?: string;
  city: string;
  stateCode: string;
  concession: string;
  latitude: number;
  longitude: number;
  /** Distância máxima entre a geometria da rota e a praça para considerá-la atravessada. */
  matchRadiusKm: number;
  pricing: TollPricingRule;
  sourceUrl: string;
  tariffUpdatedAt: string;
  sourceKind?: "MANUAL" | "ANTT" | "OSM" | "STATE";
  /** Regra opcional para praças estaduais cuja referência oficial é dada por KM do trecho. */
  routeHint?: { cityA: string; cityB: string; kmFromCityA: number };
}

/**
 * Base própria do Radasa.
 *
 * Não existe chamada a API comercial para descobrir ou precificar os pedágios.
 * A rota (OSRM no navegador) é cruzada geometricamente com esta base no backend.
 *
 * Fontes oficiais verificadas em 08/08/2026:
 * - APASI: https://www.apasi.com.br/tarifas/
 * - Nova Rota do Oeste: https://novarotadooeste.com.br/tarifas/
 * - Localização/km das nove praças da Nova Rota: Carta de Serviços da concessionária.
 *
 * IMPORTANTE: as coordenadas são pontos operacionais de referência próximos às praças.
 * A validação final usa proximidade com a geometria real calculada pelo OSRM, e não
 * origem/destino por nome de cidade. Isso evita cobrar uma praça que a rota não cruza.
 */
export const MANUAL_TOLL_PLAZAS: LocalTollPlaza[] = [
  {
    id: "mt-apasi-mt242-sorriso",
    name: "Pedágio APASI - MT-242",
    road: "MT-242",
    km: "11",
    city: "Sorriso",
    stateCode: "MT",
    concession: "APASI",
    // Coordenadas apenas como referência de busca. O marcador exibido é encaixado na geometria real do OSRM.
    latitude: -12.5060,
    longitude: -55.7700,
    matchRadiusKm: 2.0,
    pricing: {
      kind: "BY_AXLES",
      values: { 2: 28, 3: 42, 4: 56, 5: 70, 6: 84, 7: 98, 8: 112 },
      nineOrMore: 126,
    },
    sourceUrl: "https://www.apasi.com.br/tarifas/",
    tariffUpdatedAt: "2026-08-09",
    sourceKind: "STATE",
    routeHint: { cityA: "Sorriso", cityB: "Ipiranga do Norte", kmFromCityA: 11 },
  },

  // Nova Rota do Oeste — 9 praças da BR-163/364 em MT.
  // A tarifa comercial é cobrada por eixo em cada praça.
  {
    id: "mt-nro-p01-itiquira",
    name: "P1 Itiquira",
    road: "BR-163",
    km: "33,6",
    city: "Itiquira",
    stateCode: "MT",
    concession: "Nova Rota do Oeste",
    latitude: -17.199,
    longitude: -54.147,
    matchRadiusKm: 12,
    pricing: { kind: "PER_AXLE", perAxle: 6.6 },
    sourceUrl: "https://novarotadooeste.com.br/tarifas/",
    tariffUpdatedAt: "2026-08-08",
  },
  {
    id: "mt-nro-p02-rondonopolis",
    name: "P2 Rondonópolis",
    road: "BR-163/364",
    km: "133,3",
    city: "Rondonópolis",
    stateCode: "MT",
    concession: "Nova Rota do Oeste",
    latitude: -16.466,
    longitude: -54.637,
    matchRadiusKm: 17,
    pricing: { kind: "PER_AXLE", perAxle: 7.5 },
    sourceUrl: "https://novarotadooeste.com.br/tarifas/",
    tariffUpdatedAt: "2026-08-08",
  },
  {
    id: "mt-nro-p03-campo-verde",
    name: "P3 Campo Verde",
    road: "BR-163/364",
    km: "235,4",
    city: "Campo Verde",
    stateCode: "MT",
    concession: "Nova Rota do Oeste",
    latitude: -15.545,
    longitude: -55.162,
    matchRadiusKm: 20,
    pricing: { kind: "PER_AXLE", perAxle: 6 },
    sourceUrl: "https://novarotadooeste.com.br/tarifas/",
    tariffUpdatedAt: "2026-08-08",
  },
  {
    id: "mt-nro-p04-santo-antonio-leverger",
    name: "P4 Sto. Antônio de Leverger",
    road: "BR-163/364",
    km: "302",
    city: "Santo Antônio de Leverger",
    stateCode: "MT",
    concession: "Nova Rota do Oeste",
    latitude: -15.865,
    longitude: -56.076,
    matchRadiusKm: 18,
    pricing: { kind: "PER_AXLE", perAxle: 6 },
    sourceUrl: "https://novarotadooeste.com.br/tarifas/",
    tariffUpdatedAt: "2026-08-08",
  },
  {
    id: "mt-nro-p05-jangada",
    name: "P5 Jangada",
    road: "BR-163/364",
    km: "398",
    city: "Jangada",
    stateCode: "MT",
    concession: "Nova Rota do Oeste",
    latitude: -15.235,
    longitude: -56.491,
    matchRadiusKm: 18,
    pricing: { kind: "PER_AXLE", perAxle: 8.1 },
    sourceUrl: "https://novarotadooeste.com.br/tarifas/",
    tariffUpdatedAt: "2026-08-08",
  },
  {
    id: "mt-nro-p06-nobres-diamantino",
    name: "P6 Nobres / Diamantino",
    road: "BR-163/364",
    km: "498",
    city: "Diamantino",
    stateCode: "MT",
    concession: "Nova Rota do Oeste",
    latitude: -14.408,
    longitude: -56.446,
    matchRadiusKm: 22,
    pricing: { kind: "PER_AXLE", perAxle: 6.7 },
    sourceUrl: "https://novarotadooeste.com.br/tarifas/",
    tariffUpdatedAt: "2026-08-08",
  },
  {
    id: "mt-nro-p07-nova-mutum",
    name: "P7 Nova Mutum",
    road: "BR-163",
    km: "586,9",
    city: "Nova Mutum",
    stateCode: "MT",
    concession: "Nova Rota do Oeste",
    latitude: -13.84,
    longitude: -56.074,
    matchRadiusKm: 14,
    pricing: { kind: "PER_AXLE", perAxle: 5.4 },
    sourceUrl: "https://novarotadooeste.com.br/tarifas/",
    tariffUpdatedAt: "2026-08-08",
  },
  {
    id: "mt-nro-p08-lucas-rio-verde",
    name: "P8 Lucas do Rio Verde",
    road: "BR-163",
    km: "664,4",
    city: "Lucas do Rio Verde",
    stateCode: "MT",
    concession: "Nova Rota do Oeste",
    latitude: -13.058,
    longitude: -55.904,
    matchRadiusKm: 13,
    pricing: { kind: "PER_AXLE", perAxle: 7.1 },
    sourceUrl: "https://novarotadooeste.com.br/tarifas/",
    tariffUpdatedAt: "2026-08-08",
  },
  {
    id: "mt-nro-p09-sorriso",
    name: "P9 Sorriso",
    road: "BR-163",
    km: "766,7",
    city: "Sorriso",
    stateCode: "MT",
    concession: "Nova Rota do Oeste",
    latitude: -12.43953,
    longitude: -55.6500,
    matchRadiusKm: 10,
    pricing: { kind: "PER_AXLE", perAxle: 10.4 },
    sourceUrl: "https://novarotadooeste.com.br/tarifas/",
    tariffUpdatedAt: "2026-08-08",
  },
];


/** Base efetivamente usada pelo calculador.
 * Praças manuais prevalecem sobre registros sincronizados quando houver o mesmo id.
 */
function tollDistanceKm(a: Pick<LocalTollPlaza, "latitude" | "longitude">, b: Pick<LocalTollPlaza, "latitude" | "longitude">) {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function normalizeTollText(value = "") {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function roadKey(value = "") {
  const normalized = normalizeTollText(value);
  const match = normalized.match(/(?:br|mt|sp|pr|sc|rs|mg|go|ba|es|rj|ms|ro|pa)[ -]?(\d{2,4})/i);
  return match ? match[0].replace(/\s+/g, "") : normalized;
}

function likelySamePhysicalPlaza(a: LocalTollPlaza, b: LocalTollPlaza) {
  const distance = tollDistanceKm(a, b);
  if (distance > 3.5) return false;
  const sameRoad = roadKey(a.road) && roadKey(a.road) === roadKey(b.road);
  const sameConcession = normalizeTollText(a.concession) && normalizeTollText(a.concession) === normalizeTollText(b.concession);
  const sameName = normalizeTollText(a.name) && normalizeTollText(a.name) === normalizeTollText(b.name);
  // Fontes nacionais/OSM frequentemente trazem um ponto por sentido da mesma praça.
  // Proximidade + rodovia/concessionária/nome evita contar esses pontos como pedágios distintos.
  return Boolean(sameRoad || sameConcession || sameName);
}

function sourcePriority(plaza: LocalTollPlaza) {
  const priced = plaza.pricing.kind !== "UNKNOWN" ? 100 : 0;
  const source = plaza.sourceKind === "MANUAL" ? 30 : plaza.sourceKind === "ANTT" ? 20 : plaza.sourceKind === "STATE" ? 15 : 10;
  return priced + source;
}

/** Base efetivamente usada pelo calculador.
 * Registros da mesma praça física são consolidados, inclusive quando ANTT/OSM
 * possuem um ponto para cada sentido da rodovia.
 */
const combinedTolls: LocalTollPlaza[] = [
  ...MANUAL_TOLL_PLAZAS.map((plaza) => ({ ...plaza, sourceKind: plaza.sourceKind ?? "MANUAL" as const })),
  ...GENERATED_TOLL_PLAZAS,
];

export const LOCAL_TOLL_PLAZAS: LocalTollPlaza[] = combinedTolls.reduce<LocalTollPlaza[]>((acc, plaza) => {
  const duplicateIndex = acc.findIndex((existing) => existing.id === plaza.id || likelySamePhysicalPlaza(existing, plaza));
  if (duplicateIndex < 0) {
    acc.push(plaza);
    return acc;
  }
  if (sourcePriority(plaza) > sourcePriority(acc[duplicateIndex])) acc[duplicateIndex] = plaza;
  return acc;
}, []);

export const NATIONAL_TOLL_BASE_META = GENERATED_TOLL_META;
