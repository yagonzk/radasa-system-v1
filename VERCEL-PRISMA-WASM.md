# Vercel + Prisma 6.19.3

Esta versão mantém o Prisma sem Rust (`engineType = "client"`) com `@prisma/adapter-pg`, mas inclui explicitamente os artefatos gerados do Prisma Client no bundle da Vercel Function.

O erro corrigido é:

```text
ENOENT: no such file or directory, open .../.prisma/client/query_compiler_bg.wasm
```

A regra `includeFiles` de `vercel.json` inclui tanto `node_modules/.prisma/client/**` quanto o caminho físico usado pelo pnpm em `node_modules/.pnpm/**/node_modules/.prisma/client/**`.

Após publicar, faça um redeploy sem cache e teste `/api/health` e depois o login.
