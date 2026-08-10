import { prisma } from "../lib/prisma.js";
import { created} from "../utils/serialize.js";
import { AppError } from "../utils/app-error.js";

const serialize = (item: any) => ({ ...item, createdAt: created(item.createdAt) });

export const produtosService = {
  async list() { return (await prisma.produto.findMany({ orderBy: { createdAt: "desc" } })).map(serialize); },
  async get(id: string) { const item = await prisma.produto.findUnique({ where: { id } }); if (!item) throw new AppError(404, "Produto não encontrado."); return serialize(item); },
  async create(data: any) { const { createdAt, ...rest } = data; const item = await prisma.produto.create({ data: { ...rest, ...(createdAt ? { createdAt: new Date(createdAt) } : {}) } }); return serialize(item); },
  async update(id: string, data: any) { const { createdAt, ...rest } = data; const item = await prisma.produto.update({ where: { id }, data: rest }); return serialize(item); },
  async remove(id: string) { await prisma.produto.delete({ where: { id } }); },
};
