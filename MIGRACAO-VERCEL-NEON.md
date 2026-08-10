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
