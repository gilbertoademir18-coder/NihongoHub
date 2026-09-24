@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

set "PORTA=3000"
set "URL=http://localhost:%PORTA%"

title NihongoHub

echo.
echo   NihongoHub
echo   ----------
echo.

rem Se a porta ja responde, o servidor esta de pe: so abre o navegador.
powershell -NoProfile -Command "$c=New-Object Net.Sockets.TcpClient; try{$c.Connect('localhost',%PORTA%);$c.Close();exit 0}catch{exit 1}" >nul 2>&1
if %errorlevel% equ 0 (
    echo   O servidor ja esta rodando. Abrindo o navegador...
    start "" "%URL%"
    exit /b 0
)

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo   [ERRO] Node.js nao encontrado.
    echo   Instale em https://nodejs.org e tente de novo.
    echo.
    pause
    exit /b 1
)

if not exist "node_modules\" (
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
    echo.
)

echo   Iniciando o servidor... o navegador abre sozinho.
echo   Para parar: feche esta janela ou pressione Ctrl+C.
echo.

rem Espera a porta atender e so entao abre o navegador, em paralelo ao
rem servidor que roda logo abaixo nesta mesma janela.
start "" /b powershell -NoProfile -WindowStyle Hidden -Command ^
    "for($i=0;$i -lt 150;$i++){try{$c=New-Object Net.Sockets.TcpClient;$c.Connect('localhost',%PORTA%);$c.Close();Start-Process '%URL%';break}catch{Start-Sleep -Milliseconds 400}}"

rem O servidor fica em primeiro plano para que os logs (e os erros) fiquem
rem visiveis nesta janela.
call npm run dev

endlocal
