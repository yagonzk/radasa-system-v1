# Radasa — Vercel + Neon

A migração de infraestrutura deste pacote está preparada para:

- frontend React/Vite servido pela Vercel;
- backend Express executado por uma Vercel Function explícita em `api/index.ts`;
- PostgreSQL existente no Neon via `DATABASE_URL`;
- Prisma 6 usando a conexão do Neon;
- rotas `/api/**` encaminhadas para a Function pelo `vercel.json`;
- fallback SPA para `index.html`.

A camada específica de Cloudflare Workers/Hyperdrive foi removida.

O banco não é recriado no deploy. Configure na Vercel a `DATABASE_URL` do banco Neon existente e as demais variáveis indicadas em `.env.vercel.example`.

Consulte `DEPLOY-VERCEL-NEON.md` para o passo a passo de deploy e teste `/api/health` após a publicação.
