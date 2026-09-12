@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Khal Print - Instalacion

echo ===============================================
echo   KHAL PRINT 1.6 - IMPRESION ZEBRA
echo ===============================================
echo.
echo Instalando Khal Print en segundo plano...
set "DEST=%LOCALAPPDATA%\KhalPrint"
if not exist "%DEST%" mkdir "%DEST%"

taskkill /IM KhalPrint.exe /F >nul 2>nul
timeout /t 1 /nobreak >nul
copy /Y "%~dp0KhalPrint.exe" "%DEST%\KhalPrint.exe" >nul
if errorlevel 1 (
  echo ERROR: No se pudo copiar KhalPrint.exe.
  echo Comprueba que el ZIP este descomprimido y vuelve a intentar.
  pause
  exit /b 1
)

reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "KhalPrint" /t REG_SZ /d "\"%DEST%\KhalPrint.exe\"" /f >nul
if errorlevel 1 (
  echo AVISO: Windows no permitio registrar el inicio automatico.
)

start "" "%DEST%\KhalPrint.exe"
timeout /t 3 /nobreak >nul

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r=Invoke-RestMethod -UseBasicParsing -TimeoutSec 4 http://127.0.0.1:17891/health; if ($r.ok) { Write-Host ('Zebra detectadas: ' + $r.printers); if($r.printer){Write-Host ('Impresora: ' + $r.printer)}; exit 0 } else { exit 1 } } catch { exit 1 }"
if errorlevel 1 (
  echo.
  echo ERROR: Khal Print no respondio en este computador.
  echo Cierra esta ventana y vuelve a ejecutar el instalador.
  echo Si persiste, envia el archivo %%TEMP%%\khal-print-error.txt.
  echo.
  pause
  exit /b 2
)

echo.
echo ===============================================
echo   KHAL PRINT INSTALADO CORRECTAMENTE
echo ===============================================
echo.
echo Khal Print queda activo EN SEGUNDO PLANO.
echo NO debe quedar una consola negra abierta.
echo No necesita Python, pip ni pywin32.
echo.
echo Ya puedes volver a Khal y pulsar:
echo   "Ya lo instale - detectar Zebra"
echo.
pause
