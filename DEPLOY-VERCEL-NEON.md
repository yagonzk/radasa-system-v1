# Deploy do Radasa na Vercel + Neon

Este pacote usa uma **Vercel Function explícita** para o backend:

- `api/index.ts`: única Vercel Function Node.js que recebe `/api/**` e encaminha para o Express existente.
- `server/**`: backend Express e rotas atuais.
- `client/**`: frontend React/Vite.
- `public/**`: gerado pelo Vite durante o build na Vercel e servido pelo CDN.
- `prisma/**`: Prisma conectado ao Neon por `DATABASE_URL`.
- `vercel.json`: faz `/api/** -> /api/index` e o fallback SPA `/** -> /index.html`.

O antigo `server.ts` na raiz foi removido para não depender da detecção automática de Express da Vercel.

## 1. Git

Substitua os arquivos do clone por este pacote e envie as alterações. Como há remoção de arquivo, use:

```bash
git add -A
git commit -m "Adiciona Vercel Function para API"
git push origin main
```

Não envie `.env`.

## 2. Projeto Vercel

Na Vercel:

- **Root Directory:** `./`
- **Framework Preset:** `Other`
- **Build Command:** pode ficar sem Override; `vercel.json` usa `pnpm run vercel-build`.
- **Output Directory:** Override desligado. O build grava os arquivos estáticos em `public/`.
- **Install Command:** pode ficar sem Override ou `pnpm install`.
- **Development Command:** Override desligado.

## 3. Variáveis de ambiente

Copie as chaves de `.env.vercel.example` para **Project > Settings > Environment Variables**.

Obrigatórias:

- `DATABASE_URL`: connection string **pooled** do Neon.
- `JWT_SECRET`: no mínimo 32 caracteres.
- `CLIENT_ORIGIN`: por exemplo `https://radasa.com.br,https://www.radasa.com.br`.
- `AUTH_REQUIRED`: `true`.
- `NODE_ENV`: `production`.

Não coloque `DATABASE_URL` em variável `VITE_*`.

## 4. Banco Neon

O deploy não recria o banco. Ele continua usando o banco apontado por `DATABASE_URL`.

Se houver migrations novas, aplique-as de forma controlada:

```bash
pnpm prisma migrate deploy
```

## 5. Teste da Function

Depois do deploy, abra:

```text
https://SEU-PROJETO.vercel.app/api/health
```

Resposta esperada:

```json
{"status":"ok"}
```

Depois teste o login e os cadastros.

## 6. Como o roteamento funciona

Uma chamada como:

```text
/api/auth/login
```

é roteada internamente pela Vercel para:

```text
/api/index?path=auth/login
```

A Function restaura a URL para `/api/auth/login` antes de executar o Express. Dessa forma, as rotas existentes não precisam ser reescritas uma a uma.

Para o frontend, qualquer rota que não seja API usa o fallback SPA para `index.html`.

## 7. Domínio

Quando o endereço `.vercel.app` estiver funcionando, adicione na Vercel:

- `radasa.com.br`
- `www.radasa.com.br`

Depois ajuste apenas os registros web no DNS conforme a Vercel indicar. Não altere MX/SPF/DKIM do e-mail.

## Observação sobre arquivos grandes

Vercel Functions têm limites de corpo e duração. Se algum fluxo de PDF/XML ultrapassar os limites da plataforma, envie o arquivo bruto diretamente para storage e passe à API apenas a referência ou dados processados.
