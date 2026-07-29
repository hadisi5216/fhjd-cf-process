[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^https?://')]
  [string]$DashboardUrl,

  [ValidateRange(1, 300)]
  [int]$RetrySeconds = 5,

  [switch]$RestartOnExit
)

$ErrorActionPreference = 'Stop'
$stateDirectory = Join-Path $env:LOCALAPPDATA 'FHJD-Dashboard'
$profileDirectory = Join-Path $stateDirectory 'EdgeProfile'
$logFile = Join-Path $stateDirectory 'kiosk.log'

New-Item -ItemType Directory -Path $stateDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $profileDirectory -Force | Out-Null

function Write-KioskLog {
  param([string]$Message)

  $line = '{0} {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
  Add-Content -LiteralPath $logFile -Value $line -Encoding UTF8
}

function Get-EdgePath {
  $candidates = @(
    (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path $env:LOCALAPPDATA 'Microsoft\Edge\Application\msedge.exe')
  )

  return $candidates |
    Where-Object { $_ -and (Test-Path -LiteralPath $_) } |
    Select-Object -First 1
}

$mutex = [System.Threading.Mutex]::new($false, 'Local\FHJD-Dashboard-Kiosk')
try {
  try {
    $ownsMutex = $mutex.WaitOne(0, $false)
  } catch [System.Threading.AbandonedMutexException] {
    $ownsMutex = $true
  }

  if (-not $ownsMutex) {
    exit 0
  }

  $edgePath = Get-EdgePath
  if (-not $edgePath) {
    Write-KioskLog 'Microsoft Edge was not found.'
    exit 1
  }

  Write-KioskLog "Kiosk started. URL: $DashboardUrl"

  while ($true) {
    while ($true) {
      try {
        $response = Invoke-WebRequest `
          -Uri $DashboardUrl `
          -UseBasicParsing `
          -TimeoutSec 8
        if ($response.StatusCode -lt 500) {
          break
        }
      } catch {
        Write-KioskLog "Waiting for dashboard: $($_.Exception.Message)"
      }

      Start-Sleep -Seconds $RetrySeconds
    }

    try {
      $arguments = @(
        '--kiosk',
        $DashboardUrl,
        '--edge-kiosk-type=fullscreen',
        '--kiosk-idle-timeout-minutes=0',
        '--no-first-run',
        '--disable-session-crashed-bubble',
        "--user-data-dir=$profileDirectory"
      )
      $edgeProcess = Start-Process `
        -FilePath $edgePath `
        -ArgumentList $arguments `
        -PassThru
      Write-KioskLog "Edge opened. PID: $($edgeProcess.Id)"
      Wait-Process -Id $edgeProcess.Id -ErrorAction SilentlyContinue
      if (-not $RestartOnExit) {
        Write-KioskLog 'Edge exited.'
        break
      }
      Write-KioskLog 'Edge exited. It will be restarted.'
    } catch {
      Write-KioskLog "Unable to start Edge: $($_.Exception.Message)"
      if (-not $RestartOnExit) {
        break
      }
    }

    Start-Sleep -Seconds $RetrySeconds
  }
} finally {
  if ($ownsMutex) {
    $mutex.ReleaseMutex()
  }
  $mutex.Dispose()
}
