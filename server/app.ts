import cors, { type CorsOptions } from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { apiRoutes } from "./routes";
import { requestLogger } from "./middlewares/request-logger";
import { sanitizeInputs } from "./middlewares/sanitize";
import { notFound } from "./middlewares/not-found";
import { errorHandler } from "./middlewares/error-handler";
import { createRateLimiter } from "./middlewares/rate-limit";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(requestLogger);
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

  const allowedOrigins = new Set(
    env.CLIENT_ORIGIN.split(",").map((value) => value.trim()).filter(Boolean),
  );

  // Preview e produção da própria Vercel recebem hostnames automáticos.
  for (const hostname of [
    process.env.VERCEL_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ]) {
    if (hostname) allowedOrigins.add(`https://${hostname.replace(/^https?:\/\//, "")}`);
  }

  const corsOptions: CorsOptions = {
    origin(origin, callback) {
      // Requisições sem Origin (health checks, scripts e chamadas server-to-server)
      // não precisam ser bloqueadas pelo CORS.
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origem não permitida pelo CORS."));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  };

  app.use(cors(corsOptions));

  // A Vercel limita o corpo de Functions antes do Express. Mantemos um limite
  // interno menor que o antigo 25 MB para falhar de forma previsível.
  app.use(express.json({ limit: "4mb" }));
  app.use(express.urlencoded({ extended: false, limit: "4mb" }));
  app.use(sanitizeInputs);
  app.use("/api", (_req, res, next) => {
    // Cadastros e listagens precisam refletir imediatamente as gravações no Neon.
    // Evita cache do navegador/CDN sobre respostas dinâmicas da API.
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    next();
  });
  app.use("/api", createRateLimiter({ windowMs: 15 * 60 * 1000, limit: 1000, standardHeaders: "draft-7", legacyHeaders: false }), apiRoutes);
  return app;
}

export function registerErrors(app: express.Express) {
  app.use(notFound);
  app.use(errorHandler);
}
