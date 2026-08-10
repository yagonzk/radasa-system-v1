import express, { type Request, type Response } from "express";
import { createApp, registerErrors } from "../server/app.js";

function requiredConfig() {
  const databaseUrl = String(process.env.DATABASE_URL ?? "").trim();
  const jwtSecret = String(process.env.JWT_SECRET ?? "");

  const missing: string[] = [];
  if (!databaseUrl) missing.push("DATABASE_URL");
  if (jwtSecret.length < 32) missing.push("JWT_SECRET (mínimo 32 caracteres)");

  return { missing };
}

function restoreOriginalApiUrl(request: Request) {
  const parsed = new URL(request.url || "/api/index", "http://localhost");
  const capturedPath = parsed.searchParams.get("__path");

  if (capturedPath === null) return;

  parsed.searchParams.delete("__path");

  const normalizedPath = capturedPath
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .join("/");

  const pathname = normalizedPath ? `/api/${normalizedPath}` : "/api";
  const query = parsed.searchParams.toString();
  const restored = query ? `${pathname}?${query}` : pathname;

  request.url = restored;
  request.originalUrl = restored;
}

// IMPORTANTE PARA A VERCEL:
// O projeto usa ESM (package.json: type=module). Por isso os imports relativos
// do backend usam extensões .js explícitas. O Node.js exige extensão em imports
// ESM no runtime; o TypeScript resolve esses specifiers .js para os arquivos .ts
// durante o build da Vercel. O vercel.json também inclui server/shared/prisma na Function.
const coreApp = createApp();
registerErrors(coreApp);

const gateway = express();
gateway.disable("x-powered-by");

gateway.use((request: Request, response: Response) => {
  restoreOriginalApiUrl(request);

  const { missing } = requiredConfig();
  if (missing.length > 0) {
    response.status(503).setHeader("Cache-Control", "no-store").json({
      status: "error",
      code: "CONFIGURATION_ERROR",
      message: "Variáveis obrigatórias não foram configuradas na Vercel.",
      missing,
    });
    return;
  }

  coreApp(request, response);
});

export default gateway;
