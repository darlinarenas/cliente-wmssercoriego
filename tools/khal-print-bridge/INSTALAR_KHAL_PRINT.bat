@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Khal Print - Instalacion

echo ===============================================
echo   KHAL PRINT - IMPRESION ZEBRA LOCAL
echo ===============================================
echo.

echo Instalando componente autonomo de Khal Print...
set "DEST=%LOCALAPPDATA%\KhalPrint"
if not exist "%DEST%" mkdir "%DEST%"

taskkill /IM KhalPrint.exe /F >nul 2>nul
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
  echo Khal Print se abrira ahora, pero podria requerir inicio manual tras reiniciar.
)

start "" "%DEST%\KhalPrint.exe"
timeout /t 2 /nobreak >nul

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r=Invoke-RestMethod -UseBasicParsing -TimeoutSec 3 http://127.0.0.1:17891/health; if ($r.ok) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>nul
if errorlevel 1 (
  echo.
  echo Khal Print fue copiado, pero el servicio local no respondio todavia.
  echo Reinicia Khal Print o el computador y vuelve a pulsar Detectar Zebra.
  echo.
  pause
  exit /b 2
)

echo.
echo ===============================================
echo   KHAL PRINT INSTALADO CORRECTAMENTE
echo ===============================================
echo.
echo No necesita Python, pip ni pywin32.
echo Detecta las impresoras Zebra instaladas en ESTE Windows.
echo No usa una IP fija de impresora ni depende de la red.
echo Se iniciara automaticamente con tu sesion de Windows.
echo.
echo Ya puedes volver a Khal y pulsar:
echo   "Ya lo instale - detectar Zebra"
echo.
pause
