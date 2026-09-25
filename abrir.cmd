@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

title NihongoHub

rem Este arquivo nao segura mais o servidor: ele so prepara o terreno e
rem entrega o app ao icone da bandeja (scripts\tray.ps1), que roda sem
rem janela. As unicas coisas que ainda merecem uma janela sao as que podem
rem falhar antes de existir icone para avisar.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo   [ERRO] Node.js nao encontrado.
    echo   Instale em https://nodejs.org e tente de novo.
    echo.
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo.
    echo   NihongoHub
    echo   ----------
    echo.
    echo   Primeira execucao: instalando dependencias...
    echo   Isso leva alguns minutos, mas so acontece uma vez.
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo   [ERRO] Falha ao instalar as dependencias.
        pause
        exit /b 1
    )
)

rem -WindowStyle Hidden esconde o console do PowerShell; -ExecutionPolicy
rem Bypass evita depender da politica da maquina, que no Windows 11 barra
rem scripts por padrao. Sem /b: o tray precisa sobreviver ao fim desta
rem janela, e com /b ele herdaria este console e morreria junto.
start "" powershell -NoProfile -ExecutionPolicy Bypass -STA -WindowStyle Hidden -File "%~dp0scripts\tray.ps1"

endlocal
