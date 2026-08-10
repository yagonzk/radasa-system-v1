import "dotenv/config";
import path from "node:path";
import { createApp, registerErrors } from "./server/app";

/**
 * Entrypoint da Vercel.
 *
 * A Vercel detecta server.ts como aplicação Express e a transforma em uma
 * Function Node.js. Não chamamos app.listen() aqui: a plataforma cuida disso.
 */
const app = createApp();

// O build do Vite é gravado em /public quando VERCEL=1. Arquivos estáticos são
// servidos diretamente pela Vercel; esta rota cobre apenas deep links da SPA.
app.get("*", (req, res, next) => {
  if (req.path === "/api" || req.path.startsWith("/api/")) {
    next();
    return;
  }

  res.sendFile(path.join(process.cwd(), "public", "index.html"), (error) => {
    if (error) next(error);
  });
});

registerErrors(app);

export default app;
