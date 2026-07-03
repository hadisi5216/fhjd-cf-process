param(
  [string]$Output = ".\backup-fhjd-cf-process.sql"
)

docker exec fhjd-cf-process-postgres pg_dump -U fhjd_cf fhjd_cf_process | Out-File -Encoding utf8 $Output
Write-Host "Backup written to $Output"
