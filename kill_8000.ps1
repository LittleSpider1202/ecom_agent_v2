$conns = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
foreach ($c in $conns) {
    $pid = $c.OwningProcess
    Write-Host "Killing PID $pid"
    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
}
Write-Host "Done"
