@echo off
setlocal EnableExtensions
taskkill /IM KhalPrint.exe /F >nul 2>nul
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "KhalPrint" /f >nul 2>nul
rmdir /S /Q "%LOCALAPPDATA%\KhalPrint" >nul 2>nul
echo Khal Print fue desinstalado para este usuario.
pause
