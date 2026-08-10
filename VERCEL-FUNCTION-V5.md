# Vercel Function v5

Correção para Node.js ESM na Vercel.

O projeto usa `"type": "module"`. Em Node.js ESM, imports relativos precisam de extensão explícita. Todos os imports relativos alcançáveis pela Function foram convertidos para specifiers `.js`, que o TypeScript resolve contra os arquivos `.ts` durante a compilação.

Também foi adicionado `functions.api/index.ts.includeFiles` no `vercel.json` para garantir a inclusão de `server/**`, `shared/**` e `prisma/**` no pacote da Function.

Teste após o deploy:

- `/api/health`
- login normal do sistema
