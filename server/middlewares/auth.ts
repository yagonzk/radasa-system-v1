import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import type { UserRole } from "@prisma/client";
import { env } from "../config/env";
import { AppError } from "../utils/app-error";

type TokenPayload = { sub: string; email: string; role: UserRole };

function readToken(header?: string): string | undefined {
  if (!header?.startsWith("Bearer ")) return undefined;
  return header.slice(7).trim();
}

export const authenticate: RequestHandler = (req, _res, next) => {
  const token = readToken(req.headers.authorization);
  if (!token) return next(new AppError(401, "Autenticação obrigatória."));

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
    next();
  } catch {
    next(new AppError(401, "Token inválido ou expirado."));
  }
};

export const authenticateIfRequired: RequestHandler = (req, res, next) => {
  const token = readToken(req.headers.authorization);
  if (token) return authenticate(req, res, next);
  if (!env.AUTH_REQUIRED) return next();
  return next(new AppError(401, "Autenticação obrigatória."));
};

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError(403, "Permissão insuficiente."));
    }
    next();
  };
}
