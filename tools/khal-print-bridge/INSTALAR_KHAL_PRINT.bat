@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Khal Print - Instalacion

echo ===============================================
echo   KHAL PRINT - IMPRESION ZEBRA LOCAL
echo ===============================================
echo.
where py >nul 2>nul
if %errorlevel%==0 (set "PY=py") else (
  where python >nul 2>nul
  if errorlevel 1 (
    echo ERROR: Python 3 no esta instalado en este computador.
    echo Instala Python 3 para Windows marcando "Add Python to PATH" y ejecuta de nuevo.
    pause & exit /b 1
  )
  set "PY=python"
)

%PY% -m pip install --user pywin32
if errorlevel 1 (echo ERROR: no se pudo instalar pywin32. & pause & exit /b 1)

set "DEST=%LOCALAPPDATA%\KhalPrint"
if not exist "%DEST%" mkdir "%DEST%"
copy /Y "%~dp0khal_print_bridge.py" "%DEST%\khal_print_bridge.py" >nul

set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "LAUNCHER=%STARTUP%\Khal Print Bridge.bat"
>"%LAUNCHER%" echo @echo off
>>"%LAUNCHER%" echo start "Khal Print" /min %PY% "%DEST%\khal_print_bridge.py"

taskkill /FI "WINDOWTITLE eq Khal Print*" /T /F >nul 2>nul
start "Khal Print" /min %PY% "%DEST%\khal_print_bridge.py"

echo.
echo Khal Print quedo instalado en este PC.
echo No usa una IP fija de impresora: detecta las Zebra instaladas en ESTE Windows.
echo Se iniciara automaticamente cada vez que abras Windows.
echo.
timeout /t 2 >nul
start "" "http://127.0.0.1:17891/health"
pause
