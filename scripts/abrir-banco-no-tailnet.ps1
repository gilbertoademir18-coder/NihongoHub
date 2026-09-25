<#
.SYNOPSIS
    Deixa o PostgreSQL desta máquina aceitar conexões vindas do tailnet.

.DESCRIPTION
    Três mudanças, todas conferidas antes de aplicar:

      1. `listen_addresses = '*'` no postgresql.conf;
      2. uma linha no pg_hba.conf liberando a faixa do Tailscale (100.64/10)
         com scram-sha-256;
      3. uma regra de firewall na porta 5432 restrita a essa mesma faixa.

    O par (2) e (3) é o que importa: `listen_addresses = '*'` sozinho abriria
    a porta para a rede local e para qualquer Wi-Fi em que a máquina entrar. É
    o pg_hba e o firewall que decidem quem passa, e os dois apontam só para o
    tailnet.

    Por que '*' e não o IP do Tailscale direto: o endereço 100.x só existe
    depois que o serviço do Tailscale sobe, e o PostgreSQL costuma subir
    antes. Escrito na unha, o banco não iniciaria depois de um reboot.

    Idempotente: rodar de novo não duplica linha nem regra.

.EXAMPLE
    # Num PowerShell aberto como administrador:
    .\scripts\abrir-banco-no-tailnet.ps1

.EXAMPLE
    # Só mostra o que mudaria, sem tocar em nada:
    .\scripts\abrir-banco-no-tailnet.ps1 -Simular
#>

[CmdletBinding()]
param(
    # Mostra as mudanças e sai, sem escrever nem reiniciar o serviço.
    [switch]$Simular,
    # Mexe só nos arquivos de configuração: não cria regra de firewall nem
    # reinicia o serviço. Útil para aplicar agora e reiniciar na hora que der.
    [switch]$SomenteArquivos,
    # Diretório de dados do cluster. Descoberto pelo serviço quando omitido;
    # informe quando houver mais de um cluster na máquina.
    [string]$Dados,
    # A faixa de endereços do Tailscale. Só mude se souber por quê.
    [string]$Faixa = "100.64.0.0/10",
    [int]$Porta = 5432
)

$ErrorActionPreference = "Stop"

function Falar([string]$t) { Write-Host $t }
function Erro([string]$t) { Write-Host "  x $t" -ForegroundColor Red }
function Feito([string]$t) { Write-Host "  - $t" -ForegroundColor Green }
function Muda([string]$t) { Write-Host "  + $t" -ForegroundColor Yellow }

# --- Precisa de administrador -----------------------------------------------
$souAdmin = ([Security.Principal.WindowsPrincipal] `
    [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
        [Security.Principal.WindowsBuiltInRole]::Administrator)
# Só as etapas de firewall e de serviço exigem administrador. `-SomenteArquivos`
# e `-Simular` não chegam nelas, e barrá-los aqui seria exigir privilégio para
# não usá-lo.
if (-not $souAdmin -and -not $Simular -and -not $SomenteArquivos) {
    Erro "Abra o PowerShell como administrador — mexer no firewall e no"
    Falar "    serviço do PostgreSQL exige isso."
    Falar "    Para só ver o que mudaria: .\scripts\abrir-banco-no-tailnet.ps1 -Simular"
    exit 1
}
if (-not $souAdmin -and $SomenteArquivos) {
    Muda "sem administrador: a gravação só funciona se você puder escrever no"
    Falar "    diretório de dados do PostgreSQL."
}

# --- Onde mora a configuração -----------------------------------------------
$servico = Get-CimInstance Win32_Service -Filter "Name LIKE 'postgresql-%'" |
    Sort-Object Name -Descending | Select-Object -First 1
if (-not $servico -and -not $Dados) {
    Erro "Nenhum serviço do PostgreSQL nesta máquina."
    exit 1
}

# O diretório de dados vem do próprio comando do serviço: é a única fonte que
# não erra quando a instalação não usou o caminho padrão.
if ($Dados) {
    $DADOS = (Resolve-Path $Dados).Path
} elseif ($servico.PathName -match '-D\s+"([^"]+)"') {
    $DADOS = $matches[1]
} else {
    Erro "Não consegui achar o -D no comando do serviço:"
    Falar "    $($servico.PathName)"
    exit 1
}
$confPrincipal = Join-Path $DADOS "postgresql.conf"
$confHba = Join-Path $DADOS "pg_hba.conf"

if ($servico) { Falar "Serviço:  $($servico.Name) ($($servico.State))" }
Falar "Dados:    $DADOS"
foreach ($f in @($confPrincipal, $confHba)) {
    if (-not (Test-Path $f)) { Erro "Não achei $f"; exit 1 }
}

# --- Tailscale: qual é o IP desta máquina -----------------------------------
$tsExe = "C:\Program Files\Tailscale\tailscale.exe"
$meuIp = $null
if (Test-Path $tsExe) {
    $meuIp = (& $tsExe ip -4 2>$null | Select-Object -First 1)
}
if ($meuIp) {
    Feito "Tailscale ativo: esta máquina é $meuIp"
} else {
    Muda "Tailscale não respondeu. A configuração vai ficar pronta, mas o"
    Falar "    acesso só funciona depois de instalar e entrar no Tailscale."
}

$carimbo = Get-Date -Format "yyyyMMdd-HHmmss"
$mudou = $false

# --- 1. listen_addresses ----------------------------------------------------
$linhas = Get-Content $confPrincipal
# O `#?` importa: numa instalação recém-feita a linha vem comentada, e um
# filtro sem ele devolveria nada — o script quebrava ao formatar o "antes".
$atual = $linhas | Where-Object { $_ -match "^\s*#?\s*listen_addresses\s*=" } | Select-Object -Last 1
$jaAberto = $atual -and ($atual -match "^\s*listen_addresses\s*=\s*'\*'")
$de = if ($atual) { $atual.Trim() } else { "(linha ausente)" }

if ($jaAberto) {
    Feito "listen_addresses já é '*'"
} else {
    Muda "listen_addresses: $de -> listen_addresses = '*'"
    if (-not $Simular) {
        try {
            Copy-Item $confPrincipal "$confPrincipal.$carimbo.bak"
            $novas = $linhas | ForEach-Object {
                if ($_ -match "^\s*#?\s*listen_addresses\s*=") {
                    "listen_addresses = '*'		# NihongoHub: acesso pelo tailnet ($carimbo)"
                } else { $_ }
            }
            Set-Content $confPrincipal $novas -Encoding ascii
        } catch {
            Erro "Não consegui gravar $($confPrincipal)"
            Falar "    $($_.Exception.Message)"
            Falar "    Reabra o PowerShell como administrador."
            exit 1
        }
        $mudou = $true
    }
}

# --- 2. pg_hba.conf ---------------------------------------------------------
$hba = Get-Content $confHba
$marca = "# NihongoHub: acesso pelo tailnet"
$regra = "host    all             all             $Faixa            scram-sha-256"

if ($hba -match [regex]::Escape($Faixa)) {
    Feito "pg_hba.conf já libera $Faixa"
} else {
    Muda "pg_hba.conf: + $regra"
    if (-not $Simular) {
        try {
            Copy-Item $confHba "$confHba.$carimbo.bak"
            Add-Content $confHba @("", $marca, $regra) -Encoding ascii
        } catch {
            Erro "Não consegui gravar $($confHba)"
            Falar "    $($_.Exception.Message)"
            Falar "    Reabra o PowerShell como administrador."
            exit 1
        }
        $mudou = $true
    }
}

# --- 3. Firewall ------------------------------------------------------------
$nomeRegra = "NihongoHub PostgreSQL (tailnet)"
$regraFw = Get-NetFirewallRule -DisplayName $nomeRegra -ErrorAction SilentlyContinue

if ($SomenteArquivos) {
    Feito "firewall: pulado (-SomenteArquivos)"
} elseif ($regraFw) {
    Feito "regra de firewall '$nomeRegra' já existe"
} else {
    Muda "firewall: + '$nomeRegra' (TCP $Porta, só de $Faixa)"
    if (-not $Simular) {
        New-NetFirewallRule -DisplayName $nomeRegra -Direction Inbound -Action Allow `
            -Protocol TCP -LocalPort $Porta -RemoteAddress $Faixa -Profile Any | Out-Null
    }
}

# --- Aplicar ----------------------------------------------------------------
if ($Simular) {
    Falar ""
    Falar "Simulação: nada foi alterado."
    exit 0
}

if ($mudou -and $SomenteArquivos) {
    Falar ""
    Feito "arquivos gravados. Reinicie quando puder: Restart-Service $($servico.Name)"
    exit 0
}

if ($mudou) {
    Falar ""
    Falar "Reiniciando $($servico.Name)..."
    Restart-Service $servico.Name -Force
    Start-Sleep -Seconds 2
    Feito "serviço reiniciado (cópias .bak ficaram em $DADOS)"
}

# --- Conferência ------------------------------------------------------------
Falar ""
$escutando = Get-NetTCPConnection -State Listen -LocalPort $Porta -ErrorAction SilentlyContinue
if (-not $escutando) {
    Erro "Ninguém está escutando na porta $Porta. O serviço subiu?"
    Falar "    Veja o log em $DADOS\log\"
    exit 1
}
Feito "escutando em: $(($escutando.LocalAddress | Sort-Object -Unique) -join ', ')"

if ($meuIp -and ($escutando.LocalAddress -contains "0.0.0.0" -or $escutando.LocalAddress -contains $meuIp)) {
    Feito "a porta $Porta responde no endereço do tailnet"
    Falar ""
    Falar "Da outra máquina, o DATABASE_URL fica:"
    Falar "  postgresql://nihongohub:<senha>@${meuIp}:${Porta}/nihongohub?options=-c%20timezone%3DUTC"
    Falar ""
    Falar "Antes de sair de casa, desligue a expiração da chave desta máquina em"
    Falar "  https://login.tailscale.com/admin/machines"
    Falar "Sem isso o acesso para de funcionar sozinho em alguns meses."
}
