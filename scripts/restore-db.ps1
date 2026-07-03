param(
  [Parameter(Mandatory = $true)]
  [string]$InputFile
)

Get-Content $InputFile | docker exec -i fhjd-cf-process-postgres psql -U fhjd_cf fhjd_cf_process
Write-Host "Restore completed from $InputFile"
