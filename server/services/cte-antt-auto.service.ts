type AutoCteInput = {
  origemCidade: string;
  origemUf: string;
  destinoCidade: string;
  destinoUf: string;
  origemCodigoIbge?: string;
  destinoCodigoIbge?: string;
  origemCep?: string;
  destinoCep?: string;
  produto?: string;
  ncm?: string;
};

type Coordinate = { latitude: number; longitude: number };

const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "");

const normalize = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

async function fetchJson<T>(url: string, timeoutMs = 15_000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "Radasa-System/1.0 (CIOT route enrichment)",
      },
    });

    if (!response.ok) {
      throw new Error(`Serviço externo respondeu HTTP ${response.status}.`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function findIbgeCode(city: string, uf: string) {
  if (!city || !uf) return "";

  type Municipality = { id: number; nome: string };
  const items = await fetchJson<Municipality[]>(
    `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${encodeURIComponent(
      uf,
    )}/municipios`,
  );

  const target = normalize(city);
  const match =
    items.find((item) => normalize(item.nome) === target) ??
    items.find(
      (item) =>
        normalize(item.nome).includes(target) ||
        target.includes(normalize(item.nome)),
    );

  return match ? String(match.id) : "";
}

async function geocodeLocation(
  city: string,
  uf: string,
  cep?: string,
): Promise<Coordinate | null> {
  const params = new URLSearchParams({
    format: "jsonv2",
    limit: "1",
    countrycodes: "br",
  });

  if (digits(cep).length === 8) {
    params.set("postalcode", digits(cep));
    params.set("state", uf);
    params.set("country", "Brazil");
  } else {
    params.set("city", city);
    params.set("state", uf);
    params.set("country", "Brazil");
  }

  type NominatimItem = { lat: string; lon: string };
  const items = await fetchJson<NominatimItem[]>(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
  );

  const first = items[0];
  if (!first) return null;

  const latitude = Number(first.lat);
  const longitude = Number(first.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return { latitude, longitude };
}

async function calculateRoadDistanceKm(
  origin: Coordinate,
  destination: Coordinate,
) {
  type OsrmResponse = {
    code?: string;
    routes?: Array<{ distance?: number; duration?: number }>;
  };

  const coordinates = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  const result = await fetchJson<OsrmResponse>(
    `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=false&alternatives=false&steps=false`,
    25_000,
  );

  const meters = Number(result.routes?.[0]?.distance ?? 0);
  return meters > 0 ? Math.round(meters / 1000) : 0;
}

function inferCargoType(product: string, ncm: string) {
  const value = normalize(`${product} ${ncm}`);

  const dangerous =
    /PERIG|INFLAM|COMBUST|GASLIQUEFEITO|GLP|EXPLOS|TOXIC|CORROS/.test(value);

  if (/CONTAINER|CONTEINER/.test(value)) return dangerous ? 10 : 4;
  if (/FRIGOR|REFRIG|CONGEL|RESFRI|AQUECID/.test(value)) return dangerous ? 9 : 3;
  if (/PRESSUR|CILINDRO|GASGRANEL/.test(value)) return 12;
  if (/LIQUID|OLEO|ETANOL|DIESEL|GASOLINA|ALCOOL/.test(value)) {
    return dangerous ? 8 : 2;
  }
  if (/GRAO|SOJA|MILHO|TRIGO|AREIA|MINERIO|CALCARIO|GRANEL SOLID/.test(value)) {
    return dangerous ? 7 : 1;
  }
  if (/VEICULO|MAQUINA|TRATOR|BOBINA|TORAS|NEOGRANEL/.test(value)) return 6;

  return dangerous ? 11 : 5;
}

function inferNatureCode(product: string, ncm: string) {
  const normalizedNcm = digits(ncm);
  if (normalizedNcm.length >= 4) return normalizedNcm.slice(0, 4);

  const value = normalize(product);
  if (/VASILHAME|GARRAFAO|BOTIJAO|RECIPIENTE/.test(value)) return "2201";
  if (/COMBUST|DIESEL|GASOLINA|ETANOL/.test(value)) return "2710";
  if (/GLP|GASLIQUEFEITO/.test(value)) return "2711";

  return "2201";
}

export async function completarDadosAnttCte(input: AutoCteInput) {
  const warnings: string[] = [];

  let codigoMunicipioOrigem = digits(input.origemCodigoIbge);
  let codigoMunicipioDestino = digits(input.destinoCodigoIbge);

  if (codigoMunicipioOrigem.length !== 7) {
    try {
      codigoMunicipioOrigem = await findIbgeCode(
        input.origemCidade,
        input.origemUf,
      );
    } catch {
      warnings.push("Não foi possível consultar o código IBGE da origem.");
    }
  }

  if (codigoMunicipioDestino.length !== 7) {
    try {
      codigoMunicipioDestino = await findIbgeCode(
        input.destinoCidade,
        input.destinoUf,
      );
    } catch {
      warnings.push("Não foi possível consultar o código IBGE do destino.");
    }
  }

  let distanciaPercorrida = 0;
  let origemCoordenadas: Coordinate | null = null;
  let destinoCoordenadas: Coordinate | null = null;

  try {
    [origemCoordenadas, destinoCoordenadas] = await Promise.all([
      geocodeLocation(input.origemCidade, input.origemUf, input.origemCep),
      geocodeLocation(input.destinoCidade, input.destinoUf, input.destinoCep),
    ]);

    if (origemCoordenadas && destinoCoordenadas) {
      distanciaPercorrida = await calculateRoadDistanceKm(
        origemCoordenadas,
        destinoCoordenadas,
      );
    }
  } catch {
    warnings.push("Não foi possível calcular automaticamente a distância rodoviária.");
  }

  return {
    codigoMunicipioOrigem,
    codigoMunicipioDestino,
    cepOrigem: digits(input.origemCep).slice(0, 8),
    cepDestino: digits(input.destinoCep).slice(0, 8),
    distanciaPercorrida,
    codigoTipoCarga: inferCargoType(input.produto ?? "", input.ncm ?? ""),
    codigoNaturezaCarga: inferNatureCode(input.produto ?? "", input.ncm ?? ""),
    origemCoordenadas,
    destinoCoordenadas,
    warnings,
  };
}
