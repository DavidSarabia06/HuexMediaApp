@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0documentacion\scripts\docs.ps1" %*
if errorlevel 1 (
    echo.
    echo No se ha podido iniciar o generar la documentacion.
    pause
    exit /b 1
)
