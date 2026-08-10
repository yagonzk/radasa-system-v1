import express, { type Express, type Request, type Response } from "express";

let coreAppPromise: Promise<Express> | null = null;

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

  // Aqui já estamos dentro do adaptador Express oficial da Vercel, então
  // req.url é o IncomingMessage mutável esperado pelo Express.
  request.url = restored;
  request.originalUrl = restored;
}

async function loadCoreApp() {
  if (!coreAppPromise) {
    coreAppPromise = import("../server/app")
      .then(({ createApp, registerErrors }) => {
        const app = createApp();
        registerErrors(app);
        return app;
      })
      .catch((error) => {
        coreAppPromise = null;
        throw error;
      });
  }

  return coreAppPromise;
}

const gateway = express();
gateway.disable("x-powered-by");

gateway.use(async (request: Request, response: Response) => {
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

  try {
    const app = await loadCoreApp();
    app(request, response);
  } catch (error) {
    console.error("[vercel-api] Falha ao carregar o backend Express:", error);

    if (!response.headersSent) {
      response.status(500).setHeader("Cache-Control", "no-store").json({
        status: "error",
        code: "BACKEND_INIT_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "Falha desconhecida ao inicializar o backend.",
      });
    }
  }
});

// A Vercel possui suporte oficial a aplicações Express exportadas como default.
export default gateway;
