<#
    NihongoHub na bandeja do sistema.

    O servidor do Next precisa ficar vivo enquanto se estuda, mas isso não
    obriga ninguém a manter um prompt aberto na tela. Este script sobe o
    servidor como processo oculto e deixa na bandeja um ícone que diz se ele
    está no ar, com as ações que importam: abrir, reiniciar, ver o log e sair.

    Não depende de pacote nenhum: o WinForms já vem com o Windows.

    Não é para ser executado direto — use o NihongoHub.cmd, que o inicia sem
    janela. Rodando na mão, a janela do PowerShell fica aberta atrás do ícone,
    que é justamente o que queríamos evitar.
#>

# As funções seguem o português do resto do projeto. O analisador pede verbos
# aprovados em inglês (Get-, Start-, Stop-), regra que existe para cmdlets
# exportados por módulos e descobertos por terceiros — nada disso se aplica a
# funções privadas de um script que ninguém importa.
[Diagnostics.CodeAnalysis.SuppressMessageAttribute('PSUseApprovedVerbs', '')]
param(
    # Uso interno: marca o relançamento que já nasceu sem console. Ver abaixo.
    [switch]$SemConsole
)

$ErrorActionPreference = "Stop"

<#
    Sem console — de verdade.

    `-WindowStyle Hidden` não basta no Windows 11: quem hospeda o console é o
    Windows Terminal, e a janela pertence a ele. O PowerShell pede para
    esconder a própria janela, o pedido não tem a quem chegar, e sobra um
    terminal aberto a sessão inteira — exatamente o que este script existe
    para evitar.

    Esconder a janela é a abordagem errada; a certa é não ter janela. Aqui o
    script relança a si mesmo com CREATE_NO_WINDOW (o `CreateNoWindow` abaixo)
    e sai. O processo novo nasce sem console: não há janela para esconder nem
    host para hospedá-la, e nenhum terminal padrão muda isso.
#>
if (-not $SemConsole) {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName        = Join-Path $PSHOME "powershell.exe"
    $psi.Arguments       = "-NoProfile -ExecutionPolicy Bypass -STA -File `"$PSCommandPath`" -SemConsole"
    $psi.WorkingDirectory = Split-Path -Parent $PSScriptRoot
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow  = $true
    [System.Diagnostics.Process]::Start($psi) | Out-Null
    exit 0
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$RAIZ  = Split-Path -Parent $PSScriptRoot
$PORTA = 3100
$URL   = "http://localhost:$PORTA"
$BIN   = Join-Path $RAIZ "node_modules\next\dist\bin\next"

# A porta HTTPS que o `tailscale serve` publica (ver scripts\publicar-no-tailnet.ps1).
# A 443 desta máquina é de outro app, e a 8443 a 8445 são do Trimly e do Creativa.
$PORTA_TAILNET = 8446

# O log vai para fora do projeto: o .next é apagado a cada build, e um arquivo
# de log dentro da árvore versionada só serviria para sujar o git status.
$PASTA_LOG = Join-Path $env:LOCALAPPDATA "NihongoHub"
$LOG       = Join-Path $PASTA_LOG "servidor.log"

<#
    Lê uma chave do .env da raiz (o mesmo arquivo que o app lê). Parser de
    propósito simples: `CHAVE=valor`, aspas opcionais, `#` comenta a linha.
#>
function Ler-Env([string]$chave, [string]$padrao) {
    $arquivo = Join-Path $RAIZ ".env"
    if (Test-Path $arquivo) {
        foreach ($linha in Get-Content $arquivo -Encoding UTF8) {
            if ($linha -match "^\s*$chave\s*=\s*(.*?)\s*$") {
                return $Matches[1].Trim('"', "'")
            }
        }
    }
    return $padrao
}

# O navegador do "Abrir no ...": cada máquina escolhe o seu no .env.
$NAVEGADORES = @{
    edge    = @{ Nome = "Edge";    Caminhos = @(
        (Join-Path ${env:ProgramFiles(x86)} "Microsoft\Edge\Application\msedge.exe"),
        (Join-Path $env:ProgramFiles        "Microsoft\Edge\Application\msedge.exe")) }
    firefox = @{ Nome = "Firefox"; Caminhos = @(
        (Join-Path $env:ProgramFiles        "Mozilla Firefox\firefox.exe"),
        (Join-Path ${env:ProgramFiles(x86)} "Mozilla Firefox\firefox.exe"),
        (Join-Path $env:LOCALAPPDATA        "Mozilla Firefox\firefox.exe")) }
}
$NAVEGADOR = $NAVEGADORES[(Ler-Env "NAVEGADOR" "edge").ToLower()]
if (-not $NAVEGADOR) { $NAVEGADOR = $NAVEGADORES.edge }

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

    O ícone é o painel de estado, e não a notificação: balão some em quatro
    segundos, ícone fica. Cinza e meio apagado diz "não dá para estudar
    agora"; o selo no canto diz por quê, sem precisar parar o mouse em cima
    para ler a dica.

      verde    no ar, pode estudar
      vermelho o servidor caiu ou não subiu
      nenhum   subindo — estado passageiro, não vale alarme

    O desenho segue o do reWASD: o ícone recortado em círculo, e o selo com
    um anel preto em volta. O anel é de propósito: a bandeja pode estar sobre
    fundo claro ou escuro, e um ponto colorido sem contorno some num dos dois.
    Em 16x16, que é como o Windows costuma desenhá-lo, é esse contraste que o
    mantém legível. O selo invade a borda do círculo — é o que faz ele
    parecer pousado em cima, e não um pedaço do ícone.
#>
function Novo-Bitmap([bool]$apagado, [string]$selo) {
    $origem = [System.Drawing.Image]::FromFile((Join-Path $RAIZ "public\icon-192.png"))
    try {
        # Primeiro o desenho inteiro, colorido ou cinza, numa tela à parte...
        $plano = New-Object System.Drawing.Bitmap 32, 32
        $gp = [System.Drawing.Graphics]::FromImage($plano)
        $gp.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

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
        $gp.DrawImage($origem, $destino, 0, 0, $origem.Width, $origem.Height,
                      [System.Drawing.GraphicsUnit]::Pixel, $atrib)
        $gp.Dispose()

        # ...depois pintado como textura de um círculo. Recortar com SetClip
        # deixaria a borda serrilhada: o recorte não tem antisserrilhado, o
        # preenchimento tem.
        $tela = New-Object System.Drawing.Bitmap 32, 32
        $g = [System.Drawing.Graphics]::FromImage($tela)
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $textura = New-Object System.Drawing.TextureBrush $plano
        $g.FillEllipse($textura, 0, 0, 32, 32)
        $textura.Dispose()
        $plano.Dispose()

        if ($selo) {
            $cor = if ($selo -eq "verde") {
                [System.Drawing.Color]::FromArgb(255, 70, 200, 40)
            } else {
                [System.Drawing.Color]::FromArgb(255, 220, 45, 45)
            }
            # Encostado no canto: é o ponto mais longe do miolo do glifo, que
            # é o que mantém o 語 reconhecível com o selo por cima.
            $g.FillEllipse([System.Drawing.Brushes]::Black, 15, 15, 17, 17)
            $pincel = New-Object System.Drawing.SolidBrush $cor
            $g.FillEllipse($pincel, 17.5, 17.5, 12, 12)
            $pincel.Dispose()
        }

        $g.Dispose()
        return $tela
    } finally { $origem.Dispose() }
}

function Novo-Icone([bool]$apagado, [string]$selo) {
    $tela = Novo-Bitmap $apagado $selo
    return [System.Drawing.Icon]::FromHandle($tela.GetHicon())
}

# ---------------------------------------------------------------------------
# Servidor
# ---------------------------------------------------------------------------

$script:proc         = $null
$script:desde        = Get-Date
# Só o clique em "Abrir no <navegador>" liga isto. O navegador nunca abre por conta
# própria: nem ao subir, nem ao adotar um servidor que já estava rodando.
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

<# O navegador do .env (NAVEGADOR), se estiver instalado; senão o padrão do sistema. #>
function Abrir-Navegador {
    foreach ($e in $NAVEGADOR.Caminhos) {
        if (Test-Path $e) { Start-Process $e -ArgumentList $URL; return }
    }
    Start-Process $URL
}

<# O endereço HTTPS no tailnet, ou $null sem Tailscale. #>
function Url-Tailnet {
    try {
        $status = & tailscale status --json 2>$null | ConvertFrom-Json
        $nome = $status.Self.DNSName.TrimEnd(".")
        if ($nome) { return "https://${nome}:$PORTA_TAILNET" }
    } catch { }
    return $null
}

$WORKSPACE = Join-Path $RAIZ "NihongoHub.code-workspace"

<#
    Onde está o VS Code, ou $null.

    Chamar o `code` do PATH seria mais curto, mas ele é um `.cmd`: abriria um
    console por um instante a cada clique, que é exatamente o que este ícone
    existe para não fazer. O executável de verdade não abre nada.

    Abrir o `.code-workspace` pela associação de arquivo também não serve —
    numa instalação limpa do VS Code essa extensão não fica associada a nada,
    e o clique viraria a caixa "como você quer abrir este arquivo?".
#>
function Achar-VsCode {
    $candidatos = @(
        (Join-Path $env:LOCALAPPDATA        "Programs\Microsoft VS Code\Code.exe"),
        (Join-Path $env:ProgramFiles        "Microsoft VS Code\Code.exe"),
        (Join-Path ${env:ProgramFiles(x86)} "Microsoft VS Code\Code.exe"),
        (Join-Path $env:LOCALAPPDATA        "Programs\Microsoft VS Code Insiders\Code - Insiders.exe"),
        (Join-Path $env:ProgramFiles        "Microsoft VS Code Insiders\Code - Insiders.exe")
    )
    foreach ($c in $candidatos) { if (Test-Path $c) { return $c } }
    return $null
}

# ---------------------------------------------------------------------------
# Início automático
# ---------------------------------------------------------------------------

# A pasta Inicializar do usuário — pedida ao Windows em vez de montada à mão,
# porque o caminho muda com o idioma da instalação.
$ATALHO_STARTUP = Join-Path ([Environment]::GetFolderPath("Startup")) "NihongoHub.lnk"
$LANCADOR       = Join-Path $RAIZ "NihongoHub.cmd"

<#
    O atalho existe *e* aponta para esta cópia do projeto?

    Só a existência não serve: um atalho deixado para trás por uma pasta
    antiga marcaria a opção como ligada enquanto, na prática, não sobe nada.
    Comparando o alvo, mover o projeto apenas desmarca a opção — e religá-la
    reescreve o atalho para o lugar certo.
#>
function Inicio-Automatico-Ligado {
    if (-not (Test-Path $ATALHO_STARTUP)) { return $false }
    $shell = New-Object -ComObject WScript.Shell
    try {
        return ($shell.CreateShortcut($ATALHO_STARTUP).TargetPath -eq $LANCADOR)
    } finally {
        [Runtime.InteropServices.Marshal]::ReleaseComObject($shell) | Out-Null
    }
}

<#
    Liga ou desliga a subida junto com o Windows.

    A janela do atalho é "minimizada" (7): o NihongoHub.cmd ainda confere o
    Node e as dependências antes de passar a bola, e essa conferência precisa
    de um console — mas no login ela aparece na barra de tarefas em vez de
    saltar por cima do que estiver na tela.
#>
function Definir-Inicio-Automatico([bool]$ligar) {
    if (-not $ligar) {
        if (Test-Path $ATALHO_STARTUP) { Remove-Item $ATALHO_STARTUP -Force }
        return
    }
    $shell = New-Object -ComObject WScript.Shell
    try {
        $atalho = $shell.CreateShortcut($ATALHO_STARTUP)
        $atalho.TargetPath       = $LANCADOR
        $atalho.WorkingDirectory = $RAIZ
        $atalho.WindowStyle      = 7
        $atalho.Description      = "Põe o NihongoHub na bandeja do sistema"
        $atalho.Save()
    } finally {
        [Runtime.InteropServices.Marshal]::ReleaseComObject($shell) | Out-Null
    }
}

# ---------------------------------------------------------------------------
# Bandeja
# ---------------------------------------------------------------------------

[System.Windows.Forms.Application]::EnableVisualStyles()

$iconeNoAr    = Novo-Icone $false "verde"
$iconeSubindo = Novo-Icone $true  ""
$iconeParado  = Novo-Icone $true  "vermelho"

$bandeja = New-Object System.Windows.Forms.NotifyIcon
$bandeja.Icon    = $iconeSubindo
$bandeja.Text    = "NihongoHub"
$bandeja.Visible = $true

$menu = New-Object System.Windows.Forms.ContextMenuStrip
$bandeja.ContextMenuStrip = $menu

$itemAbrir = $menu.Items.Add("Abrir no $($NAVEGADOR.Nome)")
$itemAbrir.Font = New-Object System.Drawing.Font($menu.Font, [System.Drawing.FontStyle]::Bold)
$itemLink = $menu.Items.Add("Copiar link do tailnet")
$itemCode =$menu.Items.Add("Abrir no VS Code")
$itemReiniciar = $menu.Items.Add("Reiniciar o servidor")
$menu.Items.Add("-") | Out-Null
$itemStartup = $menu.Items.Add("Iniciar com o Windows")
$itemStartup.CheckOnClick = $true
$itemStartup.Checked = Inicio-Automatico-Ligado
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
            $bandeja.Icon = $iconeSubindo
            $bandeja.Text = "NihongoHub — subindo o servidor..."
        }
        "no-ar" {
            $bandeja.Icon = $iconeNoAr
            $bandeja.Text = "NihongoHub — no ar. Clique duas vezes para abrir."
        }
        "parado" {
            $bandeja.Icon = $iconeParado
            $bandeja.Text = "NihongoHub — parado"
        }
    }
    $itemReiniciar.Enabled = ($novo -ne "subindo")
}

<#
    Balão de notificação — só para o que deu errado.

    Sucesso não interrompe: quem conta que está tudo bem é o selo verde do
    ícone, e ele continua lá depois de o balão sumir. Balão de confirmação
    treina a pessoa a dispensar o aviso sem ler, e aí o único que importava
    passa despercebido junto.
#>
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

$itemLink.add_Click({
    $link = Url-Tailnet
    if (-not $link) {
        Avisar "Não consegui falar com o Tailscale. Ele está rodando?" "Error"
        return
    }
    [System.Windows.Forms.Clipboard]::SetText($link)
    Avisar "Copiado: $link`nAbra em outro PC do tailnet." "Info"
})

$itemCode.add_Click({
    $code = Achar-VsCode
    if (-not $code) {
        Avisar "Não encontrei o VS Code instalado nesta máquina." "Error"
        return
    }
    # Sem o arquivo de workspace, abre a pasta: o VS Code aceita as duas
    # coisas, e a pasta é o que se queria de qualquer jeito.
    $alvo = if (Test-Path $WORKSPACE) { $WORKSPACE } else { $RAIZ }
    Start-Process $code -ArgumentList "`"$alvo`""
})

$itemReiniciar.add_Click({
    Parar-Servidor
    $script:abrirAoSubir = $false
    Iniciar-Servidor
})

$itemStartup.add_Click({
    # `CheckOnClick` já virou a marca antes deste clique chegar aqui; é ela
    # que diz o que a pessoa acabou de pedir.
    try {
        Definir-Inicio-Automatico $itemStartup.Checked
    } catch {
        Avisar "Não consegui mudar o início automático: $($_.Exception.Message)" "Error"
    }
    # Quem manda é o arquivo, não a marca: se a escrita falhou, a marca volta
    # sozinha para a verdade em vez de mentir até o próximo clique.
    # Sem confirmação em balão: a marca do próprio item é a resposta, e ela
    # fica na tela enquanto o menu estiver aberto.
    $itemStartup.Checked = Inicio-Automatico-Ligado
})

# A pasta Inicializar e a instalação do VS Code podem mudar por fora — vale
# reler a cada abertura do menu, em vez de confiar no que era verdade quando o
# ícone subiu. Assim instalar o VS Code depois não exige reiniciar o ícone.
$menu.add_Opening({
    $itemStartup.Checked = Inicio-Automatico-Ligado
    $itemCode.Enabled = [bool](Achar-VsCode)
})

$itemLog.add_Click({
    if (Test-Path $LOG) { Start-Process notepad.exe -ArgumentList $LOG }
    else { Avisar "Ainda não há log: o servidor não subiu nesta sessão." "Warning" }
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
            # Sem balão de "está no ar": quem anuncia é o selo verde no
            # ícone, que continua lá depois de o balão ter sumido.
            Marcar "no-ar"
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
        # Já havia um servidor rodando — de um NihongoHub.cmd antigo, por exemplo.
        # Adotamos em vez de subir outro: a porta é uma só.
        Marcar "no-ar"
    } else {
        $bandeja.Visible = $false
        [System.Windows.Forms.MessageBox]::Show(
            "A porta $PORTA está ocupada por outro programa.`n`nFeche o que estiver usando essa porta, ou mude a porta em package.json (scripts dev e start) e em scripts\tray.ps1.",
            "NihongoHub", "OK", "Warning") | Out-Null
        exit 1
    }
} else {
    # Sobe o servidor, e só. O navegador é sempre um pedido explícito: este
    # ícone existe para o app estar de pé quando você quiser, e ele sobe junto
    # com o Windows — abrir uma janela por cima do que você estiver fazendo
    # seria o oposto de ficar fora do caminho.
    Iniciar-Servidor
}

[System.Windows.Forms.Application]::Run()

$bandeja.Dispose()
$tranca.ReleaseMutex()
