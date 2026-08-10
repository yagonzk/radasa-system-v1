import { prisma } from "../lib/prisma.js";
import { created, number} from "../utils/serialize.js";
import { AppError } from "../utils/app-error.js";

const serialize = (item: any) => ({ ...item, valorComissao: number(item.valorComissao), createdAt: created(item.createdAt) });

export const locaisService = {
  async list() { return (await prisma.local.findMany({ orderBy: { createdAt: "desc" } })).map(serialize); },
  async get(id: string) { const item = await prisma.local.findUnique({ where: { id } }); if (!item) throw new AppError(404, "Local não encontrado."); return serialize(item); },
  async create(data: any) { const { createdAt, ...rest } = data; const item = await prisma.local.create({ data: { ...rest, ...(createdAt ? { createdAt: new Date(createdAt) } : {}) } }); return serialize(item); },
  async update(id: string, data: any) { const { createdAt, ...rest } = data; const item = await prisma.local.update({ where: { id }, data: rest }); return serialize(item); },
  async remove(id: string) { await prisma.local.delete({ where: { id } }); },
};
