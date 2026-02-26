# Kill all processes on port 8001
$conns = Get-NetTCPConnection -LocalPort 8001 -State Listen -ErrorAction SilentlyContinue
foreach ($c in $conns) {
    $proc = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
    Write-Host "Killing PID $($c.OwningProcess): $($proc.Name)"
    Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
}
# Also kill ecom uvicorn python processes
$ecomPython = Get-Process -ErrorAction SilentlyContinue | Where-Object {
    $_.Name -like "*python*" -and $_.Path -like "*pythoncore*"
}
foreach ($p in $ecomPython) {
    Write-Host "Killing ecom python PID $($p.Id)"
    Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 2
$remaining = Get-NetTCPConnection -LocalPort 8001 -State Listen -ErrorAction SilentlyContinue
if ($remaining) {
    Write-Host "Still listening on 8001"
} else {
    Write-Host "Port 8001 is now free"
}
