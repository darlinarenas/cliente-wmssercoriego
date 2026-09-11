@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r=Invoke-RestMethod -UseBasicParsing -TimeoutSec 4 http://127.0.0.1:17891/health; Write-Host 'KHAL PRINT ACTIVO' -ForegroundColor Green; Write-Host ('Version: ' + $r.version); Write-Host ('Zebra detectadas: ' + $r.printers); if($r.printer){Write-Host ('Impresora: ' + $r.printer)}; exit 0 } catch { Write-Host 'KHAL PRINT NO RESPONDE' -ForegroundColor Red; exit 1 }"
echo.
pause
