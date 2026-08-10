import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";
import { AppError } from "../utils/app-error";

function publicUser(user: {
  id: string;
  name: string;
  username: string;
  email: string;
  telefone: string;
  cpf: string | null;
  fotoPerfil: string | null;
  role: "ADMIN" | "GERENTE" | "BORRACHARIA" | "MANUTENCAO" | "VISUALIZACAO" | "USER";
}) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    telefone: user.telefone,
    cpf: user.cpf,
    fotoPerfil: user.fotoPerfil,
    role: user.role,
  };
}

function signToken(user: { id: string; email: string; role: "ADMIN" | "GERENTE" | "BORRACHARIA" | "MANUTENCAO" | "VISUALIZACAO" | "USER" }) {
  return jwt.sign(
    { email: user.email, role: user.role },
    env.JWT_SECRET,
    {
      subject: user.id,
      expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
    }
  );
}

export const authService = {
  async login(identifier: string, password: string) {
    const normalizedIdentifier = identifier.trim().toLowerCase();
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: normalizedIdentifier },
          { username: normalizedIdentifier },
        ],
      },
    });

    if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new AppError(401, "Usuário, e-mail ou senha inválidos.");
    }

    return { token: signToken(user), user: publicUser(user) };
  },

  async register(input: {
    name: string;
    username: string;
    email: string;
    password: string;
  }) {
    const username = input.username.trim().toLowerCase();
    const email = input.email.trim().toLowerCase();

    const existing = await prisma.user.findFirst({
      where: { OR: [{ username }, { email }] },
      select: { username: true, email: true },
    });

    if (existing?.username === username) {
      throw new AppError(409, "Este nome de usuário já está em uso.");
    }
    if (existing?.email === email) {
      throw new AppError(409, "Este e-mail já está cadastrado.");
    }

    const user = await prisma.user.create({
      data: {
        name: input.name.trim(),
        username,
        email,
        passwordHash: await bcrypt.hash(input.password, 12),
      },
    });

    return { token: signToken(user), user: publicUser(user) };
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new AppError(400, "A senha atual está incorreta.");
    }
    if (currentPassword === newPassword) throw new AppError(400, "A nova senha deve ser diferente da atual.");
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(newPassword, 12) } }),
      prisma.auditLog.create({ data: { userId, action: "Alterou a própria senha", method: "PUT", path: "/api/auth/change-password" } }),
    ]);
    return { message: "Senha alterada com sucesso." };
  },

  async updateProfile(userId: string, input: {
    name: string;
    email: string;
    telefone: string;
    cpf: string;
    fotoPerfil?: string | null;
  }) {
    const email = input.email.trim().toLowerCase();
    const cpf = input.cpf.replace(/\D/g, "") || null;

    const duplicate = await prisma.user.findFirst({
      where: {
        id: { not: userId },
        OR: [
          { email },
          ...(cpf ? [{ cpf }] : []),
        ],
      },
      select: { email: true, cpf: true },
    });

    if (duplicate?.email === email) {
      throw new AppError(409, "Este e-mail já está cadastrado.");
    }
    if (cpf && duplicate?.cpf === cpf) {
      throw new AppError(409, "Este CPF já está cadastrado.");
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        name: input.name.trim(),
        email,
        telefone: input.telefone.replace(/\D/g, ""),
        cpf,
        ...(input.fotoPerfil !== undefined ? { fotoPerfil: input.fotoPerfil } : {}),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: "Atualizou o próprio perfil",
        method: "PUT",
        path: "/api/auth/profile",
      },
    });

    return publicUser(user);
  },

  async me(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.active) throw new AppError(401, "Usuário não encontrado ou inativo.");
    return publicUser(user);
  },
};
