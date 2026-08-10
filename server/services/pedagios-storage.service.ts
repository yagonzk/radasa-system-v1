import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { LOCAL_TOLL_PLAZAS, type LocalTollPlaza } from "../data/pedagios-brasil.js";

const ACTION = "PEDAGIO_CADASTRO";
const METHOD = "CONFIG";
const ENTITY_PREFIX = "PEDAGIO:";
let materializePromise: Promise<void> | null = null;

export type PedagioDbRow = {
  id: string;
  nome: string;
  rodovia: string;
  km: string;
  cidade: string;
  uf: string;
  concessionaria: string;
  latitude: unknown;
  longitude: unknown;
  raioKm: unknown;
  valorPorEixo: unknown;
  ativo: boolean;
  fonte: string;
  observacoes: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type PedagioDbInput = {
  nome: string;
  rodovia: string;
  km: string;
  cidade: string;
  uf: string;
  concessionaria: string;
  latitude: number;
  longitude: number;
  raioKm: number;
  valorPorEixo: number;
  ativo: boolean;
  observacoes?: string | null;
};

type StoredToll = Omit<PedagioDbRow, "latitude" | "longitude" | "raioKm" | "valorPorEixo" | "createdAt" | "updatedAt"> & {
  latitude: number;
  longitude: number;
  raioKm: number;
  valorPorEixo: number;
  createdAt?: string;
  updatedAt?: string;
  deleted?: boolean;
};

type LogRow = { entityId: string | null; path: string; createdAt: Date | string };

function entityId(id: string) { return `${ENTITY_PREFIX}${id}`; }

function parseStored(log: LogRow): PedagioDbRow | null {
  try {
    const data = JSON.parse(log.path) as StoredToll;
    if (!data || data.deleted || !data.id || !data.nome) return null;
    const timestamp = new Date(log.createdAt).toISOString();
    return {
      id: data.id,
      nome: data.nome,
      rodovia: data.rodovia ?? "",
      km: data.km ?? "",
      cidade: data.cidade ?? "",
      uf: data.uf ?? "",
      concessionaria: data.concessionaria ?? "",
      latitude: Number(data.latitude),
      longitude: Number(data.longitude),
      raioKm: Number(data.raioKm ?? 1.5),
      valorPorEixo: Number(data.valorPorEixo ?? 0),
      ativo: data.ativo !== false,
      fonte: data.fonte || "MANUAL",
      observacoes: data.observacoes ?? null,
      createdAt: data.createdAt || timestamp,
      updatedAt: data.updatedAt || timestamp,
    };
  } catch {
    return null;
  }
}

async function latestLogs(): Promise<LogRow[]> {
  return prisma.$queryRawUnsafe<LogRow[]>(`
    SELECT DISTINCT ON ("entityId") "entityId", "path", "createdAt"
      FROM "audit_logs"
     WHERE "action" = $1
       AND "entityId" LIKE $2
     ORDER BY "entityId", "createdAt" DESC
  `, ACTION, `${ENTITY_PREFIX}%`);
}

function editablePerAxle(plaza: LocalTollPlaza): number {
  if (plaza.pricing.kind === "PER_AXLE") return Number(plaza.pricing.perAxle || 0);
  if (plaza.pricing.kind === "UNKNOWN") return 0;
  const entries = Object.entries(plaza.pricing.values || {})
    .map(([axes, price]) => [Number(axes), Number(price)] as const)
    .filter(([axes, price]) => axes > 0 && Number.isFinite(price) && price >= 0)
    .sort((a, b) => a[0] - b[0]);
  const preferred = entries.find(([axes]) => axes === 2) ?? entries[0];
  return preferred ? Number((preferred[1] / preferred[0]).toFixed(2)) : 0;
}

function automaticPayload(plaza: LocalTollPlaza): StoredToll {
  const now = new Date().toISOString();
  return {
    id: plaza.id,
    nome: plaza.name,
    rodovia: plaza.road || "",
    km: plaza.km || "",
    cidade: plaza.city || "",
    uf: plaza.stateCode || "",
    concessionaria: plaza.concession || "",
    latitude: Number(plaza.latitude),
    longitude: Number(plaza.longitude),
    raioKm: Number(plaza.matchRadiusKm || 1.5),
    valorPorEixo: editablePerAxle(plaza),
    ativo: true,
    fonte: plaza.sourceKind || "BASE",
    observacoes: `Registro materializado da base automática Radasa. Fonte: ${plaza.sourceUrl || plaza.sourceKind || "base local"}.`,
    createdAt: now,
    updatedAt: now,
  };
}

async function appendVersion(userId: string, payload: StoredToll) {
  await prisma.$executeRawUnsafe(`
    INSERT INTO "audit_logs" ("id", "userId", "action", "method", "path", "entityId", "createdAt")
    VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
  `, randomUUID(), userId, ACTION, METHOD, JSON.stringify(payload), entityId(payload.id));
}

/**
 * Materializa a base automática em uma tabela que já existe e já é gravável
 * pelo usuário da aplicação (audit_logs). Não cria/alterar schema e não exige
 * migration. Os registros automáticos servem para edição; só passam a
 * sobrescrever o cálculo quando o usuário salva uma alteração (fonte MANUAL).
 */
export async function materializeAutomaticPedagios(userId: string): Promise<void> {
  if (materializePromise) return materializePromise;
  materializePromise = (async () => {
    const rows = await latestLogs();
    const existing = new Set(rows.map((row) => row.entityId).filter(Boolean));
    const missing = LOCAL_TOLL_PLAZAS.filter((plaza) => !existing.has(entityId(plaza.id)));
    if (!missing.length) return;

    // Insere em lotes para não criar uma requisição SQL gigante no Worker.
    for (let offset = 0; offset < missing.length; offset += 40) {
      const chunk = missing.slice(offset, offset + 40);
      const values: string[] = [];
      const args: unknown[] = [];
      let index = 1;
      for (const plaza of chunk) {
        const payload = automaticPayload(plaza);
        values.push(`($${index++},$${index++},$${index++},$${index++},$${index++},$${index++},CURRENT_TIMESTAMP)`);
        args.push(randomUUID(), userId, ACTION, METHOD, JSON.stringify(payload), entityId(payload.id));
      }
      await prisma.$executeRawUnsafe(`
        INSERT INTO "audit_logs" ("id", "userId", "action", "method", "path", "entityId", "createdAt")
        VALUES ${values.join(",")}
      `, ...args);
    }
  })().finally(() => { materializePromise = null; });
  return materializePromise;
}

export async function listPedagios(onlyActive = false): Promise<PedagioDbRow[]> {
  const rows = await latestLogs();
  return rows
    .map(parseStored)
    .filter((row): row is PedagioDbRow => Boolean(row))
    .filter((row) => !onlyActive || row.ativo)
    .sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.uf.localeCompare(b.uf) || a.rodovia.localeCompare(b.rodovia) || a.nome.localeCompare(b.nome));
}

export async function createPedagio(input: PedagioDbInput, userId: string): Promise<PedagioDbRow> {
  const id = randomUUID();
  const now = new Date().toISOString();
  const payload: StoredToll = {
    id,
    ...input,
    fonte: "MANUAL",
    observacoes: input.observacoes ?? null,
    createdAt: now,
    updatedAt: now,
  };
  await appendVersion(userId, payload);
  return parseStored({ entityId: entityId(id), path: JSON.stringify(payload), createdAt: now })!;
}

export async function updatePedagio(id: string, input: PedagioDbInput, userId: string): Promise<PedagioDbRow | null> {
  const current = (await listPedagios(false)).find((row) => row.id === id);
  if (!current) return null;
  const now = new Date().toISOString();
  const payload: StoredToll = {
    id,
    ...input,
    fonte: "MANUAL",
    observacoes: input.observacoes ?? null,
    createdAt: new Date(current.createdAt).toISOString(),
    updatedAt: now,
  };
  await appendVersion(userId, payload);
  return parseStored({ entityId: entityId(id), path: JSON.stringify(payload), createdAt: now });
}

export async function deletePedagio(id: string, userId: string): Promise<boolean> {
  const current = (await listPedagios(false)).find((row) => row.id === id);
  if (!current) return false;
  const payload: StoredToll = {
    id,
    nome: current.nome,
    rodovia: current.rodovia,
    km: current.km,
    cidade: current.cidade,
    uf: current.uf,
    concessionaria: current.concessionaria,
    latitude: Number(current.latitude),
    longitude: Number(current.longitude),
    raioKm: Number(current.raioKm),
    valorPorEixo: Number(current.valorPorEixo),
    ativo: false,
    fonte: "MANUAL",
    observacoes: current.observacoes,
    createdAt: new Date(current.createdAt).toISOString(),
    updatedAt: new Date().toISOString(),
    deleted: true,
  };
  await appendVersion(userId, payload);
  return true;
}
