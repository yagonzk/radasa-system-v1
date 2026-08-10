import { Prisma } from "@prisma/client";
import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { logger } from "../config/logger";
import { AppError } from "../utils/app-error";

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof ZodError) {
    return res.status(400).json({ message: "Dados inválidos", issues: error.issues });
  }

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({ message: error.message, details: error.details });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return res.status(409).json({ message: "Registro duplicado." });
    if (error.code === "P2003") return res.status(409).json({ message: "Registro vinculado a outros dados." });
    if (error.code === "P2025") return res.status(404).json({ message: "Registro não encontrado." });
    if (error.code === "P2034") return res.status(409).json({ message: "Conflito de gravação. Tente novamente." });
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    logger.error({ error, method: req.method, url: req.originalUrl }, "Banco temporariamente indisponível");
    return res.status(503).json({ message: "Banco de dados temporariamente indisponível. A importação tentará novamente." });
  }

  logger.error({ error, method: req.method, url: req.originalUrl }, "Erro não tratado");
  return res.status(500).json({ message: "Erro interno do servidor." });
};
