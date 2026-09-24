# NihongoHub

Flashcards de kanji e vocabulário japonês com repetição espaçada. PWA que
funciona offline — feito para estudar no ônibus, sem sinal.

## Começando

```bash
npm install
npm run dev      # http://localhost:3000
```

Na primeira abertura o app popula dois decks de exemplo (kanji N5 e saudações)
direto no navegador. Não há cadastro nem servidor de dados.

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm start` | Sobe o build de produção |
| `npm test` | Testes do agendamento SRS |
| `npm run lint` | ESLint (inclui as regras do React Compiler) |
| `npm run icons` | Regenera os ícones do PWA em `public/` |

## Como está montado

```
src/
  lib/
    srs.ts        Algoritmo de agendamento (SM-2). Funções puras, sem I/O.
    srs.test.ts   30 testes cobrindo aprendizado, lapsos, tetos e previews.
    db.ts         IndexedDB via Dexie: decks, cards e histórico de revisões.
    seed.ts       Conteúdo inicial — sem ele o primeiro acesso é uma tela vazia.
    bootstrap.ts  Garante que o seed rode uma vez só.
  components/     Sessão de estudo, cards de deck, suporte a offline.
  app/            Rotas (App Router) + manifest do PWA.
public/sw.js      Service worker: põe a casca do app em cache.
```

### Local-first, e por quê

O IndexedDB é a **fonte de verdade**. Um SRS precisa responder no instante em
que você toca o botão, e a fila do dia não pode depender de ida e volta ao
servidor — senão o app morre justamente onde ele mais serve: no metrô.

Isso significa, hoje:

- todo o estudo funciona sem rede, inclusive recarregando a página;
- os dados vivem **naquele navegador** — não há sincronização entre aparelhos;
- limpar os dados do site apaga o progresso.

Um sync opcional pode ser encaixado por cima depois (o histórico em `reviews`
já guarda o que seria preciso para reconciliar), sem mexer na experiência de
estudo.

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
demanda — inviável num app que precisa funcionar offline. O latino usa Inter,
que tem subset pequeno.

## Atalhos de teclado

| Tecla | Ação |
| --- | --- |
| `espaço` / `enter` | Mostrar a resposta |
| `1` `2` `3` `4` | De novo · Difícil · Bom · Fácil |

## Testando o PWA

O service worker só é registrado em produção — em desenvolvimento ele serviria
build antigo e esconderia suas mudanças.

```bash
npm run build && npm start
```

Depois, no DevTools: **Application → Service Workers** para ver o registro, e
**Network → Offline** para conferir que o app abre e revisa sem rede.

## Próximos passos

- Criar e editar decks e cards pela interface (hoje só via seed)
- Importar/exportar decks (`.apkg` do Anki ou CSV)
- Limite de cards novos por dia — o campo `newPerDay` já existe, mas ainda não
  é aplicado na montagem da fila
- Tela de estatísticas (`getReviewHistory` já devolve os dados)
- Sincronização entre aparelhos
