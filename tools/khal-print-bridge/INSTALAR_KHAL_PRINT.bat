@echo off
setlocal
cd /d "%~dp0"
title Khal Print Bridge - Instalacion

echo ===============================================
echo   KHAL PRINT BRIDGE - INSTALACION WINDOWS
echo ===============================================
echo.
where py >nul 2>nul
if %errorlevel%==0 (
  set PY=py
) else (
  where python >nul 2>nul
  if errorlevel 1 (
    echo ERROR: Python no esta instalado o no esta en PATH.
    echo Instala Python 3 para Windows y vuelve a ejecutar este archivo.
    pause
    exit /b 1
  )
  set PY=python
)

%PY% -m pip install --upgrade pywin32
if errorlevel 1 (
  echo ERROR: no se pudo instalar pywin32.
  pause
  exit /b 1
)

set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "LAUNCHER=%STARTUP%\Khal Print Bridge.bat"
>"%LAUNCHER%" echo @echo off
>>"%LAUNCHER%" echo cd /d "%~dp0"
>>"%LAUNCHER%" echo start "Khal Print Bridge" /min %PY% "%~dp0khal_print_bridge.py"

echo.
echo Instalacion terminada.
echo El puente se iniciara automaticamente con Windows.
echo Iniciando ahora...
start "Khal Print Bridge" /min %PY% "%~dp0khal_print_bridge.py"
echo.
echo Puedes cerrar esta ventana.
pause
