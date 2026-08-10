$ErrorActionPreference = "Stop"

$script = Join-Path $PSScriptRoot "Radasa-SSAgro-Agent.ps1"
$config = Join-Path $PSScriptRoot "agente-config.json"
$taskName = "Radasa SSAgro XML Agent"

if (-not (Test-Path $script) -or -not (Test-Path $config)) {
  throw "Arquivos do agente não encontrados."
}

$action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`" -ConfigPath `"$config`""

$triggerStartup = New-ScheduledTaskTrigger -AtStartup
$triggerLogon = New-ScheduledTaskTrigger -AtLogOn

$principal = New-ScheduledTaskPrincipal `
  -UserId "SYSTEM" `
  -LogonType ServiceAccount `
  -RunLevel Highest

$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Days 3650) `
  -RestartCount 999 `
  -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger @($triggerStartup, $triggerLogon) `
  -Principal $principal `
  -Settings $settings `
  -Force | Out-Null

Start-ScheduledTask -TaskName $taskName
Write-Host "Agente instalado e iniciado." -ForegroundColor Green
Write-Host "Tarefa: $taskName"
Write-Host "Log: $PSScriptRoot\agente.log"
Read-Host "Pressione ENTER para fechar"
