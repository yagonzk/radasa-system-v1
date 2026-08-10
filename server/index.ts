import "dotenv/config";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import { createApp, registerErrors } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { prisma } from "./lib/prisma.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = createApp();

if (env.NODE_ENV === "production") {
  const staticPath = path.resolve(__dirname, "public");
  app.use(express.static(staticPath));
  app.get("*", (_req, res) => res.sendFile(path.join(staticPath, "index.html")));
}

registerErrors(app);
const server = createServer(app);
server.listen(env.PORT, "0.0.0.0", () =>
  logger.info(`Servidor rodando na porta ${env.PORT}`),
);

async function shutdown(signal: string) {
  logger.info({ signal }, "Encerrando servidor");
  server.close(async () => { await prisma.$disconnect(); process.exit(0); });
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
