# Radasa — preparação para Vercel + Neon

A camada específica de Cloudflare Workers/Hyperdrive foi removida deste pacote.

Removido:
- `worker/`
- `wrangler.jsonc`
- `worker-configuration.d.ts`
- scripts `cf:*`, `dev:worker`, `build:worker` e `deploy` do Wrangler
- dependência direta `wrangler`
- workaround `iconv-lite` usado para o runtime Cloudflare
- ramificações `RADASA_RUNTIME=cloudflare-workers` e Hyperdrive no Prisma

O banco continua usando PostgreSQL via `DATABASE_URL`, portanto pode continuar no Neon.

Próxima etapa: configurar a entrada HTTP/API e as rotas para o deploy na Vercel, além das variáveis de ambiente do projeto.

## Correção Vercel Function v4

A Function `api/index.ts` usa importação estática do backend (`server/app.ts`) para que a Vercel inclua a árvore `server/**` no bundle da Function. Isso evita o erro de runtime `Cannot find module '/var/task/server/app' imported from /var/task/api/index.js`.
