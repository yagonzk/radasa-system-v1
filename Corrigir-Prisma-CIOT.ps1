$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "Parando processos Node..."
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

if (-not (Test-Path ".\package.json")) {
    throw "Execute este script na raiz do projeto, onde esta o package.json."
}

if (-not (Test-Path ".\corrigir-id-sequencial-ciot.sql")) {
    throw "O arquivo corrigir-id-sequencial-ciot.sql precisa estar na mesma pasta deste script."
}

Write-Host "Criando a coluna idSequencial diretamente no PostgreSQL..."
pnpm exec prisma db execute --schema ".\prisma\schema.prisma" --file ".\corrigir-id-sequencial-ciot.sql"
if ($LASTEXITCODE -ne 0) {
    throw "Falha ao executar o SQL no banco."
}

Write-Host "Gerando o Prisma Client..."
pnpm exec prisma generate
if ($LASTEXITCODE -ne 0) {
    throw "Falha ao gerar o Prisma Client."
}

Write-Host ""
Write-Host "Correcao aplicada. Iniciando o sistema..."
pnpm dev
