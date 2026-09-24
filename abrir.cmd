@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

set "PORTA=3000"
set "URL_APP=http://localhost:%PORTA%"

title NihongoHub

echo.
echo   NihongoHub
echo   ----------
echo.

rem Procura o Edge nos dois caminhos de instalacao possiveis. Se nao achar,
rem NAVEGADOR fica vazio e o app abre no navegador padrao do sistema.
set "NAVEGADOR="
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "NAVEGADOR=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined NAVEGADOR if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "NAVEGADOR=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not defined NAVEGADOR echo   [AVISO] Microsoft Edge nao encontrado. Usando o navegador padrao.

rem Se a porta ja responde, o servidor esta de pe: so abre o navegador.
powershell -NoProfile -Command "$c=New-Object Net.Sockets.TcpClient; try{$c.Connect('localhost',%PORTA%);$c.Close();exit 0}catch{exit 1}" >nul 2>&1
if %errorlevel% equ 0 (
    echo   O servidor ja esta rodando. Abrindo no Edge...
    if defined NAVEGADOR (
        start "" "%NAVEGADOR%" "%URL_APP%"
    ) else (
        start "" "%URL_APP%"
    )
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

echo   Iniciando o servidor... o Edge abre sozinho.
echo   Para parar: feche esta janela ou pressione Ctrl+C.
echo.

rem Espera a porta atender e so entao abre o navegador, em paralelo ao
rem servidor que roda logo abaixo nesta mesma janela.
rem
rem O caminho vai por variavel de ambiente (herdada pelo PowerShell) em vez
rem de interpolado na linha: assim espacos em "Program Files" nao quebram o
rem comando, sem precisar de niveis de aspas escapadas.
start "" /b powershell -NoProfile -WindowStyle Hidden -Command ^
    "for($i=0;$i -lt 150;$i++){try{$c=New-Object Net.Sockets.TcpClient;$c.Connect('localhost',%PORTA%);$c.Close();if($env:NAVEGADOR){Start-Process $env:NAVEGADOR -ArgumentList $env:URL_APP}else{Start-Process $env:URL_APP};break}catch{Start-Sleep -Milliseconds 400}}"

rem O servidor fica em primeiro plano para que os logs (e os erros) fiquem
rem visiveis nesta janela.
call npm run dev

endlocal
