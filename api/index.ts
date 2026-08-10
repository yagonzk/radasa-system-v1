import "dotenv/config";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createApp, registerErrors } from "../server/app";

/**
 * Vercel Function explícita para toda a API Express.
 *
 * O vercel.json reescreve /api/* para /api/index e encaminha o trecho
 * capturado como query string `path`. Antes de entregar a requisição ao
 * Express, restauramos a URL original para que todas as rotas existentes em
 * server/routes continuem funcionando sem alterações.
 */
const app = createApp();
registerErrors(app);

function restoreApiUrl(request: IncomingMessage) {
  const rawUrl = request.url ?? "/api";
  const parsed = new URL(rawUrl, "http://localhost");

  // Em uma chamada direta para /api, a função já recebe a URL correta.
  // Em /api/health, por exemplo, o rewrite interno chega como
  // /api/index?path=health.
  if (parsed.pathname !== "/api/index") return rawUrl;

  const capturedPath = parsed.searchParams.get("path");
  parsed.searchParams.delete("path");

  const normalizedPath = (capturedPath ?? "")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .join("/");

  const pathname = normalizedPath ? `/api/${normalizedPath}` : "/api";
  const search = parsed.searchParams.toString();
  return search ? `${pathname}?${search}` : pathname;
}

export default function handler(
  request: IncomingMessage,
  response: ServerResponse,
) {
  request.url = restoreApiUrl(request);
  return app(request, response);
}
