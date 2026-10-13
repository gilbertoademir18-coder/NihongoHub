<#
.SYNOPSIS
    Publica o NihongoHub (8446) no tailnet, em HTTPS.

.DESCRIPTION
    Os outros PCs e o celular chegam ao app pelo Tailscale. O `tailscale serve`
    entrega HTTPS com certificado válido para o nome da máquina no tailnet
    (`*.ts.net`), sem nada a configurar à mão.

    Nesta máquina a 443 já é de outro app e a 8443 a 8445 são do Trimly e do
    Creativa, então o NihongoHub fica na 8446. Só quem está no seu tailnet
    enxerga o endereço — não é a internet aberta (isso seria o
    `tailscale funnel`, que não usamos).

    O app roda em `next dev`, que recusa assets pedidos de um host que não é
    o dele: é o `allowedDevOrigins` do `next.config.ts` que deixa o `*.ts.net`
    passar.

    Roda uma vez: com `--bg` o Tailscale guarda a configuração e a refaz
    sozinho depois de reiniciar a máquina.

.EXAMPLE
    .\scripts\publicar-no-tailnet.ps1

.EXAMPLE
    .\scripts\publicar-no-tailnet.ps1 -Desligar
#>

[CmdletBinding()]
param(
    [int]$PortaHttps = 8446,
    [int]$PortaApp = 3100,
    [switch]$Desligar
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command tailscale.exe -ErrorAction SilentlyContinue)) {
    Write-Host "  x Não achei o tailscale.exe no PATH." -ForegroundColor Red
    exit 1
}

if ($Desligar) {
    & tailscale serve "--https=$PortaHttps" off
    exit $LASTEXITCODE
}

& tailscale serve --bg "--https=$PortaHttps" "http://127.0.0.1:$PortaApp"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$nome = (& tailscale status --json | ConvertFrom-Json).Self.DNSName.TrimEnd(".")
Write-Host ""
Write-Host "  NihongoHub no tailnet: https://${nome}:$PortaHttps" -ForegroundColor Green
