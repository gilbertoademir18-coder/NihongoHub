# O banco em casa, acessado de fora pelo tailnet

Um banco só, na máquina de casa (`x570-aorus`, `100.65.76.22`). O código roda
onde você estiver — aqui ou lá — e os dois lados falam com o mesmo Postgres.
Assim o progresso de estudo é um só: não existe "o que estudei no trabalho" e
"o que estudei em casa" para reconciliar depois.

O preço disso está no fim, em **[O que dói nesse arranjo](#o-que-dói-nesse-arranjo)**.
Vale ler antes de começar, não depois.

---

## Em casa, na ordem

### 1. PostgreSQL 17

A mesma versão maior que roda aqui (17.11). Não precisa ser a mesma versão
menor, mas **precisa ser 17 ou mais nova**: `pg_restore` lê dump de versão
igual ou anterior, nunca de versão posterior. Instalar um 16 em casa faria o
backup daqui ser irrecuperável lá.

Baixe em <https://www.postgresql.org/download/windows/>. Na instalação:

- anote a senha do superusuário `postgres` — os scripts pedem;
- deixe a porta em **5432**;
- locale pode ficar no padrão. O banco é restaurado com encoding UTF-8 pelo
  script, que é o que importa para o japonês.

### 2. O repositório

```bash
git clone <o repositório> NihongoHub
cd NihongoHub
npm install
```

As imagens dos cards vêm no clone: elas são arquivos versionados em
`public/cards/`, não linhas no banco. É por isso que `git pull` conserta card
sem imagem — veja [as imagens](#as-imagens-viajam-pelo-git-não-pelo-banco).

### 3. Restaurar o backup

Copie a pasta `backups\` (ou só o `.dump` mais recente) para a máquina de
casa — pendrive, ou `scp` pelo próprio tailnet. Então:

```powershell
.\scripts\restaurar-banco.ps1
```

Ele pega o `.dump` mais recente de `backups\` e pede só a senha do
`postgres`. A senha do app ele gera sozinho. Cria o papel e o banco, restaura,
confere as contagens, escreve o `DATABASE_URL` no `.env` e roda
`prisma migrate status` para provar que a URL abre e que as migrações batem.

Ele **para** antes de mexer em qualquer coisa se o `.env` já tiver
`DATABASE_URL`, e para antes do restore se o banco já existir com tabelas —
em vez de misturar dois estados.

### 4. O `.env` de casa

O script já escreveu esta linha, com a senha gerada:

```
DATABASE_URL="postgresql://nihongohub:<senha>@127.0.0.1:5432/nihongohub?options=-c%20timezone%3DUTC"
```

É essa senha que vai no `.env` do trabalho (passo "Aqui, depois"), trocando
`127.0.0.1` pelo IP do tailnet.

Em casa o app fala com o banco por `127.0.0.1` — está na mesma máquina. O
`options=-c timezone=UTC` não é enfeite: sem ele, o vencimento dos cards passa
a depender do fuso de cada máquina, e estudar em dois lugares daria duas
respostas para "o que vence hoje".

Confira que subiu:

```bash
npm run dev
npm run imagens:conferir
```

### 5. Abrir a porta para o tailnet

O Postgres é compartilhado com os outros projetos da máquina, então quem
libera o acesso é o script comum, que mora no Creativa e serve para qualquer
projeto em que banco e usuário têm o mesmo nome:

```powershell
# PowerShell como administrador
cd C:\Projetos\Creativa
.\scripts\liberar-banco-no-tailnet.ps1 -Banco nihongohub
```

O acesso passa por três portões, e os três precisam estar abertos:

| O quê | Por quê |
| --- | --- |
| `listen_addresses = '*'` | O IP `100.x` só existe depois que o Tailscale sobe, e o Postgres sobe antes. Fixar o IP faria o banco não iniciar depois de um reboot. O script só confere este; nunca muda. |
| `pg_hba.conf`: `host nihongohub nihongohub 100.64.0.0/10 scram-sha-256` | Quem pode entrar: só este banco e este usuário, só da faixa do Tailscale, com senha. O script acrescenta a linha se faltar, com backup datado do arquivo. |
| Firewall: regra `PostgreSQL - tailnet`, TCP 5432 só de `100.64.0.0/10`, perfil Private | Segunda tranca. O `'*'` acima escuta em toda interface — Wi-Fi de hotel incluído; é esta regra que decide quem chega. Uma regra só para todos os projetos. |

Rodar de novo é seguro: cada passo confere o seu e só completa o que falta. O
`pg_hba` é aplicado com **reload**, nunca restart — um restart derrubaria os
outros projetos que usam o mesmo Postgres.

Para provar o `pg_hba`, conecte pelo IP do tailnet, nunca por `127.0.0.1`
(loopback passa mesmo com o `pg_hba` fechado):

```powershell
psql -h 100.65.76.22 -U nihongohub -d nihongohub -c "SELECT 1"
```

Isso não prova o firewall: conectar no próprio IP não passa por ele. O
firewall só se prova da outra máquina (veja "Aqui, depois"). O padrão
completo, com o que nunca fazer, está em
`C:\Projetos\Creativa\docs\padrao-de-projeto.md`, seção 7.

O `'*'` sozinho seria descuidado. É o par pg_hba + firewall que faz o acesso
ser só pelo tailnet.

### 6. Desligar a expiração da chave

Em <https://login.tailscale.com/admin/machines>, na máquina de casa:
**Disable key expiry**.

Sem isso, a chave do nó expira em alguns meses e o acesso morre sozinho — de
longe, sem aviso, e só resolvível voltando fisicamente na máquina.

### 7. Deixar a máquina acordada

Configurações → Sistema → Energia: suspensão em **nunca** (ao menos ligada na
tomada). Máquina dormindo é banco fora do ar, e o app aqui simplesmente falha
ao carregar qualquer tela.

---

## Aqui, depois

### 1. Apontar o `.env` para casa

```
DATABASE_URL="postgresql://nihongohub:<senha>@100.65.76.22:5432/nihongohub?options=-c%20timezone%3DUTC"
```

Guarde a linha antiga comentada logo acima. Quando a máquina de casa estiver
desligada, trocar de volta é a diferença entre continuar trabalhando e parar.

Não precisa de `sslmode`: o Tailscale é WireGuard, então o tráfego já vai
cifrado e autenticado entre as duas pontas. TLS por cima cifraria de novo o
que já está cifrado.

### 2. Conferir

```bash
npm run dev
npm run imagens:conferir
```

Se a conexão falhar, a ordem de investigação é esta — cada passo elimina uma
camada:

```powershell
tailscale status                                  # a máquina de casa aparece online?
Test-NetConnection 100.65.76.22 -Port 5432        # a porta responde?
psql -h 100.65.76.22 -U nihongohub -d nihongohub  # a senha e o pg_hba deixam entrar?
```

> **Use o IP, não o nome.** O Tailscale desta máquina está reclamando que não
> conseguiu configurar o DNS (`failed to set the DNS configuration`), então
> `x570-aorus` pode não resolver. `100.65.76.22` não depende disso.

---

## As imagens viajam pelo git, não pelo banco

O banco guarda `image_path`, que é **o caminho de um arquivo** — a imagem em si
mora em `public/cards/`, no disco de cada máquina.

Com o banco compartilhado, isso vira um descompasso silencioso: você envia uma
imagem aqui, o arquivo fica no disco daqui, e o banco — que a máquina de casa
também lê — passa a apontar para um arquivo que lá não existe. O card aparece
sem imagem, e nada avisa.

As 152 imagens atuais já são versionadas no git. A regra, então, é a mesma de
sempre para código:

```bash
# na máquina onde você enviou a imagem
git add public/cards && git commit -m "..." && git push
# na outra
git pull
```

E para descobrir se algo escapou:

```bash
npm run imagens:conferir
```

Ele lista cards apontando para arquivo ausente (problema: sai com código 1) e
arquivos que nenhum card usa (sobra: só ocupa disco).

---

## Backup

Agora o banco de casa é a **única** cópia do seu progresso. Antes havia uma só
porque o app era todo local; agora há uma só porque as duas máquinas olham
para a mesma.

```bash
npm run backup              # guarda em backups\, mantém os 10 últimos
npm run backup -- -Manter 30
```

Funciona igual apontando para `127.0.0.1` ou para o IP do tailnet — ele lê o
`.env`. Rodar daqui puxa o dump pela rede; para este tamanho (30KB) são
segundos.

O script **abre o arquivo depois de gravar** e só aí o conta como backup: dump
que não abre não é backup, e descobrir isso no dia em que precisa é tarde.

`backups\` é ignorada pelo git de propósito — binário que muda inteiro a cada
gravação incharia o repositório sem dar nada em troca.

---

## O que dói nesse arranjo

**Máquina de casa desligada = app parado.** Não é degradação, é falha: toda
tela consulta o banco. Se acontecer com frequência, o remédio é inverter o
arranjo — rodar o app inteiro em casa e daqui só abrir
`https://<máquina>.<tailnet>.ts.net:8446` no navegador. Esse endereço já
está publicado pelo `scripts\publicar-no-tailnet.ps1` (e o tray copia ele em
"Copiar link do tailnet").

**Cada página faz várias consultas, e todas atravessam a rede.** Tailscale
costuma fechar rota direta, então são alguns milissegundos por consulta; dá
para sentir, mas não atrapalha. Se um dia a conexão cair para relay (DERP), a
diferença fica evidente — `tailscale status` mostra qual das duas está valendo.

**Migração de banco roda de um lugar só.** `prisma migrate dev` compara o
schema do código com o do banco. Rodando dos dois lados com códigos
diferentes, um desfaz o outro. Antes de migrar: `git pull`, migre, `git push`.

**O `.env` não é versionado**, então a senha do banco tem que ser posta à mão
nas duas máquinas. É de propósito: senha em repositório é senha vazada.
