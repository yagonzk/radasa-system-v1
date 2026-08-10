import { LOCAL_TOLL_PLAZAS, NATIONAL_TOLL_BASE_META, type LocalTollPlaza } from "../data/pedagios-brasil.js";
import { listPedagios } from "./pedagios-storage.service.js";

export type PedagioVehicleType =
  | "TRUCK_WITH_TWO_SINGLE_AXIS"
  | "TRUCK_WITH_THREE_DOUBLE_AXLES"
  | "TRUCK_WITH_FOUR_DOUBLE_AXLES"
  | "TRUCK_WITH_FIVE_DOUBLE_AXLES"
  | "TRUCK_WITH_SIX_DOUBLE_AXLES"
  | "TRUCK_WITH_SEVEN_DOUBLE_AXLES"
  | "TRUCK_WITH_EIGHT_DOUBLE_AXLES"
  | "TRUCK_WITH_NINE_DOUBLE_AXLES"
  | "TRUCK_WITH_TEN_DOUBLE_AXLES";

type RoutePoint = { latitude: number; longitude: number };
type CityInput = { name: string; uf: string };

type TollResult = {
  id: string;
  type: string;
  name: string;
  address: string;
  city: string;
  state: { name: string; code: string };
  concession: string;
  coordinates: RoutePoint;
  price: number | null;
  hasTariff: boolean;
  currency: string;
  serviceTypes: Array<{ serviceId?: string; name?: string }>;
  road: string;
  km?: string;
  distanceFromOriginKm: number;
  sourceUrl: string;
  tariffUpdatedAt: string;
};

function axesFromVehicleType(type: PedagioVehicleType) {
  const map: Record<PedagioVehicleType, number> = {
    TRUCK_WITH_TWO_SINGLE_AXIS: 2,
    TRUCK_WITH_THREE_DOUBLE_AXLES: 3,
    TRUCK_WITH_FOUR_DOUBLE_AXLES: 4,
    TRUCK_WITH_FIVE_DOUBLE_AXLES: 5,
    TRUCK_WITH_SIX_DOUBLE_AXLES: 6,
    TRUCK_WITH_SEVEN_DOUBLE_AXLES: 7,
    TRUCK_WITH_EIGHT_DOUBLE_AXLES: 8,
    TRUCK_WITH_NINE_DOUBLE_AXLES: 9,
    TRUCK_WITH_TEN_DOUBLE_AXLES: 10,
  };
  return map[type];
}

function priceForAxes(plaza: LocalTollPlaza, axes: number): number | null {
  if (plaza.pricing.kind === "UNKNOWN") return null;
  if (plaza.pricing.kind === "PER_AXLE") {
    const value = plaza.pricing.perAxle * axes;
    return plaza.pricing.maxPrice ? Math.min(value, plaza.pricing.maxPrice) : value;
  }
  const exact = plaza.pricing.values[axes];
  if (typeof exact === "number") return exact;
  if (axes >= 9 && typeof plaza.pricing.nineOrMore === "number") return plaza.pricing.nineOrMore;
  return null;
}

function haversineKm(a: RoutePoint, b: RoutePoint) {
  const radius = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function nearestRoutePoint(route: RoutePoint[], target: RoutePoint) {
  let minDistanceKm = Number.POSITIVE_INFINITY;
  let nearestIndex = -1;
  let distanceFromOriginKm = 0;
  let traveledKm = 0;
  for (let index = 0; index < route.length; index += 1) {
    if (index > 0) traveledKm += haversineKm(route[index - 1], route[index]);
    const distanceKm = haversineKm(route[index], target);
    if (distanceKm < minDistanceKm) {
      minDistanceKm = distanceKm;
      nearestIndex = index;
      distanceFromOriginKm = traveledKm;
    }
  }
  return { minDistanceKm, nearestIndex, distanceFromOriginKm, nearestPoint: nearestIndex >= 0 ? route[nearestIndex] : null };
}

function normalizeRoute(points: RoutePoint[]) {
  return points.filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude)
    && point.latitude >= -90 && point.latitude <= 90 && point.longitude >= -180 && point.longitude <= 180);
}

function isStateRelevant(plaza: LocalTollPlaza, origin: CityInput, destination: CityInput) {
  const originUf = origin.uf.trim().toUpperCase();
  const destinationUf = destination.uf.trim().toUpperCase();
  return originUf !== destinationUf || !plaza.stateCode || plaza.stateCode === originUf;
}

function normalize(value = "") {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}


function sameCity(value: string, expected: string) {
  return normalize(value) === normalize(expected);
}

function endpointHintMatch(plaza: LocalTollPlaza, origin: CityInput, destination: CityInput) {
  const hint = plaza.routeHint;
  if (!hint) return false;
  return (sameCity(origin.name, hint.cityA) && sameCity(destination.name, hint.cityB))
    || (sameCity(origin.name, hint.cityB) && sameCity(destination.name, hint.cityA));
}

function pointAtDistanceFromRouteEnd(route: RoutePoint[], distanceKm: number, fromEnd: boolean) {
  if (!route.length) return { index: -1, point: null as RoutePoint | null, distanceFromOriginKm: 0 };
  let traveled = 0;
  if (!fromEnd) {
    for (let i = 1; i < route.length; i += 1) {
      traveled += haversineKm(route[i - 1], route[i]);
      if (traveled >= distanceKm) return { index: i, point: route[i], distanceFromOriginKm: traveled };
    }
    return { index: route.length - 1, point: route[route.length - 1], distanceFromOriginKm: traveled };
  }
  for (let i = route.length - 1; i > 0; i -= 1) {
    traveled += haversineKm(route[i], route[i - 1]);
    if (traveled >= distanceKm) {
      const total = route.reduce((sum, point, idx) => idx ? sum + haversineKm(route[idx - 1], point) : sum, 0);
      return { index: i - 1, point: route[i - 1], distanceFromOriginKm: Math.max(0, total - traveled) };
    }
  }
  return { index: 0, point: route[0], distanceFromOriginKm: 0 };
}

function likelySamePhysicalPlaza(a: LocalTollPlaza, b: LocalTollPlaza) {
  const distance = haversineKm(a, b);
  if (distance > 2.5) return false;
  return normalize(a.name) === normalize(b.name)
    || (normalize(a.road) && normalize(a.road) === normalize(b.road))
    || (normalize(a.concession) && normalize(a.concession) === normalize(b.concession));
}

async function loadDatabaseTolls(): Promise<LocalTollPlaza[]> {
  try {
    const rows = (await listPedagios(true)).filter((row) => row.fonte === "MANUAL");
    return rows.map((row) => ({
      id: `db-${row.id}`,
      name: row.nome,
      road: row.rodovia,
      km: row.km || undefined,
      city: row.cidade,
      stateCode: row.uf.toUpperCase(),
      concession: row.concessionaria,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      matchRadiusKm: Number(row.raioKm),
      pricing: { kind: "PER_AXLE", perAxle: Number(row.valorPorEixo) },
      sourceUrl: "Base manual Radasa",
      tariffUpdatedAt: new Date(row.updatedAt).toISOString().slice(0, 10),
      sourceKind: "MANUAL",
    }));
  } catch (error) {
    // A base automática nacional não deve parar de funcionar se a tabela de
    // ajustes manuais estiver indisponível. O erro continua aparecendo ao
    // tentar salvar/editar, mas o cálculo da rota permanece operacional.
    console.error("[pedagios] Falha ao carregar ajustes manuais; usando base automática.", error);
    return [];
  }
}

async function getEffectiveTolls() {
  const database = await loadDatabaseTolls();
  const combined = [...database, ...LOCAL_TOLL_PLAZAS];
  return combined.reduce<LocalTollPlaza[]>((acc, plaza) => {
    const duplicate = acc.findIndex((item) => item.id === plaza.id || likelySamePhysicalPlaza(item, plaza));
    if (duplicate < 0) acc.push(plaza);
    // A base manual do banco sempre prevalece sobre snapshots automáticos.
    else if (plaza.sourceKind === "MANUAL" && acc[duplicate].sourceKind !== "MANUAL") acc[duplicate] = plaza;
    return acc;
  }, []);
}

export async function calculateTolls(input: {
  points?: RoutePoint[];
  origin: CityInput;
  destination: CityInput;
  vehicleType: PedagioVehicleType;
  billingType?: "NORMAL" | "TAG";
  calculationDate?: number;
}) {
  const route = normalizeRoute(input.points ?? []);
  if (route.length < 2) {
    throw Object.assign(new Error("A geometria da rota é necessária para localizar os pedágios."), { code: "LOCAL_TOLLS_ROUTE_REQUIRED" });
  }

  const plazas = await getEffectiveTolls();
  const axes = axesFromVehicleType(input.vehicleType);
  const rawMatches = plazas
    .filter((plaza) => isStateRelevant(plaza, input.origin, input.destination))
    .map((plaza) => {
      if (endpointHintMatch(plaza, input.origin, input.destination) && plaza.routeHint) {
        const originIsCityA = sameCity(input.origin.name, plaza.routeHint.cityA);
        const hinted = pointAtDistanceFromRouteEnd(route, plaza.routeHint.kmFromCityA, !originIsCityA);
        return {
          plaza: hinted.point ? { ...plaza, latitude: hinted.point.latitude, longitude: hinted.point.longitude } : plaza,
          minDistanceKm: 0,
          nearestIndex: hinted.index,
          distanceFromOriginKm: hinted.distanceFromOriginKm,
          nearestPoint: hinted.point,
          effectiveRadiusKm: 0.1,
          matchedByRouteHint: true,
        };
      }
      const nearest = nearestRoutePoint(route, { latitude: plaza.latitude, longitude: plaza.longitude });
      const effectiveRadiusKm = Math.min(Math.max(plaza.matchRadiusKm || 1.5, 0.2), plaza.sourceKind === "MANUAL" ? 3 : 2.2);
      return { plaza, ...nearest, effectiveRadiusKm, matchedByRouteHint: false };
    })
    .filter(({ minDistanceKm, effectiveRadiusKm, matchedByRouteHint }) => matchedByRouteHint || minDistanceKm <= effectiveRadiusKm)
    .sort((a, b) => a.distanceFromOriginKm - b.distanceFromOriginKm);

  const matches = rawMatches.reduce<typeof rawMatches>((acc, candidate) => {
    const duplicateIndex = acc.findIndex((existing) =>
      Math.abs(existing.distanceFromOriginKm - candidate.distanceFromOriginKm) <= 1.8
      && haversineKm(existing.plaza, candidate.plaza) <= 2.5,
    );
    if (duplicateIndex < 0) acc.push(candidate);
    else {
      const score = (item: typeof candidate) => (item.plaza.pricing.kind !== "UNKNOWN" ? 100 : 0)
        + (item.plaza.sourceKind === "MANUAL" ? 50 : item.plaza.sourceKind === "ANTT" ? 20 : 10)
        - item.minDistanceKm;
      if (score(candidate) > score(acc[duplicateIndex])) acc[duplicateIndex] = candidate;
    }
    return acc;
  }, []).sort((a, b) => a.distanceFromOriginKm - b.distanceFromOriginKm);

  const tolls: TollResult[] = matches.map(({ plaza, distanceFromOriginKm, nearestPoint }) => {
    const rawPrice = priceForAxes(plaza, axes);
    // A coordenada cadastrada serve para identificar a praça. Para desenhar o marcador,
    // usamos o ponto mais próximo da própria geometria OSRM. Assim um cadastro com
    // pequena imprecisão nunca aparece visualmente fora da estrada percorrida.
    const displayPoint = nearestPoint ?? { latitude: plaza.latitude, longitude: plaza.longitude };
    return {
      id: plaza.id,
      type: "TOLL_BOOTH",
      name: plaza.name,
      address: [plaza.road, plaza.km ? `km ${plaza.km}` : ""].filter(Boolean).join(", "),
      city: plaza.city,
      state: { name: plaza.stateCode, code: plaza.stateCode },
      concession: plaza.concession,
      coordinates: { latitude: displayPoint.latitude, longitude: displayPoint.longitude },
      price: rawPrice == null ? null : Math.round(rawPrice * 100) / 100,
      hasTariff: rawPrice != null,
      currency: "BRL",
      serviceTypes: [],
      road: plaza.road,
      km: plaza.km,
      distanceFromOriginKm: Math.round(distanceFromOriginKm * 10) / 10,
      sourceUrl: plaza.sourceUrl,
      tariffUpdatedAt: plaza.tariffUpdatedAt,
    };
  });

  const subtotal = tolls.reduce((sum, toll) => sum + (toll.price ?? 0), 0);
  return {
    configured: true,
    authenticated: true,
    provider: "Base própria Radasa",
    axes,
    billingType: input.billingType ?? "NORMAL",
    totalCost: Math.round(subtotal * 100) / 100,
    unpricedTolls: tolls.filter((toll) => !toll.hasTariff).length,
    tolls,
  };
}

export async function pedagiosProviderStatus() {
  const plazas = await getEffectiveTolls();
  const latestUpdate = plazas.reduce((latest, plaza) => plaza.tariffUpdatedAt > latest ? plaza.tariffUpdatedAt : latest, "");
  const manual = plazas.filter((p) => p.sourceKind === "MANUAL").length;
  return {
    configured: true,
    authenticated: true,
    provider: "Base própria Radasa",
    message: `${plazas.length} praças disponíveis (${manual} manuais). Sem consumo de créditos por consulta.`,
    plazas: plazas.length,
    manual,
    federalAntt: NATIONAL_TOLL_BASE_META.federalAntt,
    estaduais: plazas.filter((p) => p.sourceKind === "STATE").length,
    osmSupplemental: NATIONAL_TOLL_BASE_META.osmSupplemental,
    priced: plazas.filter((p) => p.pricing.kind !== "UNKNOWN").length,
    unpriced: plazas.filter((p) => p.pricing.kind === "UNKNOWN").length,
    generatedAt: NATIONAL_TOLL_BASE_META.generatedAt,
    latestUpdate,
  };
}
