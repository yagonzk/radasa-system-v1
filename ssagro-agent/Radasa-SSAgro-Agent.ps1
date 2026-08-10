param(
  [string]$ConfigPath = "$PSScriptRoot\agente-config.json",
  [switch]$RunOnce
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Log {
  param([string]$Message, [string]$Level = "INFO")
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [$Level] $Message"
  Write-Host $line
  Add-Content -LiteralPath "$PSScriptRoot\agente.log" -Value $line -Encoding UTF8
}

function Load-Json {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Arquivo de configuração não encontrado: $Path"
  }
  Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
}

function Load-State {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) {
    return @{}
  }
  try {
    $object = Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
    $table = @{}
    $object.psobject.Properties | ForEach-Object { $table[$_.Name] = $_.Value }
    return $table
  } catch {
    Write-Log "Estado anterior inválido; iniciando um novo." "WARN"
    return @{}
  }
}

function Save-State {
  param([hashtable]$State, [string]$Path)
  $State | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Is-FullNfeXml {
  param([string]$Xml)
  return (
    $Xml -match '<(?:[A-Za-z0-9_]+:)?nfeProc(?:\s|>)' -or
    $Xml -match '<(?:[A-Za-z0-9_]+:)?NFe(?:\s|>)'
  )
}

function Send-Xml {
  param(
    [pscustomobject]$Config,
    [System.IO.FileInfo]$File,
    [string]$Hash
  )

  $bytes = [System.IO.File]::ReadAllBytes($File.FullName)
  $payload = @{
    cnpj = $Config.cnpj
    fileName = $File.Name
    xmlBase64 = [Convert]::ToBase64String($bytes)
    sha256 = $Hash.ToLowerInvariant()
  } | ConvertTo-Json -Compress

  $headers = @{
    "x-radasa-agent-token" = $Config.token
  }

  return Invoke-RestMethod `
    -Uri "$($Config.apiUrl.TrimEnd('/'))/api/sefaz-agent/import" `
    -Method Post `
    -Headers $headers `
    -ContentType "application/json; charset=utf-8" `
    -Body $payload `
    -TimeoutSec 60
}

function Test-Api {
  param([pscustomobject]$Config)
  $headers = @{ "x-radasa-agent-token" = $Config.token }
  Invoke-RestMethod `
    -Uri "$($Config.apiUrl.TrimEnd('/'))/api/sefaz-agent/status" `
    -Method Get `
    -Headers $headers `
    -TimeoutSec 20 | Out-Null
}

function Scan-Folder {
  param([pscustomobject]$Config, [hashtable]$State)

  if (-not (Test-Path -LiteralPath $Config.folderPath)) {
    throw "Pasta do SSAgro não encontrada: $($Config.folderPath)"
  }

  $files = Get-ChildItem `
    -LiteralPath $Config.folderPath `
    -Recurse `
    -File `
    -Filter "*.xml" `
    -ErrorAction Stop |
    Sort-Object LastWriteTime, FullName

  $found = 0
  $imported = 0
  $duplicated = 0
  $ignored = 0
  $failed = 0

  foreach ($file in $files) {
    if ($file.Length -le 0 -or $file.Length -gt ($Config.maxFileMb * 1MB)) {
      $ignored++
      continue
    }

    $signature = "$($file.Length):$($file.LastWriteTimeUtc.Ticks)"
    if ($State.ContainsKey($file.FullName) -and $State[$file.FullName] -eq $signature) {
      continue
    }

    try {
      # Aguarda para não ler enquanto o SSAgro ainda está gravando.
      Start-Sleep -Milliseconds $Config.stabilityMs
      $current = Get-Item -LiteralPath $file.FullName
      if ($current.Length -ne $file.Length -or $current.LastWriteTimeUtc.Ticks -ne $file.LastWriteTimeUtc.Ticks) {
        continue
      }

      $xml = Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8
      if (-not (Is-FullNfeXml $xml)) {
        $State[$file.FullName] = $signature
        $ignored++
        continue
      }

      $found++
      $hash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
      $response = Send-Xml -Config $Config -File $file -Hash $hash

      if ($response.status -eq "imported") {
        $imported++
        Write-Log "Importada: $($file.Name)"
      } else {
        $duplicated++
        Write-Log "Já existia: $($file.Name)"
      }

      $State[$file.FullName] = $signature
      Save-State -State $State -Path "$PSScriptRoot\agente-estado.json"
    } catch {
      $failed++
      Write-Log "Falha em $($file.FullName): $($_.Exception.Message)" "ERROR"
    }
  }

  Write-Log "Varredura: completas=$found importadas=$imported duplicadas=$duplicated ignoradas=$ignored falhas=$failed"
}

$config = Load-Json -Path $ConfigPath
$statePath = "$PSScriptRoot\agente-estado.json"
$state = Load-State -Path $statePath

Write-Log "Agente iniciado. Pasta: $($config.folderPath)"
Write-Log "API do Radasa: $($config.apiUrl)"

while ($true) {
  try {
    Test-Api -Config $config
    Scan-Folder -Config $config -State $state
  } catch {
    Write-Log $_.Exception.Message "ERROR"
  }

  if ($RunOnce) { break }
  Start-Sleep -Seconds $config.intervalSeconds
}
