<#
    NihongoHub na bandeja do sistema.

    O servidor do Next precisa ficar vivo enquanto se estuda, mas isso não
    obriga ninguém a manter um prompt aberto na tela. Este script sobe o
    servidor como processo oculto e deixa na bandeja um ícone que diz se ele
    está no ar, com as ações que importam: abrir, reiniciar, ver o log e sair.

    Não depende de pacote nenhum: o WinForms já vem com o Windows.

    Não é para ser executado direto — use o abrir.cmd, que o inicia sem
    janela. Rodando na mão, a janela do PowerShell fica aberta atrás do ícone,
    que é justamente o que queríamos evitar.
#>

# As funções seguem o português do resto do projeto. O analisador pede verbos
# aprovados em inglês (Get-, Start-, Stop-), regra que existe para cmdlets
# exportados por módulos e descobertos por terceiros — nada disso se aplica a
# funções privadas de um script que ninguém importa.
[Diagnostics.CodeAnalysis.SuppressMessageAttribute('PSUseApprovedVerbs', '')]
param()

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$RAIZ  = Split-Path -Parent $PSScriptRoot
$PORTA = 3100
$URL   = "http://localhost:$PORTA"
$BIN   = Join-Path $RAIZ "node_modules\next\dist\bin\next"

# O log vai para fora do projeto: o .next é apagado a cada build, e um arquivo
# de log dentro da árvore versionada só serviria para sujar o git status.
$PASTA_LOG = Join-Path $env:LOCALAPPDATA "NihongoHub"
$LOG       = Join-Path $PASTA_LOG "servidor.log"

# ---------------------------------------------------------------------------
# Uma instância só. Dois ícones na bandeja disputando a mesma porta não
# ajudariam ninguém, e o segundo acharia que o servidor do primeiro é dele.
# ---------------------------------------------------------------------------
$souOUnico = $false
$tranca = New-Object System.Threading.Mutex($true, "NihongoHubTray", [ref]$souOUnico)
if (-not $souOUnico) {
    [System.Windows.Forms.MessageBox]::Show(
        "O NihongoHub já está na bandeja do sistema.`n`nProcure o ícone perto do relógio — pode estar escondido na setinha.",
        "NihongoHub", "OK", "Information") | Out-Null
    exit 0
}

# ---------------------------------------------------------------------------
# Estado da porta
# ---------------------------------------------------------------------------

<#
    Quem ouve na porta, sem abrir conexão.

    É consultado a cada tique do relógio, então precisa ser barato: esta
    chamada gerenciada custa milissegundos, enquanto Get-NetTCPConnection
    custa centenas — e travaria o menu justamente enquanto o servidor sobe.
#>
function Porta-Ouvindo {
    $escutas = [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()
    foreach ($e in $escutas) { if ($e.Port -eq $PORTA) { return $true } }
    return $false
}

<# O PID de quem ocupa a porta. Só é preciso ao parar, então pode ser caro. #>
function Pid-NaPorta {
    try {
        $c = Get-NetTCPConnection -LocalPort $PORTA -State Listen -ErrorAction Stop | Select-Object -First 1
        return $c.OwningProcess
    } catch { return $null }
}

# Processos que o Next e o npm empilham entre o lançador e o servidor. Só por
# estes a busca abaixo pode subir; o explorer.exe ou o terminal que iniciou
# tudo ficam de fora, e é neles que a subida para.
$ANDAIME = @("node.exe", "cmd.exe", "npm.exe")

<#
    O topo da árvore do servidor, a partir de quem ocupa a porta.

    Quem escuta na 3100 não é quem foi iniciado: o `next dev` levanta um
    processo separado para o servidor, e o npm põe mais dois degraus de
    cmd.exe no meio. Matar só o dono da porta deixaria três processos vivos,
    um deles pronto para reabri-la.

    A subida para no primeiro processo que não seja andaime — e também se o
    "pai" nasceu depois do filho, o que não é parentesco e sim um PID
    reciclado pelo Windows.
#>
function Raiz-DoServidor {
    $raiz = Pid-NaPorta
    if (-not $raiz) { return $null }

    $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$raiz" -ErrorAction SilentlyContinue
    for ($nivel = 0; $nivel -lt 6 -and $proc; $nivel++) {
        $pai = Get-CimInstance Win32_Process -Filter "ProcessId=$($proc.ParentProcessId)" -ErrorAction SilentlyContinue
        if (-not $pai) { break }
        if ($ANDAIME -notcontains $pai.Name.ToLower()) { break }
        if ($pai.CreationDate -gt $proc.CreationDate) { break }
        $raiz = $pai.ProcessId
        $proc = $pai
    }
    return $raiz
}

<#
    A porta responder não basta: outro projeto atendendo ali faria o ícone
    anunciar "no ar" e abrir o navegador no app errado.

    A paciência é de propósito. Em desenvolvimento a primeira resposta espera
    o Turbopack compilar a home — medido em 3s aqui — e um limite curto
    acusaria "porta ocupada por outro programa" logo depois de o servidor
    subir, que é o pior momento possível para um alarme falso. Quem de fato
    for outro programa responde na hora, com o conteúdo errado; só o caso
    genuinamente quebrado paga a espera inteira.
#>
function E-O-NihongoHub {
    try {
        $r = Invoke-WebRequest -Uri $URL -UseBasicParsing -TimeoutSec 30
        return ($r.Content -match "NihongoHub")
    } catch { return $false }
}

# ---------------------------------------------------------------------------
# Ícone
# ---------------------------------------------------------------------------

<#
    Monta o ícone da bandeja a partir do PNG do PWA, em 32x32.

    Cinza e meio apagado enquanto o servidor sobe, ou depois que ele cai: de
    relance, perto do relógio, a cor responde "dá para estudar agora?" sem
    precisar parar o mouse em cima para ler a dica.
#>
function Novo-Icone([bool]$apagado) {
    $origem = [System.Drawing.Image]::FromFile((Join-Path $RAIZ "public\icon-192.png"))
    try {
        $tela = New-Object System.Drawing.Bitmap 32, 32
        $g = [System.Drawing.Graphics]::FromImage($tela)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

        $atrib = New-Object System.Drawing.Imaging.ImageAttributes
        if ($apagado) {
            $m = New-Object System.Drawing.Imaging.ColorMatrix
            # Pesos de luminância. As nove casas cobrem a diagonal RGB inteira,
            # então não sobra nada da identidade original reintroduzindo cor.
            $m.Matrix00 = 0.299; $m.Matrix01 = 0.299; $m.Matrix02 = 0.299
            $m.Matrix10 = 0.587; $m.Matrix11 = 0.587; $m.Matrix12 = 0.587
            $m.Matrix20 = 0.114; $m.Matrix21 = 0.114; $m.Matrix22 = 0.114
            $m.Matrix33 = 0.55
            $atrib.SetColorMatrix($m)
        }

        $destino = New-Object System.Drawing.Rectangle 0, 0, 32, 32
        $g.DrawImage($origem, $destino, 0, 0, $origem.Width, $origem.Height,
                     [System.Drawing.GraphicsUnit]::Pixel, $atrib)
        $g.Dispose()

        return [System.Drawing.Icon]::FromHandle($tela.GetHicon())
    } finally { $origem.Dispose() }
}

# ---------------------------------------------------------------------------
# Servidor
# ---------------------------------------------------------------------------

$script:proc         = $null
$script:desde        = Get-Date
$script:abrirAoSubir = $false

<#
    Sobe o `next dev` oculto, com a saída indo para o log.

    A saída vai para arquivo pelo próprio cmd, e não pelos pipes do .NET, por
    um motivo prático: pipe redirecionado que ninguém lê enche o buffer e
    congela o processo filho — e aqui não há janela onde ler nada.

    Chama o binário do Next direto, em vez de `npm run dev`, para que o
    processo que guardamos seja o servidor de verdade, e não um npm que ao
    morrer deixa o node órfão segurando a porta.
#>
function Iniciar-Servidor {
    if (-not (Test-Path $PASTA_LOG)) { New-Item -ItemType Directory -Path $PASTA_LOG | Out-Null }

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName         = $env:ComSpec
    $psi.Arguments        = "/c node `"$BIN`" dev -p $PORTA 1>`"$LOG`" 2>&1"
    $psi.WorkingDirectory = $RAIZ
    $psi.UseShellExecute  = $false
    $psi.CreateNoWindow   = $true

    $script:proc  = [System.Diagnostics.Process]::Start($psi)
    $script:desde = Get-Date
    Marcar "subindo"
}

<#
    Derruba o servidor e tudo que ele abriu.

    `taskkill /T` é o que alcança a árvore inteira: o Next levanta processos
    filhos, e matar só o pai deixaria a porta ocupada por um fantasma.
#>
function Parar-Servidor {
    $alvos = @()
    if ($script:proc -and -not $script:proc.HasExited) { $alvos += $script:proc.Id }
    # Também pela porta: quando o ícone adotou um servidor que já estava no ar,
    # não existe $proc nenhum para matar.
    $raiz = Raiz-DoServidor
    if ($raiz) { $alvos += $raiz }

    foreach ($alvo in ($alvos | Select-Object -Unique)) {
        try { & taskkill /PID $alvo /T /F 2>$null | Out-Null } catch { }
    }
    $script:proc = $null

    # Esperar a porta de fato vagar, em vez de chutar um tempo: subir outro
    # servidor com a porta ainda ocupada só trocaria um erro por outro.
    for ($i = 0; $i -lt 30 -and (Porta-Ouvindo); $i++) { Start-Sleep -Milliseconds 100 }
}

<# O Edge, se estiver instalado; senão o navegador padrão do sistema. #>
function Abrir-Navegador {
    $candidatos = @(
        (Join-Path ${env:ProgramFiles(x86)} "Microsoft\Edge\Application\msedge.exe"),
        (Join-Path $env:ProgramFiles        "Microsoft\Edge\Application\msedge.exe")
    )
    foreach ($e in $candidatos) {
        if (Test-Path $e) { Start-Process $e -ArgumentList $URL; return }
    }
    Start-Process $URL
}

# ---------------------------------------------------------------------------
# Bandeja
# ---------------------------------------------------------------------------

[System.Windows.Forms.Application]::EnableVisualStyles()

$iconeVivo    = Novo-Icone $false
$iconeApagado = Novo-Icone $true

$bandeja = New-Object System.Windows.Forms.NotifyIcon
$bandeja.Icon    = $iconeApagado
$bandeja.Text    = "NihongoHub"
$bandeja.Visible = $true

$menu = New-Object System.Windows.Forms.ContextMenuStrip
$bandeja.ContextMenuStrip = $menu

$itemAbrir = $menu.Items.Add("Abrir no Edge")
$itemAbrir.Font = New-Object System.Drawing.Font($menu.Font, [System.Drawing.FontStyle]::Bold)
$itemReiniciar = $menu.Items.Add("Reiniciar o servidor")
$menu.Items.Add("-") | Out-Null
$itemLog = $menu.Items.Add("Ver o log")
$menu.Items.Add("-") | Out-Null
$itemSair = $menu.Items.Add("Sair")

$script:estado = "parado"

<#
    O único lugar que muda estado, dica e ícone juntos.

    Espalhar `$bandeja.Text = ...` pelos vários caminhos é como o ícone acaba
    dizendo "subindo" com o servidor já no ar.
#>
function Marcar([string]$novo) {
    $script:estado = $novo
    switch ($novo) {
        "subindo" {
            $bandeja.Icon = $iconeApagado
            $bandeja.Text = "NihongoHub — subindo o servidor..."
        }
        "no-ar" {
            $bandeja.Icon = $iconeVivo
            $bandeja.Text = "NihongoHub — no ar em localhost:$PORTA"
        }
        "parado" {
            $bandeja.Icon = $iconeApagado
            $bandeja.Text = "NihongoHub — parado"
        }
    }
    $itemReiniciar.Enabled = ($novo -ne "subindo")
}

function Avisar([string]$texto, [string]$tipo) {
    $bandeja.ShowBalloonTip(4000, "NihongoHub", $texto, $tipo)
}

# ---------------------------------------------------------------------------
# Ações do menu
# ---------------------------------------------------------------------------

$itemAbrir.add_Click({
    if ($script:estado -eq "no-ar") {
        Abrir-Navegador
        return
    }
    # Pedir para abrir com o servidor parado é, na prática, pedir para subir:
    # abrir o navegador agora só entregaria uma página de erro.
    $script:abrirAoSubir = $true
    if ($script:estado -ne "subindo") { Iniciar-Servidor }
})

$bandeja.add_DoubleClick({ $itemAbrir.PerformClick() })

$itemReiniciar.add_Click({
    Avisar "Reiniciando o servidor..." "Info"
    Parar-Servidor
    $script:abrirAoSubir = $false
    Iniciar-Servidor
})

$itemLog.add_Click({
    if (Test-Path $LOG) { Start-Process notepad.exe -ArgumentList $LOG }
    else { Avisar "Ainda não há log: o servidor não subiu nesta sessão." "Info" }
})

$itemSair.add_Click({
    Parar-Servidor
    # Sem isto o ícone fica de fantasma na bandeja até o mouse passar por cima.
    $bandeja.Visible = $false
    [System.Windows.Forms.Application]::Exit()
})

# ---------------------------------------------------------------------------
# Relógio: acompanha o servidor sem travar o menu
# ---------------------------------------------------------------------------

$relogio = New-Object System.Windows.Forms.Timer
$relogio.Interval = 1000
$relogio.add_Tick({
    $ouvindo = Porta-Ouvindo

    if ($script:estado -eq "subindo") {
        if ($ouvindo) {
            Marcar "no-ar"
            Avisar "Servidor no ar em localhost:$PORTA" "Info"
            if ($script:abrirAoSubir) {
                Abrir-Navegador
                $script:abrirAoSubir = $false
            }
            return
        }
        # Morreu antes de abrir a porta: quase sempre erro de compilação ou
        # banco fora do ar, e só o log diz qual dos dois.
        if ($script:proc -and $script:proc.HasExited) {
            Marcar "parado"
            Avisar "O servidor não subiu. Abra 'Ver o log' para saber por quê." "Error"
            return
        }
        if (((Get-Date) - $script:desde).TotalSeconds -gt 120) {
            Marcar "parado"
            Avisar "O servidor demorou demais para responder. Veja o log." "Warning"
        }
        return
    }

    if ($script:estado -eq "no-ar" -and -not $ouvindo) {
        Marcar "parado"
        Avisar "O servidor parou. Use 'Reiniciar o servidor'." "Warning"
    }
})
$relogio.Start()

# ---------------------------------------------------------------------------
# Partida
# ---------------------------------------------------------------------------

if (Porta-Ouvindo) {
    if (E-O-NihongoHub) {
        # Já havia um servidor rodando — de um abrir.cmd antigo, por exemplo.
        # Adotamos em vez de subir outro: a porta é uma só.
        Marcar "no-ar"
        Abrir-Navegador
    } else {
        $bandeja.Visible = $false
        [System.Windows.Forms.MessageBox]::Show(
            "A porta $PORTA está ocupada por outro programa.`n`nFeche o que estiver usando essa porta, ou mude a porta em package.json (scripts dev e start) e em scripts\tray.ps1.",
            "NihongoHub", "OK", "Warning") | Out-Null
        exit 1
    }
} else {
    $script:abrirAoSubir = $true
    Iniciar-Servidor
    Avisar "Subindo o servidor... o Edge abre sozinho." "Info"
}

[System.Windows.Forms.Application]::Run()

$bandeja.Dispose()
$tranca.ReleaseMutex()
