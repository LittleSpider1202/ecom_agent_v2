$pid = 56132
$proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
if ($proc) {
    Write-Host "PID: $pid"
    Write-Host "Name: $($proc.Name)"
    Write-Host "Path: $($proc.Path)"
    Write-Host "CPU: $($proc.CPU)"
} else {
    Write-Host "Process $pid not found"
}
# Also show all python/uvicorn processes
Write-Host ""
Write-Host "All python processes:"
Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "*python*" } | Select-Object Id, Name, Path | Format-Table
