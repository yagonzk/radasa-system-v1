$ErrorActionPreference = "Stop"

if (-not (Test-Path ".\package.json")) {
  throw "Execute este script na raiz do projeto, onde esta o package.json."
}

Write-Host "Parando processos Node..."
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

Write-Host "Atualizando a tabela de usuarios..."
pnpm exec prisma db execute --schema ".\prisma\schema.prisma" --file ".\scripts\Adicionar-Perfil-Usuario.sql"
if ($LASTEXITCODE -ne 0) { throw "Falha ao atualizar o banco de dados." }

Write-Host "Gerando o Prisma Client..."
pnpm exec prisma generate
if ($LASTEXITCODE -ne 0) { throw "Falha ao gerar o Prisma Client." }

Write-Host "Perfil instalado com sucesso."
Write-Host "Agora execute: pnpm dev"
