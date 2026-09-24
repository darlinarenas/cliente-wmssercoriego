@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Khal Print - Instalacion

echo ===============================================
echo   KHAL PRINT 1.8 - IMPRESION ZEBRA
echo ===============================================
echo.
echo Instalando Khal Print en segundo plano...

set "DEST=%LOCALAPPDATA%\KhalPrint"
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "STARTCMD=%STARTUP%\KhalPrint.cmd"

if not exist "%DEST%" mkdir "%DEST%"
if not exist "%STARTUP%" mkdir "%STARTUP%"

taskkill /IM KhalPrint.exe /F >nul 2>nul
timeout /t 1 /nobreak >nul

copy /Y "%~dp0KhalPrint.exe" "%DEST%\KhalPrint.exe" >nul
if errorlevel 1 (
  echo ERROR: No se pudo copiar KhalPrint.exe.
  echo Descomprime primero el ZIP completo y ejecuta este instalador.
  pause
  exit /b 1
)

> "%STARTCMD%" echo @echo off
>>"%STARTCMD%" echo start "" "%DEST%\KhalPrint.exe"

if not exist "%STARTCMD%" (
  echo ERROR: No se pudo registrar Khal Print en el inicio de Windows.
  pause
  exit /b 2
)

rem Compatibilidad adicional con Inicio de Windows.
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "KhalPrint" /t REG_SZ /d "\"%DEST%\KhalPrint.exe\"" /f >nul 2>nul

start "" "%DEST%\KhalPrint.exe"
timeout /t 3 /nobreak >nul

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r=Invoke-RestMethod -UseBasicParsing -TimeoutSec 4 http://127.0.0.1:17892/health; if ($r.ok) { Write-Host ('Khal Print ' + $r.version + ' activo. Zebra detectadas: ' + $r.printers); if($r.printer){Write-Host ('Impresora: ' + $r.printer)}; exit 0 } else { exit 1 } } catch { exit 1 }"
if errorlevel 1 (
  echo.
  echo ERROR: Khal Print no respondio en este computador.
  echo Si persiste, envia el archivo %%TEMP%%\khal-print-error.txt.
  pause
  exit /b 3
)

echo.
echo ===============================================
echo   KHAL PRINT INSTALADO CORRECTAMENTE
echo ===============================================
echo.
echo Ejecutable: %DEST%\KhalPrint.exe
echo Configuracion: %DEST%\config.json
echo Inicio Windows: %STARTCMD%
echo.
echo Ya puedes volver a Khal y configurar esta PC como puente.
echo.
pause
