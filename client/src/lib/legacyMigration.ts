import { api } from "./api";

const MIGRATION_MARKER = "radasa_postgres_migration_v1";
const KEYS = {
  motoristas: "gc_motoristas", chapas: "gc_chapas", clientes: "gc_clientes",
  produtos: "gc_produtos", locais: "gc_locais", fechamentos: "gc_fechamentos",
  veiculos: "gc_veiculos", viagens: "gc_viagens", manifestos: "gc_manifestos",
} as const;

function read(key: string): unknown[] {
  try {
    const value = localStorage.getItem(key);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export async function migrateLegacyLocalStorage(): Promise<void> {
  if (localStorage.getItem(MIGRATION_MARKER) === "done") return;
  const payload = Object.fromEntries(Object.entries(KEYS).map(([name, key]) => [name, read(key)])) as Record<string, any[]>;
  const dateOnly = (value: unknown, fallback?: unknown) => {
    const source = typeof value === "string" && value ? value : fallback;
    if (typeof source !== "string") return new Date().toISOString().slice(0, 10);
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(source)) {
      const [day, month, year] = source.split("/");
      return `${year}-${month}-${day}`;
    }
    return source.slice(0, 10);
  };
  payload.viagens = payload.viagens.map(item => ({ ...item, dataManifesto: dateOnly(item.dataManifesto, item.createdAt) }));
  payload.fechamentos = payload.fechamentos.map(item => ({ ...item, dataInicio: dateOnly(item.dataInicio, item.createdAt), dataFim: dateOnly(item.dataFim, item.createdAt) }));
  payload.manifestos = payload.manifestos.map(item => ({ ...item, dataManifesto: dateOnly(item.dataManifesto, item.createdAt), produtos: Array.isArray(item.produtos) ? item.produtos : [] }));
  const total = Object.values(payload).reduce((sum, items) => sum + items.length, 0);
  if (total === 0) { localStorage.setItem(MIGRATION_MARKER, "done"); return; }
  try {
    await api.post("/migration/local-storage", payload);
    localStorage.setItem(MIGRATION_MARKER, "done");
  } catch (error) {
    console.error("Não foi possível migrar os dados antigos para PostgreSQL.", error);
  }
}
