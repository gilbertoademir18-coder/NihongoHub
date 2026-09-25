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

Ele pega o `.dump` mais recente de `backups\`, pede a senha do `postgres` e a
senha que o app vai usar, cria o papel e o banco, restaura e confere as
contagens. Se o banco já existir com tabelas, ele **para** em vez de misturar
dois estados.

No fim, ele imprime o `DATABASE_URL` para o `.env` de casa.

### 4. O `.env` de casa

```
DATABASE_URL="postgresql://nihongohub:<senha>@127.0.0.1:5432/nihongohub?options=-c%20timezone%3DUTC"
```

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

```powershell
# PowerShell como administrador
.\scripts\abrir-banco-no-tailnet.ps1
```

Para ver o que ele faria sem tocar em nada: `-Simular`.

Ele faz três coisas, guardando cópia `.bak` de cada arquivo que altera:

| O quê | Por quê |
| --- | --- |
| `listen_addresses = '*'` | O IP `100.x` só existe depois que o Tailscale sobe, e o Postgres sobe antes. Fixar o IP faria o banco não iniciar depois de um reboot. |
| `pg_hba.conf`: `100.64.0.0/10  scram-sha-256` | Quem pode entrar. Restringe à faixa do Tailscale, não à internet. |
| Firewall: TCP 5432 só de `100.64.0.0/10` | Segunda tranca. O `'*'` acima escuta em toda interface — Wi-Fi de hotel incluído; é esta regra que decide quem chega. |

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
`http://100.65.76.22:3100` no navegador.

**Cada página faz várias consultas, e todas atravessam a rede.** Tailscale
costuma fechar rota direta, então são alguns milissegundos por consulta; dá
para sentir, mas não atrapalha. Se um dia a conexão cair para relay (DERP), a
diferença fica evidente — `tailscale status` mostra qual das duas está valendo.

**Migração de banco roda de um lugar só.** `prisma migrate dev` compara o
schema do código com o do banco. Rodando dos dois lados com códigos
diferentes, um desfaz o outro. Antes de migrar: `git pull`, migre, `git push`.

**O `.env` não é versionado**, então a senha do banco tem que ser posta à mão
nas duas máquinas. É de propósito: senha em repositório é senha vazada.
