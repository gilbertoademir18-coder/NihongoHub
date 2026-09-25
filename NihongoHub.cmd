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

rem Sem `start`: isto roda no console que ja existe, em vez de abrir outro.
rem O tray.ps1 se relanca sem console nenhum e devolve o controle na hora,
rem entao esta janela fecha sozinha em vez de ficar aberta a sessao inteira.
rem
rem -ExecutionPolicy Bypass evita depender da politica da maquina, que no
rem Windows 11 barra scripts por padrao.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\tray.ps1"

endlocal
