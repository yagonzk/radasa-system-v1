$ErrorActionPreference = "Stop"

Write-Host "Limpando instalação anterior..." -ForegroundColor Cyan
Remove-Item node_modules -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item pnpm-lock.yaml -Force -ErrorAction SilentlyContinue

Write-Host "Instalando dependências..." -ForegroundColor Cyan
pnpm install

Write-Host "Gerando Prisma Client..." -ForegroundColor Cyan
pnpm exec prisma generate

Write-Host "Instalação corrigida. Execute: pnpm dev" -ForegroundColor Green
