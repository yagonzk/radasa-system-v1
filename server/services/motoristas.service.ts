import { prisma } from "../lib/prisma.js";
import { created, number } from "../utils/serialize.js";
import { AppError } from "../utils/app-error.js";

const serialize = (item: any) => ({
  ...item,
  salarioBase: number(item.salarioBase),
  createdAt: created(item.createdAt),
});

export const motoristasService = {
  async list() {
    return (await prisma.motorista.findMany({ orderBy: { createdAt: "desc" } })).map(serialize);
  },

  async get(id: string) {
    const item = await prisma.motorista.findUnique({ where: { id } });
    if (!item) throw new AppError(404, "Motorista não encontrado.");
    return serialize(item);
  },

  async create(data: any) {
    const { createdAt, status = "ATIVO", ...rest } = data;
    const item = await prisma.motorista.create({
      data: {
        ...rest,
        status,
        ...(createdAt ? { createdAt: new Date(createdAt) } : {}),
      },
    });
    return serialize(item);
  },

  async update(id: string, data: any) {
    const { createdAt, ...rest } = data;
    const item = await prisma.motorista.update({ where: { id }, data: rest });
    return serialize(item);
  },

  async remove(_id: string) {
    throw new AppError(
      405,
      "Motoristas não podem ser excluídos. Altere o status para DEMITIDO."
    );
  },
};
