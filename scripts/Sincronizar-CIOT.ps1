$ErrorActionPreference = "Stop"

if (-not (Test-Path ".\package.json")) {
  throw "Execute este script na raiz do projeto."
}

Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

pnpm exec prisma db execute --schema ".\prisma\schema.prisma" --file ".\scripts\sincronizar-ciot.sql"
if ($LASTEXITCODE -ne 0) { throw "Falha ao sincronizar o banco." }

pnpm exec prisma generate
if ($LASTEXITCODE -ne 0) { throw "Falha ao gerar o Prisma Client." }

Write-Host "Banco e Prisma sincronizados com sucesso." -ForegroundColor Green
