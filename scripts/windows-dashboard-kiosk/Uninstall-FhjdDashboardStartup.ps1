[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$installDirectory = Join-Path $env:LOCALAPPDATA 'FHJD-Dashboard'
$startupDirectory = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startupDirectory 'FHJD Dashboard.lnk'
$desktopDirectory = [Environment]::GetFolderPath('Desktop')
$desktopShortcutPath = Join-Path $desktopDirectory 'FHJD Dashboard.lnk'

Remove-Item -LiteralPath $shortcutPath -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $desktopShortcutPath -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $installDirectory -Recurse -Force -ErrorAction SilentlyContinue

Write-Host 'FHJD dashboard shortcuts have been removed.'
