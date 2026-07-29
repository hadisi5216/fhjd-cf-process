[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^https?://')]
  [string]$DashboardUrl,

  [switch]$StartNow
)

$ErrorActionPreference = 'Stop'
$sourceScript = Join-Path $PSScriptRoot 'Start-FhjdDashboard.ps1'
if (-not (Test-Path -LiteralPath $sourceScript)) {
  throw "Start script not found: $sourceScript"
}

$installDirectory = Join-Path $env:LOCALAPPDATA 'FHJD-Dashboard'
$installedScript = Join-Path $installDirectory 'Start-FhjdDashboard.ps1'
$startupDirectory = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startupDirectory 'FHJD Dashboard.lnk'
$powershellPath = (Get-Command powershell.exe).Source

New-Item -ItemType Directory -Path $installDirectory -Force | Out-Null
Copy-Item -LiteralPath $sourceScript -Destination $installedScript -Force

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $powershellPath
$shortcut.Arguments = @(
  '-NoLogo',
  '-NoProfile',
  '-NonInteractive',
  '-WindowStyle Hidden',
  '-ExecutionPolicy Bypass',
  "-File `"$installedScript`"",
  "-DashboardUrl `"$DashboardUrl`"",
  '-RestartOnExit'
) -join ' '
$shortcut.WorkingDirectory = $installDirectory
$shortcut.Description = 'FHJD product process dashboard'
$shortcut.Save()

Write-Host ''
Write-Host 'FHJD dashboard startup has been installed.'
Write-Host "Dashboard URL : $DashboardUrl"
Write-Host "Startup link  : $shortcutPath"
Write-Host "Log file      : $(Join-Path $installDirectory 'kiosk.log')"
Write-Host ''
Write-Host 'The dashboard opens after this Windows account signs in.'

if ($StartNow) {
  Start-Process `
    -FilePath $powershellPath `
    -ArgumentList @(
      '-NoLogo',
      '-NoProfile',
      '-WindowStyle',
      'Hidden',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      "`"$installedScript`"",
      '-DashboardUrl',
      "`"$DashboardUrl`"",
      '-RestartOnExit'
    )
}
