# NihongoHub

Flashcards de kanji e vocabulário japonês com repetição espaçada, em Next.js 16
com PostgreSQL.

## Começando

No Windows, **dê um duplo clique em `NihongoHub.cmd`**. Ele instala as
dependências na primeira vez e sobe o servidor.

O servidor não fica numa janela: ele vira um **ícone na bandeja**, perto do
relógio. **Duplo clique no ícone abre o app**; o botão direito traz reiniciar o
servidor, ver o log e sair — e é o "Sair" que encerra tudo. Marcando **Iniciar
com o Windows**, ele já está de pé quando você senta para estudar.

O navegador **nunca abre sozinho**. O ícone sobe junto com o Windows e o
servidor fica pronto em segundo plano; abrir uma janela por cima do que você
estiver fazendo seria o oposto de ficar fora do caminho. Quando quiser estudar,
o clique é seu.

Ou pela linha de comando:

```bash
npm install
npm run db:migrate   # cria as tabelas
npm run db:seed      # carrega os decks de exemplo
npm run dev          # http://localhost:3100
```

### Por que a porta 3100

A 3000 é o padrão do Next e a mais disputada em máquina de desenvolvimento —
aqui ela já pertence a outro projeto. O ícone da bandeja não se contenta em ver
a porta responder: ele confere se **quem respondeu é o NihongoHub**. Sem isso,
outro app atendendo ali faria o ícone anunciar "no ar" e abrir o navegador no
lugar errado.

Essa conferência espera até 30 segundos de propósito. Em desenvolvimento a
primeira resposta aguarda o Turbopack compilar a home — medido em 3s — e um
limite curto acusaria "porta ocupada por outro programa" logo depois de o
servidor subir, que é o pior momento possível para um alarme falso. Quem de
fato for outro programa responde na hora, com o conteúdo errado.

Para mudar a porta, os dois lugares são `package.json` (scripts `dev` e
`start`) e `scripts/tray.ps1`.

## O ícone da bandeja

Um servidor de desenvolvimento precisa ficar vivo enquanto se estuda, mas isso
não obriga ninguém a manter um prompt aberto no meio da tela — e uma janela que
não pode ser fechada é uma janela que uma hora será fechada por engano.

O `NihongoHub.cmd` só cuida do que pode falhar antes de existir ícone para
avisar (Node ausente, dependências faltando) e entrega o resto a
`scripts/tray.ps1`, que sobe o `next dev` como processo oculto e fica na
bandeja. Não há dependência nova: o WinForms já vem com o Windows.

| Item do menu | O que faz |
| --- | --- |
| **Abrir no Edge** | Abre o app — o único caminho até o navegador. Com o servidor parado, sobe ele antes |
| Abrir no VS Code | Abre `NihongoHub.code-workspace` — ou a pasta, se ele não existir |
| Reiniciar o servidor | Derruba e sobe de novo — útil ao mexer em `.env` ou no schema |
| Iniciar com o Windows | Liga e desliga a subida automática no login |
| Ver o log | Abre a saída do servidor no Bloco de Notas |
| Sair | Encerra o servidor e tira o ícone da bandeja |

### O ícone é o painel, o balão é só para problema

O ícone carrega o estado o tempo todo, com um selo no canto:

| Ícone | Estado |
| --- | --- |
| colorido, **selo verde** | no ar — pode estudar |
| cinza, sem selo | subindo; estado passageiro, não vale alarme |
| cinza, **selo vermelho** | o servidor caiu ou não subiu |

**Notificação só aparece quando algo deu errado.** Sucesso não interrompe: quem
conta que está tudo bem é o selo verde, e ele continua lá depois de qualquer
balão ter sumido. Balão de confirmação treina a pessoa a dispensar o aviso sem
ler — e aí o único que importava passa despercebido junto.

O selo tem um anel branco por baixo de propósito: a bandeja pode estar sobre
fundo claro ou escuro, e um ponto colorido sem contorno some num dos dois. Em
16×16, que é como o Windows costuma desenhá-lo, é esse contraste que o mantém
legível.

O item do VS Code procura o `Code.exe` nos caminhos de instalação conhecidos, e
fica **desabilitado** se não achar nenhum — a busca refaz a cada abertura do
menu, então instalar o VS Code depois não exige reiniciar o ícone. Dois
caminhos mais curtos foram descartados: o `code` do PATH é um `.cmd` e abriria
um console a cada clique, e a extensão `.code-workspace` não fica associada a
nada numa instalação limpa, o que transformaria o clique na caixa "como você
quer abrir este arquivo?".

### `-WindowStyle Hidden` não esconde mais nada

No Windows 11 quem hospeda o console é o Windows Terminal, e a janela pertence
a ele: o PowerShell pede para esconder a própria janela e o pedido não tem a
quem chegar. O resultado é um terminal aberto a sessão inteira — exatamente o
que o ícone existe para evitar.

Esconder a janela é a abordagem errada; a certa é **não ter janela**. O
`tray.ps1` relança a si mesmo com `CreateNoWindow` e sai, e o processo novo
nasce sem console: não há janela para esconder nem host para hospedá-la, e
nenhum terminal padrão muda isso. É o mesmo mecanismo que já era usado para
subir o `next dev` sem janela.

Por isso o `NihongoHub.cmd` chama o PowerShell **sem `start`**: assim ele roda
no console que já existe em vez de abrir outro, e como o relançamento devolve
o controle na hora, a janela do `.cmd` fecha sozinha.

A saída vai para `%LOCALAPPDATA%\NihongoHub\servidor.log`, fora da árvore do
projeto — o `.next` é apagado a cada build, e um log versionado só sujaria o
`git status`. Cada partida do servidor recomeça o arquivo.

### Iniciar com o Windows

A opção grava um atalho na pasta Inicializar do usuário — caminho pedido ao
Windows, e não montado à mão, porque ele muda com o idioma da instalação. O
atalho aponta para o `NihongoHub.cmd` com a janela **minimizada**: a
conferência de Node e dependências ainda precisa de um console, mas no login
ele aparece na barra de tarefas em vez de saltar por cima do que estiver na
tela.

A marca do menu não confia na própria memória: ela lê o atalho e compara o
alvo com esta cópia do projeto. Assim um atalho esquecido por uma pasta antiga
não aparece como ligado — mover o projeto apenas desmarca a opção, e religá-la
reescreve o atalho para o lugar certo.

### Matar o servidor é matar uma árvore

Quem escuta na 3100 não é quem foi iniciado. O `next dev` levanta um processo
separado para o servidor HTTP, que por sua vez levanta os workers do Turbopack
— quatro processos no total, em três níveis. Encerrar só o dono da porta
deixaria três vivos, um deles pronto para reabri-la.

Por isso o `Sair` e o `Reiniciar` sobem a árvore a partir da porta até o
processo mais alto que ainda seja andaime (`node`, `cmd` ou `npm`) e matam dali
com `taskkill /T`. A subida para no primeiro processo que não seja um desses —
o `explorer.exe` ou o terminal que iniciou tudo — e também se o "pai" nasceu
depois do filho, o que não é parentesco e sim um PID reciclado pelo Windows.

| Comando | O que faz |
| --- | --- |
| `NihongoHub.cmd` | Põe o NihongoHub na bandeja (duplo clique, Windows) |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm start` | Sobe o build de produção |
| `npm test` | Testes do agendamento SRS |
| `npm run lint` | ESLint (inclui as regras do React Compiler) |
| `npm run db:migrate` | Aplica as migrações pendentes |
| `npm run db:seed` | Carrega os decks de exemplo (idempotente) |
| `npm run db:studio` | Abre o Prisma Studio para navegar nos dados |
| `npm run icons` | Regenera os ícones do PWA em `public/` |
| `npm run imagens` | Baixa as imagens dos cards que ainda não têm |

## Banco de dados

PostgreSQL 17 local, acessado via Prisma 7. A conexão fica em `.env`, que o
`.gitignore` cobre.

```
postgresql://nihongohub:<senha>@127.0.0.1:5432/nihongohub?options=-c%20timezone%3DUTC
```

O usuário `nihongohub` é dono apenas deste banco: **não é superusuário** e não
enxerga os outros bancos do servidor. Ele tem `CREATEDB` porque o Prisma
Migrate cria um banco sombra temporário para calcular o diff das migrações.

### `timezone=UTC` na connection string não é decoração

O driver envia os timestamps em UTC **sem rótulo de fuso**. Com a sessão em
`America/Sao_Paulo`, o Postgres os lia como hora local e gravava todo
agendamento 3 horas adiantado — de forma silenciosa, porque o mesmo desvio era
aplicado na leitura e o app parecia consistente consigo mesmo. Só aparecia ao
consultar os dados por fora, em SQL.

As colunas de data são `TIMESTAMPTZ`, e não `timestamp`, pelo mesmo motivo: um
instante sem fuso é um instante ambíguo.

Para conferir que continua correto depois de mudar driver, fuso ou servidor:

```bash
npx tsx --env-file=.env scripts/diagnostico-fuso.ts
```

Os três números precisam dar ~0. Se não derem, os agendamentos estão sendo
gravados num fuso e lidos em outro.

## Como está montado

```
src/
  lib/
    srs.ts          Algoritmo de agendamento (SM-2). Funções puras, sem I/O.
    srs.test.ts     30 testes cobrindo aprendizado, lapsos, tetos e previews.
    prisma.ts       Cliente Prisma com driver adapter.
    seed-data.ts    O conteúdo dos decks iniciais (só dados).
    server/
      study.ts      Leituras do banco para as telas. Marcado `server-only`.
  components/       Sessão de estudo, cards de deck e formulário de card.
  app/
    actions.ts      Server Action que registra a revisão.
    page.tsx        Home (Server Component).
    study/          Sessão de estudo.
prisma/
  schema.prisma     Modelos e índices.
  migrations/       Histórico versionado do schema.
  seed.ts           Popula os decks iniciais.
scripts/
  tray.ps1             Ícone da bandeja: sobe, reinicia e encerra o servidor.
  buscar-imagens.ts    Baixa do Openverse a imagem de cada card.
  diagnostico-fuso.ts  Verifica a coerência de fuso entre Node e Postgres.
```

### O algoritmo fica fora do banco

`srs.ts` não conhece Prisma, React nem navegador — recebe o estado do card e
devolve o próximo. Foi o que permitiu trocar toda a camada de persistência
(era IndexedDB no navegador) sem alterar uma linha do agendamento: os 30
testes continuaram passando durante a migração inteira.

O agendamento roda no **servidor**, dentro da mesma transação que grava o
histórico. Se uma falhar, as duas voltam atrás e o histórico nunca discorda do
estado do card.

### O agendamento

SM-2 com passos de aprendizado no estilo Anki:

- cards novos passam por **1 min → 10 min** antes de graduar em 1 dia;
- errar um card graduado corta o intervalo pela metade **uma vez** e manda para
  10 min de reaprendizado;
- o fator de facilidade anda entre 1,3 e 3,0;
- vencimentos longos ganham ±5% de espalhamento, para que cards estudados
  juntos não voltem todos no mesmo dia.

Os quatro botões sempre mostram esperas diferentes — dois botões com o mesmo
resultado confundem quem está estudando.

### Fontes

O japonês usa a fonte **do sistema** (Hiragino, Yu Gothic, Noto CJK conforme a
plataforma). Empacotar a Noto Sans JP custava 5,5 MB em 131 fatias baixadas sob
demanda. O latino usa Inter, que tem subset pequeno.

## Modos de estudo

O modo é da sessão, não do conteúdo: qualquer deck pode ser estudado dos dois
jeitos (`/study?deck=<id>&modo=digitacao`).

**Revelar** — mostra o japonês, você revela a resposta e se auto-avalia em
quatro botões.

**Digitar** — a sessão inteira se faz no teclado, sem clicar em nada. A
resposta é conferida **a cada tecla**: assim que o que você escreveu fecha a
palavra (ou deixa de poder fechá-la), o resultado aparece — e fica na tela até
você apertar `enter`, que traz a próxima. O ritmo é seu, e dá tempo de olhar a
resposta certa quando o erro foi por pouco. Acertar vale "Bom", errar ou pedir
a resposta vale "De novo".

A conferência é por **prefixo**, não por tempo de espera: enquanto o kana já
formado puder crescer até a resposta, nada acontece. Digitar `sakuna` para
さくら reprova na hora — さくな não leva a さくら — enquanto `sakur` continua em
aberto. Esperar você parar de digitar puniria quem pensa no meio da palavra.

O campo mostra o kana se formando enquanto você digita, que é onde se aprende
que `sha` é uma sílaba só e não três letras.

**Errando, a palavra certa aparece e é preciso escrevê-la para seguir.** Essa
digitação não gera outra revisão — a nota já foi dada — e existe para fixar a
escrita no momento em que ela falhou, que é quando isso rende. O mesmo vale ao
usar "Não sei". Acertando de primeira, passa direto.

Com a palavra ainda pela metade, `enter` confirma assim mesmo — para quem
prefere decidir que terminou em vez de continuar digitando.

Só Hepburn é aceito (`shi`, `chi`, `tsu`, `fu`) — ver `src/lib/romaji.ts`.

### Treino livre: estudar a qualquer hora

O SRS existe para **não** mostrar o que você já sabe — e é justamente isso que
faz o app dizer "tudo em dia" quando dá vontade de praticar. O treino separa os
dois objetivos: `/study?...&treino=1` repassa palavras já estudadas, quantas
vezes você quiser, e **nada muda no agendamento**. Uma palavra treinada hoje
volta na data que já tinha.

A escolha prioriza o que resiste mais — mais lapsos e menor facilidade
(`src/lib/treino.ts`) — sorteando entre as mais difíceis para o treino não
virar sempre a mesma lista. Só entram palavras já introduzidas: treinar o que
nunca foi visto seria furar o lote pela porta dos fundos.

As revisões de treino **são gravadas**, marcadas com `treino = true`. Não valem
para o algoritmo, mas contam para responder depois "quais palavras eu mais
erro".

### Rotação de lote

Um deck de 159 palavras não despeja 159. Cada deck tem um `loteAtivo` (padrão
10): palavras novas só entram quando outra amadurece (intervalo ≥ 7 dias, em
`src/lib/lote.ts`). O atraso vem sempre antes da novidade — voltar depois de
uma semana parado significa "recupere o que ficou", e não "aqui estão dez
palavras novas por cima".

### Vocabulário em kana

159 palavras reais cobrindo os dois silabários, em `src/lib/palavras-kana.ts`,
com um teste que falha se algum kana ficar sem palavra. As exclusões são
declaradas com motivo em `src/lib/kana.ts`: `を` só existe como partícula
(entra na frase みずをのむ), `ヲ ヂ ヅ` não ocorrem em empréstimos modernos, e
`ゐ ゑ ヰ ヱ` são obsoletos.

## Atalhos de teclado

| Tecla | Ação | Modo |
| --- | --- | --- |
| `espaço` / `enter` | Mostrar a resposta | Revelar |
| `1` `2` `3` `4` | De novo · Difícil · Bom · Fácil | Revelar |
| (nenhuma) | A conferência é automática, a cada tecla | Digitar |
| `enter` | Ir para a próxima palavra | Digitar |
| `enter` | Confirmar antes de completar a palavra | Digitar |

## Cadastro e edição de cards

`/cards` lista os cards de um deck, com busca por japonês ou por significado;
daí se cadastra, edita e exclui. Chega pela home ("Gerenciar cards") ou pelo
link "Cards" de cada deck.

**Editar acontece em modal**, e não em outra página. O motivo está na sessão de
estudo: a fila vive na memória do navegador, então navegar até uma tela de
edição a perderia — você voltaria ao começo depois de consertar uma vírgula. Por
isso o bloco de resposta, no fim de cada card, tem um **"Editar este card"**: o
momento em que se percebe que a leitura está errada é justamente o de ver a
resposta, e consertar ali evita terminar a sessão com uma lista de coisas a
arrumar depois.

Salvar pelo modal atualiza o texto na tela de trás sem recarregar. Na lista é um
`router.refresh()`; na sessão, os campos gravados voltam da Server Action e
substituem os do card em memória — recarregar ali custaria a sessão inteira.

O modal é o `<dialog>` nativo: Esc fecha, o foco fica preso dentro e o resto da
página vira inerte sem nenhum código nosso. Refazer isso à mão é onde nascem os
modais que o leitor de tela atravessa.

O **silabário não é um campo**: sai da frente do card. `ねこ` é hiragana,
`コーヒー` é katakana, e `日` ou `ねこカフェ` não são nenhum dos dois — ficam de
fora dos filtros, que é o correto, porque uma sessão "só hiragana" que mostrasse
katakana estaria quebrando a própria promessa. Deixar escolher à mão só criaria
card marcado errado.

A **leitura precisa ser kana**, e cada alternativa separada por `・` é conferida
sozinha. Não é purismo: o modo digitação converte o que você escreve em kana e
compara com este campo, então romaji gravado aqui faria a resposta certa ser
reprovada na hora de estudar. Sem checar pedaço a pedaço, `にち・nichi` passaria
por ter kana no começo.

Frente repetida no mesmo deck é barrada — quase sempre é cadastro em duplicata,
e dois cards iguais viram duas revisões do mesmo conteúdo na mesma sessão.

Card novo entra como **nunca estudado**: não fura a fila: só aparece quando o
lote do deck abrir uma vaga.

### Excluir apaga o histórico junto

O `onDelete: Cascade` leva as revisões do card. É o comportamento certo —
histórico de card que não existe mais não significa nada — mas é perda de dado
real e não dá para desfazer, então a tela mostra quantas revisões vão embora
antes de você confirmar.

### A validação roda duas vezes, de propósito

As regras vivem em `src/lib/card-form.ts`, em funções puras, e rodam no
formulário e de novo na Server Action. Argumento de Server Action chega pela
rede: validar só no navegador é não validar.

### `"use server"` não exporta constante

Num módulo `"use server"` **todo export precisa ser função async**, porque cada
um vira um endpoint. O estado inicial do formulário chegou a morar lá e voltava
`undefined` no cliente, quebrando a primeira renderização — por isso ele está em
`src/lib/card-form.ts`, junto das regras.

### Editar o termo de imagem sobrevive ao seed

`npm run db:seed` **só preenche termo vazio**. Antes ele sobrescrevia, o que
apagaria em silêncio um termo ajustado na tela — e semear é coisa que se faz sem
pensar, depois de qualquer migração. Para reimpor a curadoria do código:
`npm run db:seed -- --forcar-termos`.

## Imagens nos cards

Cada card pode ter uma imagem, e ela aparece **só no lado da resposta**. Ver a
foto junto do japonês entregaria o significado, e o exercício deixaria de ser
ler o kana para virar reconhecer o desenho.

A fonte é o [Openverse](https://openverse.org), catálogo de licença aberta: não
pede chave de API e devolve autor e licença junto do resultado, que é o que
permite creditar direito — e o crédito aparece sob a imagem porque quase toda
licença Creative Commons exige atribuição.

```bash
npm run imagens          # baixa o que falta; roda quantas vezes precisar
```

### Buscar em japonês funciona — mas só para certas palavras

A ideia era buscar pelo texto em japonês, e ela está certa onde importa:
`ごはん` devolve uma tigela de arroz e `日本 駅` devolve uma estação japonesa,
enquanto "rice" e "train station" devolveriam um saco de grãos e a Grand
Central. Medido, palavras japonesas distintivas acertam 5 em 7.

Palavras de duas moras, não. Kana é escrita fonética, e duas moras colidem com
tudo:

| Busca | O que veio |
| --- | --- |
| `あお` (azul) | fotos da atriz Miyazaki **あおい** |
| `うえ` (em cima) | o parque de **うえ**の, um macaco, um shinkansen |
| `いけ` (lago) | uma ilustradora chamada **いけ** |
| `たたみ` (tatami) | 折り**たたみ**自転車 — bicicleta dobrável |

Trocar de fonte não resolve, porque o problema é a consulta: a Wikipédia
japonesa cai em páginas de desambiguação sem imagem, e o Wikidata acertou 2 de
20. Acrescentar o kanji piora — `上` e `愛` casam com nomes próprios chineses
(黃上晏, 邱愛晨).

Por isso o termo de busca é **dado curado**, em `busca` (veja
`src/lib/palavras-kana.ts`): japonês onde a imagem japonesa é a representação
certa, inglês onde o kana é ambíguo demais. E **ausente é uma decisão**: `ぜんぶ`
(tudo), `どこ` (onde) e `つづく` (continuar) não têm imagem possível, e inventar
uma ensinaria a associação errada — que num SRS é o pior defeito de todos,
porque a repetição a fixa.

### A escolha automática precisa de olho humano

O script pontua os candidatos exigindo **palavra inteira** no título, o que
derruba as colisões por substring: sem isso, "person" trazia um *Sharp X68000
**Person**al Computer*. Mas nenhuma pontuação de texto pega o resto — estes
passaram com o termo no título e ainda assim estavam errados:

| Busca | O que veio |
| --- | --- |
| `ribbon` (fita) | **Ribbon** Falls, uma cachoeira |
| `milk glass` (leite) | **Milk Glass** Salt Shakers — um tipo de vidro |
| `elevator` | Space **Elevator**, arte de ficção científica |
| `fire flame` (fogo) | botas com chamas pintadas |
| `cat` (gato) | **Cat** Fish — um bagre |

A tela **`/imagens`** existe para esse julgamento: mostra as ~150 de uma vez com
o termo que as trouxe. Achou uma errada, ajuste o `busca`, rode `npm run
db:seed` (que propaga a curadoria para o banco sem tocar no seu progresso),
limpe o `image_path` do card e rode `npm run imagens` de novo.

### Enviar a imagem à mão

Para um card específico, a curadoria dá voltas demais: o formulário do card tem
um seletor de arquivo, e a imagem enviada substitui a baixada. Vale no cadastro,
na lista e no modal que abre no meio da sessão de estudo — inclusive quando a
imagem automática veio errada e você já tem a certa na mão.

A imagem **é reduzida no navegador antes de subir**, para no máximo 960px de
maior lado, recomprimida em WebP. São três problemas resolvidos de uma vez:

| Sem reduzir | Com reduzir |
| --- | --- |
| Foto de celular tem 2–8MB | A de teste, 3024×4032 e 2,0MB, virou 720×960 e 178KB |
| Server Action recusa corpo acima de 1MB, com erro cru do framework | Nem chega perto do limite (elevado para 3MB só por folga) |
| O disco guardaria dez vezes o que a tela mostra | Fica na ordem das baixadas do Openverse |

O redimensionamento é no cliente porque o servidor não tem biblioteca de imagem
instalada — e porque assim os megabytes não sobem pela rede para serem jogados
fora do outro lado.

**O formato é conferido pelos bytes, não pela extensão.** O arquivo vai para
`public/`, servido na mesma origem do app: um `.html` renomeado para `.jpg`
seria script nosso aos olhos do navegador. JPEG, PNG e WebP passam; GIF é
recusado com recado próprio, porque o redimensionamento congelaria a animação e
entregar um GIF parado sem avisar seria pior que recusar.

O nome do arquivo leva um sufixo que muda a cada envio
(`<id>-<carimbo>.webp`). Sem isso, trocar a imagem mantendo `<id>.jpg` deixaria
o navegador e o otimizador do `next/image` servindo a antiga — e a conclusão
natural seria que o envio não funcionou.

Remover a imagem é marcação, não ação imediata: o aviso diz *"a imagem sai ao
salvar"* e você ainda pode clicar em *manter*. Assim tudo o que o formulário
muda acontece no mesmo "Salvar", e fechar sem salvar desfaz tudo. O arquivo no
disco é apagado quando a imagem é trocada, removida ou o card é excluído —
ninguém varre a pasta, então o que ficasse ficaria para sempre.

## Notas

**O app precisa do servidor.** Uma versão anterior guardava tudo em IndexedDB
e funcionava offline; hoje o Postgres é a fonte de verdade e cada resposta vai
ao servidor. O service worker daquela versão é removido automaticamente do
navegador de quem usou o app antes — veja
`src/components/service-worker-cleanup.tsx`.

**`npm audit` acusa `mysql2` e `deepmerge-ts`.** Ambos entram pelo CLI do
Prisma. As falhas do `mysql2` exigem conectar a um servidor MySQL malicioso, e
o nosso datasource é PostgreSQL — esse código nunca é carregado. O
`deepmerge-ts` é alimentado pela nossa própria config. O `audit fix --force`
faria downgrade para o Prisma 6, com breaking changes; por isso ficamos na
7.10.0.

**A tag `latest` do pacote `prisma` aponta para um release candidate** da
versão 8. As versões estão fixadas em `^7.10.0` de propósito, CLI e client
alinhados.

## Próximos passos

- Criar e editar **decks** pela interface (os cards já dá)
- Contas de usuário — hoje o banco não separa por pessoa
- Limite de cards novos por dia: o campo `newPerDay` existe, mas ainda não é
  aplicado na montagem da fila
- Tela de estatísticas a partir da tabela `reviews`
- Resposta otimista na sessão de estudo, para o próximo card aparecer sem
  esperar o round-trip
