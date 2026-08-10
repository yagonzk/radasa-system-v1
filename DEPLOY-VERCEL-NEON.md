# Deploy do Radasa na Vercel + Neon

Este pacote está preparado para um único projeto Vercel:

- `api/index.ts`: Vercel Function explícita que encaminha `/api/**` para o Express.
- `server/**`: API existente em `/api/**`.
- `client/**`: React/Vite.
- `public/**`: gerado pelo Vite durante o build na Vercel.
- `prisma/**`: Prisma conectado ao Neon por `DATABASE_URL`.

## 1. Git

Envie esta pasta para o repositório que será conectado à Vercel. Não envie `.env`.

## 2. Projeto Vercel

Importe o repositório na Vercel e deixe a **Root Directory** na raiz deste projeto.
O arquivo `vercel.json` já força o build com:

```bash
pnpm run build
```

O projeto usa Node 22 (`.nvmrc`) e pnpm 10 (`packageManager`).

## 3. Variáveis de ambiente

Copie as chaves de `.env.vercel.example` para **Project > Settings > Environment Variables**.

Obrigatórias para a aplicação iniciar:

- `DATABASE_URL`: connection string **pooled** do Neon (hostname normalmente contém `-pooler`).
- `JWT_SECRET`: no mínimo 32 caracteres.
- `CLIENT_ORIGIN`: `https://radasa.com.br,https://www.radasa.com.br`.
- `AUTH_REQUIRED`: `true`.

Não coloque `DATABASE_URL` em variável `VITE_*`.

## 4. Banco Neon

O deploy não recria o banco. Ele usa o banco já existente apontado por `DATABASE_URL`.
Antes do primeiro deploy de produção, aplique migrations somente se houver migrations novas:

```bash
pnpm prisma migrate deploy
```

Faça isso com uma conexão que tenha permissão de alteração de schema.

## 5. Testes depois do deploy

Abra primeiro:

```text
https://SEU-PROJETO.vercel.app/api/health
```

Resposta esperada quando as variáveis obrigatórias estão configuradas:

```json
{"status":"ok","runtime":"vercel-function","config":{"databaseUrl":true,"jwtSecret":true,"clientOrigin":true}}
```

Se aparecer `status: "degraded"`, veja quais flags estão `false` e configure as respectivas variáveis em **Project > Settings > Environment Variables**. O health check não expõe os valores dos segredos.

Depois abra a raiz do projeto e teste login/cadastros.

## 6. Domínio

Quando o endereço `.vercel.app` estiver funcionando, adicione na Vercel:

- `radasa.com.br`
- `www.radasa.com.br`

Depois altere no Cloudflare DNS apenas os registros web conforme os valores exibidos pela Vercel. Não altere MX/SPF/DKIM do e-mail.

## Observação sobre arquivos grandes

A aplicação continua com importações em lote, mas Functions da Vercel têm limites de tamanho e duração por requisição. Se algum fluxo de PDF/XML ultrapassar o limite da plataforma, a etapa seguinte é mover o arquivo bruto para storage direto (por exemplo, Vercel Blob/S3) e enviar à API apenas a referência. Os romaneios já fazem a extração pesada do PDF no navegador antes de interpretar o texto no backend.

## Diagnóstico da Function

A rota `/api/health` é uma Function isolada usando o padrão Web Standard atual da Vercel e não carrega Express nem Prisma. Ela deve responder mesmo quando o backend estiver com configuração incompleta.

As demais rotas `/api/*` são encaminhadas para `api/index.ts`, que exporta uma aplicação Express como `default`, usando o adaptador oficial da Vercel. Se faltar `DATABASE_URL` ou `JWT_SECRET`, a API retorna JSON 503 em vez de derrubar a Function.
