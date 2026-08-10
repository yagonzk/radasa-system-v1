import { prisma } from "../lib/prisma.js";
import { created} from "../utils/serialize.js";
import { AppError } from "../utils/app-error.js";

const serialize = (item: any) => ({ ...item, createdAt: created(item.createdAt) });

export const clientesService = {
  async list() { return (await prisma.cliente.findMany({ orderBy: { createdAt: "desc" } })).map(serialize); },
  async get(id: string) { const item = await prisma.cliente.findUnique({ where: { id } }); if (!item) throw new AppError(404, "Cliente não encontrado."); return serialize(item); },
  async create(data: any) { const { createdAt, ...rest } = data; const item = await prisma.cliente.create({ data: { ...rest, ...(createdAt ? { createdAt: new Date(createdAt) } : {}) } }); return serialize(item); },
  async update(id: string, data: any) { const { createdAt, ...rest } = data; const item = await prisma.cliente.update({ where: { id }, data: rest }); return serialize(item); },
  async remove(id: string) { await prisma.cliente.delete({ where: { id } }); },
};
