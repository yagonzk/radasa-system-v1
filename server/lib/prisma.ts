import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

type PrismaGlobals = {
  prisma?: PrismaClient;
};

const globalForPrisma = globalThis as unknown as PrismaGlobals;

function createPrismaClient(connectionString: string) {
  const adapter = new PrismaPg({ connectionString });
  const nodeEnvironment = String(process.env.NODE_ENV ?? "");

  return new PrismaClient({
    adapter,
    log: nodeEnvironment === "development" ? ["warn", "error"] : ["error"],
  });
}

function getPrismaClient() {
  if (!globalForPrisma.prisma) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error("DATABASE_URL não foi configurada para o Prisma.");
    }

    globalForPrisma.prisma = createPrismaClient(connectionString);
  }

  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrismaClient();
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

// Mantém compatibilidade com o middleware de auditoria.
// A Promise já é iniciada pelo chamador; aqui apenas garantimos que uma eventual
// rejeição não fique sem tratamento caso algum chamador deixe de adicionar .catch().
export function trackPrismaTask(task: Promise<unknown>) {
  void task.catch(() => undefined);
}
