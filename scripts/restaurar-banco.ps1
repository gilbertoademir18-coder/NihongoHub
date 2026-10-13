<#
.SYNOPSIS
    Cria o papel, o banco e restaura um backup do NihongoHub.

.DESCRIPTION
    Existe para a máquina nova: depois de instalar o PostgreSQL, isto põe o
    banco de pé a partir de um arquivo de `backups\`. Roda os mesmos comandos
    que se faria à mão, na ordem certa e conferindo o resultado — que é
    justamente o que se erra digitando tudo de novo tarde da noite.

    Idempotente: papel e banco existentes são reaproveitados, e o restore
    recusa banco que já tenha tabelas, para não misturar dois estados.

    No fim, escreve o DATABASE_URL no `.env` e confere com o Prisma que as
    migrações do banco batem com as do código. Se o `.env` já tiver
    DATABASE_URL, o script para antes de tudo: trocar a senha do papel
    deixaria o app sem conseguir entrar no banco que ele já usa.

.EXAMPLE
    .\scripts\restaurar-banco.ps1 -Dump .\backups\nihongohub-20260925-1542.dump

.NOTES
    Pede só a senha do superusuário `postgres` (a que você definiu na
    instalação), que não fica no disco nem no histórico do PowerShell. A senha
    do app é gerada aqui e só existe no `.env`.

    O papel ganha CREATEDB porque o `prisma migrate dev` cria um banco-sombra
    temporário para calcular o diff. Não é superusuário e não enxerga os outros
    bancos do servidor.
#>

[CmdletBinding()]
param(
    # O arquivo .dump a restaurar. Sem isto, pega o mais recente de `backups\`.
    [string]$Dump,
    [string]$Banco = "nihongohub",
    [string]$Usuario = "nihongohub",
    # Quem tem permissão de criar banco e papel. `postgres` no instalador
    # padrão do Windows; muda em instalação gerenciada.
    [string]$Superusuario = "postgres",
    # Para automação. Sem ela, o script pergunta — que é o normal, porque
    # senha em parâmetro fica no histórico do PowerShell.
    [string]$SenhaSuper,
    # Sem isto, uma senha aleatória é gerada. Passe quando quiser a mesma
    # senha que já está no .env de outra máquina.
    [string]$SenhaApp
)

$ErrorActionPreference = "Stop"
$RAIZ = Split-Path -Parent $PSScriptRoot
$ENV_ARQUIVO = Join-Path $RAIZ ".env"

function Falar([string]$texto) { Write-Host $texto }

# O PowerShell 5.1 embrulha cada linha de stderr de um executável num
# ErrorRecord quando ela é redirecionada, e com `$ErrorActionPreference =
# "Stop"` isso vira exceção. O pg_restore recusando um arquivo inválido
# estouraria cru, no lugar do recado que escrevemos logo abaixo. Quem manda
# aqui é o código de saída, não o fato de o programa ter escrito em stderr.
function Rodar([string]$exe, [string[]]$argumentos) {
    $antes = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try { & $exe @argumentos 2>&1 } finally { $ErrorActionPreference = $antes }
}
function Erro([string]$texto) { Write-Host "  x $texto" -ForegroundColor Red }
function Feito([string]$texto) { Write-Host "  - $texto" -ForegroundColor Green }

if ((Test-Path $ENV_ARQUIVO) -and (Select-String -Path $ENV_ARQUIVO -Pattern '^\s*DATABASE_URL\s*=' -Quiet)) {
    Erro "O .env já tem DATABASE_URL. Nada a fazer."
    Falar "    Se é para refazer o banco do zero, tire a linha do .env antes."
    exit 1
}

# --- Onde estão os binários -------------------------------------------------
# Descobertos pelo serviço, e não por caminho fixo: a versão do PostgreSQL da
# máquina nova pode não ser a mesma daqui, e um 17 escrito na unha viraria um
# "arquivo não encontrado" sem explicação.
$servico = Get-CimInstance Win32_Service -Filter "Name LIKE 'postgresql-%'" |
    Sort-Object Name -Descending | Select-Object -First 1
if (-not $servico) {
    Erro "Não achei nenhum serviço do PostgreSQL nesta máquina."
    Falar "    Instale o PostgreSQL antes: https://www.postgresql.org/download/windows/"
    exit 1
}
if ($servico.PathName -notmatch 'pg_ctl\.exe"?\s') {
    Erro "O serviço $($servico.Name) não parece do PostgreSQL."
    exit 1
}
$BIN = Split-Path -Parent ($servico.PathName -replace '^"([^"]+)".*$', '$1')
Falar "PostgreSQL: $($servico.Name) ($($servico.State))"
Falar "Binários:   $BIN"

if ($servico.State -ne "Running") {
    Erro "O serviço está $($servico.State). Suba-o antes: Start-Service $($servico.Name)"
    exit 1
}

$psql = Join-Path $BIN "psql.exe"
$pgRestore = Join-Path $BIN "pg_restore.exe"
foreach ($exe in @($psql, $pgRestore)) {
    if (-not (Test-Path $exe)) { Erro "Não achei $exe"; exit 1 }
}

# --- Qual backup ------------------------------------------------------------
if (-not $Dump) {
    $candidato = Get-ChildItem (Join-Path $RAIZ "backups") -Filter "*.dump" -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime | Select-Object -Last 1
    if (-not $candidato) {
        Erro "Nenhum .dump em $RAIZ\backups. Passe o caminho em -Dump."
        exit 1
    }
    $Dump = $candidato.FullName
}
$Dump = (Resolve-Path $Dump).Path
Falar ("Backup:     $Dump ({0:N0} bytes)" -f (Get-Item $Dump).Length)

# Ler o índice do dump é a forma barata de saber se o arquivo presta antes de
# criar qualquer coisa — um arquivo truncado falha aqui, e não no meio.
$indice = Rodar $pgRestore @("-l", $Dump)
if ($LASTEXITCODE -ne 0) {
    Erro "O arquivo não parece um dump válido:"
    $indice | Select-Object -First 5 | ForEach-Object { Falar "    $_" }
    exit 1
}
$tabelas = ($indice | Select-String "TABLE DATA").Count
Feito "dump legível, $tabelas tabelas com dados"

# --- Senhas -----------------------------------------------------------------
function Texto($segredo) {
    if ($segredo -is [System.Security.SecureString]) {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR(
            [Runtime.InteropServices.Marshal]::SecureStringToBSTR($segredo))
    }
    return [string]$segredo
}

Falar ""
if (-not $SenhaSuper) { $SenhaSuper = Read-Host "Senha de '$Superusuario'" -AsSecureString }

$env:PGPASSWORD = Texto $SenhaSuper

& $psql -h 127.0.0.1 -U $Superusuario -d postgres -Atc "select 1" | Out-Null
if ($LASTEXITCODE -ne 0) {
    Erro "Não consegui entrar como '$Superusuario'. Senha errada?"
    $env:PGPASSWORD = ""
    exit 1
}
Feito "conectado como '$Superusuario'"

# --- Papel ------------------------------------------------------------------
$temPapel = (& $psql -h 127.0.0.1 -U $Superusuario -d postgres -Atc `
    "select 1 from pg_roles where rolname = '$Usuario'") -eq "1"

if ($SenhaApp) {
    $SenhaApp = Texto $SenhaApp
} else {
    # Só letras e números: a senha vai dentro de uma URL, e assim não precisa
    # de escape nenhum.
    $caracteres = [char[]]"ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"
    $bytes = New-Object byte[] 32
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $SenhaApp = -join ($bytes | ForEach-Object { $caracteres[$_ % $caracteres.Length] })
}

# Mesmo com o papel já existindo, a senha é redefinida: o .env que vamos
# escrever precisa conseguir entrar.
#
# A senha entra por variável do psql, não interpolada no SQL: senha com aspas
# quebraria o comando, e o texto ficaria legível no log do servidor. E vai
# pela entrada padrão, não por `-c`: o psql não substitui variáveis no `-c`.
$verbo = if ($temPapel) { "ALTER" } else { "CREATE" }
"$verbo ROLE $Usuario WITH LOGIN CREATEDB PASSWORD :'senha';" |
    & $psql -h 127.0.0.1 -U $Superusuario -d postgres -v "senha=$SenhaApp" -v ON_ERROR_STOP=1 -Atq | Out-Null
if ($LASTEXITCODE -ne 0) { Erro "Falhou ao $verbo o papel '$Usuario'."; $env:PGPASSWORD = ""; exit 1 }
Feito $(if ($temPapel) { "papel '$Usuario' já existia — senha redefinida" } else { "papel '$Usuario' criado" })

# --- Banco ------------------------------------------------------------------
$temBanco = & $psql -h 127.0.0.1 -U $Superusuario -d postgres -Atc `
    "select 1 from pg_database where datname = '$Banco'"

if ($temBanco -eq "1") {
    $quantas = & $psql -h 127.0.0.1 -U $Superusuario -d $Banco -Atc `
        "select count(*) from information_schema.tables where table_schema = 'public'"
    if ([int]$quantas -gt 0) {
        Erro "O banco '$Banco' já existe e tem $quantas tabelas."
        Falar "    Restaurar por cima misturaria dois estados. Se quer recomeçar:"
        Falar "      psql -U $Superusuario -c ""DROP DATABASE $Banco"""
        $env:PGPASSWORD = ""
        exit 1
    }
    Feito "banco '$Banco' já existia, e está vazio"
} else {
    & $psql -h 127.0.0.1 -U $Superusuario -d postgres -Atc `
        "CREATE DATABASE $Banco OWNER $Usuario ENCODING 'UTF8' TEMPLATE template0" | Out-Null
    if ($LASTEXITCODE -ne 0) { Erro "Falhou ao criar o banco '$Banco'."; $env:PGPASSWORD = ""; exit 1 }
    Feito "banco '$Banco' criado"
}

# --- Restore ----------------------------------------------------------------
Falar ""
Falar "Restaurando..."
Rodar $pgRestore @("-h", "127.0.0.1", "-U", $Superusuario, "-d", $Banco,
    "--no-owner", "--role=$Usuario", $Dump) | ForEach-Object { Falar "    $_" }
if ($LASTEXITCODE -ne 0) {
    Erro "pg_restore terminou com código $LASTEXITCODE — veja as mensagens acima."
    $env:PGPASSWORD = ""
    exit 1
}

# O dump vem sem dono (--no-owner) para não depender de os papéis daqui terem
# os mesmos nomes; a posse é atribuída agora, de uma vez.
& $psql -h 127.0.0.1 -U $Superusuario -d $Banco -Atc @"
DO `$`$
DECLARE r record;
BEGIN
  EXECUTE 'ALTER SCHEMA public OWNER TO $Usuario';
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO $Usuario', r.tablename);
  END LOOP;
  FOR r IN SELECT sequencename FROM pg_sequences WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER SEQUENCE public.%I OWNER TO $Usuario', r.sequencename);
  END LOOP;
  FOR r IN SELECT typname FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
           WHERE n.nspname = 'public' AND t.typtype = 'e' LOOP
    EXECUTE format('ALTER TYPE public.%I OWNER TO $Usuario', r.typname);
  END LOOP;
END `$`$;
"@ | Out-Null

# --- Conferência ------------------------------------------------------------
$contagem = & $psql -h 127.0.0.1 -U $Superusuario -d $Banco -Atc `
    "select 'decks='||(select count(*) from decks)||' cards='||(select count(*) from cards)||' reviews='||(select count(*) from reviews)||' migracoes='||(select count(*) from _prisma_migrations)"
Feito "restaurado: $contagem"

$env:PGPASSWORD = $SenhaApp
$comoApp = & $psql -h 127.0.0.1 -U $Usuario -d $Banco -Atc "select count(*) from cards"
$env:PGPASSWORD = ""
if ($LASTEXITCODE -ne 0) {
    Erro "O banco restaurou, mas '$Usuario' não consegue ler. Confira o pg_hba.conf."
    exit 1
}
Feito "'$Usuario' lê o banco ($comoApp cards)"

# --- .env -------------------------------------------------------------------
# timezone=UTC na conexão: sem ele, o vencimento dos cards passa a depender do
# fuso de cada máquina, e estudar em dois lugares daria duas respostas para "o
# que vence hoje".
$url = "postgresql://${Usuario}:$SenhaApp@127.0.0.1:5432/${Banco}?options=-c%20timezone%3DUTC"
# UTF-8 sem BOM: o `-Encoding utf8` do PowerShell 5.1 põe BOM, e o Node leria
# a primeira chave como "<BOM>DATABASE_URL" — variável que ninguém procura.
[IO.File]::AppendAllText($ENV_ARQUIVO, "DATABASE_URL=`"$url`"`r`n", (New-Object Text.UTF8Encoding $false))
Feito ".env escrito"

# O Prisma lendo o .env recém-escrito é a prova de ponta a ponta: a URL abre,
# e as migrações do banco são as mesmas do código.
Push-Location $RAIZ
try {
    Rodar "npx.cmd" @("prisma", "migrate", "status", "--config", "prisma7.config.ts") |
        ForEach-Object { Falar "    $_" }
    if ($LASTEXITCODE -ne 0) {
        Erro "O Prisma acha que banco e código divergem — veja acima."
        exit 1
    }
    Feito "migrações do banco batem com as do código"
} finally { Pop-Location }

Falar ""
Falar "Para liberar o acesso pelo tailnet, rode em seguida (como administrador):"
Falar "  C:\Projetos\Creativa\scripts\liberar-banco-no-tailnet.ps1 -Banco nihongohub"
