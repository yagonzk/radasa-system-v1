import type { RequestHandler } from "express";
import { prisma, trackPrismaTask } from "../lib/prisma.js";
import { logger } from "../config/logger.js";

const labels: Record<string, string> = {
  motoristas: "motorista", chapas: "chapa", clientes: "cliente", empresa: "empresa", produtos: "produto",
  locais: "local", veiculos: "veículo", viagens: "viagem", fechamentos: "comissão",
  manifestos: "romaneio", romaneios: "romaneio", abastecimentos: "abastecimento", pneus: "pneu", estoque: "movimentação de estoque", usuarios: "usuário",
};

function describe(method: string, path: string, body?: unknown) {
  if (path.includes("/auth/change-password")) return "Alterou a própria senha";
  const cleanPath = path.split("?")[0];
  if (
    cleanPath.includes("/motoristas/") &&
    (method === "PUT" || method === "PATCH") &&
    body &&
    typeof body === "object" &&
    "status" in body
  ) {
    return (body as { status?: string }).status === "DEMITIDO"
      ? "Demitiu motorista"
      : "Reativou motorista";
  }
  const segment = cleanPath.split("/").filter(Boolean).pop() || "registro";
  const parts = path.split("?")[0].split("/").filter(Boolean);
  const resource = parts.find(part => labels[part]);
  const label = resource ? labels[resource] : segment;
  if (method === "POST") return `Cadastrou ${label}`;
  if (method === "PUT" || method === "PATCH") return `Editou ${label}`;
  if (method === "DELETE") return `Excluiu ${label}`;
  return `${method} ${label}`;
}

export const auditMutations: RequestHandler = (req, res, next) => {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
  res.on("finish", () => {
    if (!req.user || res.statusCode >= 400 || req.path.includes("/auth/login") || req.path.includes("/auth/register")) return;
    const auditTask = prisma.auditLog.create({
      data: {
        userId: req.user.id, action: describe(req.method, req.originalUrl, req.body), method: req.method,
        path: req.originalUrl, entityId: req.params.id || null,
      },
    }).catch(error => logger.error({ error }, "Falha ao registrar log de auditoria"));
    trackPrismaTask(auditTask);
  });
  next();
};
