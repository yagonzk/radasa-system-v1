import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/app-error";

const select = {
  id: true,
  name: true,
  username: true,
  email: true,
  telefone: true,
  cpf: true,
  fotoPerfil: true,
  role: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const usuariosService = {
  list: () => prisma.user.findMany({ select, orderBy: { name: "asc" } }),

  async get(id: string) {
    const user = await prisma.user.findUnique({ where: { id }, select });
    if (!user) throw new AppError(404, "Usuário não encontrado.");
    return user;
  },

  async create(data: any) {
    const passwordHash = await bcrypt.hash(data.password, 12);
    return prisma.user.create({
      select,
      data: {
        name: data.name,
        username: data.username.toLowerCase(),
        email: data.email.toLowerCase(),
        passwordHash,
        role: data.role,
      },
    });
  },

  async update(id: string, data: any) {
    const passwordHash = data.password
      ? await bcrypt.hash(data.password, 12)
      : undefined;

    return prisma.user.update({
      where: { id },
      select,
      data: {
        name: data.name,
        username: data.username?.toLowerCase(),
        email: data.email?.toLowerCase(),
        role: data.role,
        active: data.active,
        ...(passwordHash ? { passwordHash } : {}),
      },
    });
  },

  remove: (id: string) => prisma.user.delete({ where: { id } }),
};
