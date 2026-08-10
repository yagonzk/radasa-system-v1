import { prisma } from "../lib/prisma.js";
export const logsService = {
  list: () => prisma.auditLog.findMany({
    where: { action: { not: "PEDAGIO_CADASTRO" } },
    orderBy: { createdAt: "desc" }, take: 500,
    select: { id: true, action: true, createdAt: true, user: { select: { username: true, email: true } } },
  }),
};
