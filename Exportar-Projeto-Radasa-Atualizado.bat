@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Exportar Projeto Radasa Atualizado

set "ROOT=%CD%"

if not exist "%ROOT%\package.json" (
  echo.
  echo ERRO: execute este BAT na raiz do projeto,
  echo junto do arquivo package.json.
  echo.
  pause
  exit /b 1
)

set "TMP=%TEMP%\Radasa_Projeto_Atualizado"
if exist "%TMP%" rmdir /s /q "%TMP%"
mkdir "%TMP%"

set "DESKTOP=%USERPROFILE%\Desktop"
if defined OneDrive if exist "%OneDrive%\Desktop" set "DESKTOP=%OneDrive%\Desktop"

set "ZIP=%DESKTOP%\Radasa_Projeto_Atualizado.zip"

echo.
echo Copiando o projeto sem arquivos pesados ou sensiveis...
echo.

robocopy "%ROOT%" "%TMP%" /E ^
/XD node_modules .git dist build .next .turbo coverage logs tmp temp .cache .vercel .output .idea .vscode ^
/XF .env .env.local .env.production .env.development .env.test ^
*.log *.db *.sqlite *.sqlite3 ^
*.pfx *.p12 *.pem *.key *.crt *.cer ^
*.zip *.rar *.7z *.iso *.exe *.dll ^
Thumbs.db Desktop.ini >nul

if errorlevel 8 (
  echo.
  echo ERRO ao copiar os arquivos.
  pause
  exit /b 1
)

(
  echo PROJETO RADASA ATUALIZADO
  echo.
  echo Incluido:
  echo - client
  echo - server
  echo - prisma
  echo - migrations
  echo - package.json
  echo - pnpm-lock.yaml
  echo - configuracoes e scripts
  echo.
  echo Excluido:
  echo - node_modules
  echo - .git
  echo - dist e build
  echo - .env real
  echo - certificados e chaves
  echo - bancos locais
  echo - logs e temporarios
) > "%TMP%\LEIA-ME-EXPORTACAO.txt"

where tar.exe >nul 2>&1
if errorlevel 1 (
  echo.
  echo ERRO: tar.exe nao foi encontrado no Windows.
  pause
  exit /b 1
)

if exist "%ZIP%" del /f /q "%ZIP%"

echo.
echo Compactando...
tar.exe -a -c -f "%ZIP%" -C "%TMP%" .

if errorlevel 1 (
  echo.
  echo ERRO ao criar o ZIP.
  pause
  exit /b 1
)

echo.
echo ==========================================
echo ZIP criado com sucesso:
echo %ZIP%
echo ==========================================
echo.

explorer.exe /select,"%ZIP%"
pause
