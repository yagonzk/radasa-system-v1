import { prisma } from "../lib/prisma";
import { created, number} from "../utils/serialize";
import { AppError } from "../utils/app-error";

const serialize = (item: any) => ({ ...item, valorFixo: number(item.valorFixo), createdAt: created(item.createdAt) });

export const chapasService = {
  async list() { return (await prisma.chapa.findMany({ orderBy: { createdAt: "desc" } })).map(serialize); },
  async get(id: string) { const item = await prisma.chapa.findUnique({ where: { id } }); if (!item) throw new AppError(404, "Chapa não encontrado."); return serialize(item); },
  async create(data: any) { const { createdAt, ...rest } = data; const item = await prisma.chapa.create({ data: { ...rest, ...(createdAt ? { createdAt: new Date(createdAt) } : {}) } }); return serialize(item); },
  async update(id: string, data: any) { const { createdAt, ...rest } = data; const item = await prisma.chapa.update({ where: { id }, data: rest }); return serialize(item); },
  async remove(id: string) { await prisma.chapa.delete({ where: { id } }); },
};
