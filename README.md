# NihongoHub

Flashcards de kanji e vocabulário japonês com repetição espaçada, em Next.js 16
com PostgreSQL.

## Começando

No Windows, **dê um duplo clique em `abrir.cmd`**. Ele instala as dependências
na primeira vez, sobe o servidor e abre o Microsoft Edge sozinho quando
estiver pronto. Para parar, feche a janela.

Ou pela linha de comando:

```bash
npm install
npm run db:migrate   # cria as tabelas
npm run db:seed      # carrega os decks de exemplo
npm run dev          # http://localhost:3000
```

| Comando | O que faz |
| --- | --- |
| `abrir.cmd` | Sobe o servidor e abre o Edge (duplo clique, Windows) |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm start` | Sobe o build de produção |
| `npm test` | Testes do agendamento SRS |
| `npm run lint` | ESLint (inclui as regras do React Compiler) |
| `npm run db:migrate` | Aplica as migrações pendentes |
| `npm run db:seed` | Carrega os decks de exemplo (idempotente) |
| `npm run db:studio` | Abre o Prisma Studio para navegar nos dados |
| `npm run icons` | Regenera os ícones do PWA em `public/` |

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
  components/       Sessão de estudo e cards de deck.
  app/
    actions.ts      Server Action que registra a revisão.
    page.tsx        Home (Server Component).
    study/          Sessão de estudo.
prisma/
  schema.prisma     Modelos e índices.
  migrations/       Histórico versionado do schema.
  seed.ts           Popula os decks iniciais.
scripts/
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

**Digitar** — mostra a palavra e você escreve o romaji. A nota é objetiva:
acertar de primeira vale "Bom", errar ou pedir a resposta vale "De novo", sem
botões. Errando, é preciso digitar a palavra certa para seguir — esse passo
não gera outra revisão, ele existe para fixar a escrita.

O campo mostra o kana se formando enquanto você digita, que é onde se aprende
que `sha` é uma sílaba só e não três letras.

Só Hepburn é aceito (`shi`, `chi`, `tsu`, `fu`) — ver `src/lib/romaji.ts`.

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
| `enter` | Conferir a resposta / avançar | Digitar |

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

- Criar e editar decks e cards pela interface (hoje só via seed)
- Contas de usuário — hoje o banco não separa por pessoa
- Limite de cards novos por dia: o campo `newPerDay` existe, mas ainda não é
  aplicado na montagem da fila
- Tela de estatísticas a partir da tabela `reviews`
- Resposta otimista na sessão de estudo, para o próximo card aparecer sem
  esperar o round-trip
