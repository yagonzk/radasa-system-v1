import { prisma } from "../lib/prisma.js";
import { created } from "../utils/serialize.js";
import { AppError } from "../utils/app-error.js";

function serialize(item: any) {
  const { certificadoSenha: _certificadoSenha, ...safe } = item;

  return {
    ...safe,
    certificadoValidade:
      item.certificadoValidade instanceof Date
        ? item.certificadoValidade.toISOString()
        : item.certificadoValidade,
    createdAt: created(item.createdAt),
  };
}

function normalizeData(data: any, preservePassword = false): any {
  const {
    createdAt,
    certificadoValidade,
    certificadoSenha,
    ...rest
  } = data;

  const normalized: any = {
    ...rest,
  };

  if (certificadoValidade !== undefined) {
    normalized.certificadoValidade = certificadoValidade
      ? new Date(`${String(certificadoValidade).slice(0, 10)}T00:00:00.000Z`)
      : null;
  }

  if (certificadoSenha) {
    normalized.certificadoSenha = certificadoSenha;
  } else if (!preservePassword) {
    normalized.certificadoSenha = "";
  }

  if (createdAt) {
    normalized.createdAt = new Date(createdAt);
  }

  return normalized;
}

export const empresaService = {
  async list() {
    return (
      await prisma.empresa.findMany({
        orderBy: [
          { empresaPadrao: "desc" },
          { createdAt: "desc" },
        ],
      })
    ).map(serialize);
  },

  async get(id: string) {
    const item = await prisma.empresa.findUnique({
      where: { id },
    });

    if (!item) {
      throw new AppError(404, "Empresa não encontrada.");
    }

    return serialize(item);
  },

  async create(data: any) {
    const item = await prisma.$transaction(async (tx) => {
      if (data.empresaPadrao) {
        await tx.empresa.updateMany({
          where: { empresaPadrao: true },
          data: { empresaPadrao: false },
        });
      }

      return tx.empresa.create({
        data: normalizeData(data),
      });
    });

    return serialize(item);
  },

  async update(id: string, data: any) {
    const current = await prisma.empresa.findUnique({
      where: { id },
    });

    if (!current) {
      throw new AppError(404, "Empresa não encontrada.");
    }

    const item = await prisma.$transaction(async (tx) => {
      if (data.empresaPadrao) {
        await tx.empresa.updateMany({
          where: {
            empresaPadrao: true,
            id: { not: id },
          },
          data: { empresaPadrao: false },
        });
      }

      return tx.empresa.update({
        where: { id },
        data: normalizeData(data, true),
      });
    });

    return serialize(item);
  },

  async remove(id: string) {
    const current = await prisma.empresa.findUnique({
      where: { id },
    });

    if (!current) {
      throw new AppError(404, "Empresa não encontrada.");
    }

    if (current.empresaPadrao) {
      throw new AppError(409, "A empresa padrão não pode ser excluída.");
    }

    await prisma.empresa.delete({
      where: { id },
    });
  },
};
