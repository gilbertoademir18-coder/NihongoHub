import "server-only";

import {
  HORIZONTE_SESSAO_MS,
  LIMIAR_MADURO_DIAS,
  LOTE_PADRAO,
  ordenarFila,
  vagasParaNovos,
} from "../lote";
import { prisma } from "../prisma";
import type { SrsState } from "../srs";
import { TAMANHO_DO_BLOCO, montarBloco } from "../treino";

/** Filtro de silabário da sessão. `ambos` não restringe nada. */
export type FiltroScript = "hiragana" | "katakana" | "ambos";

/**
 * Leituras do banco para as telas de estudo.
 *
 * O `server-only` no topo faz o build falhar se algum componente de cliente
 * importar este módulo por engano — o que arrastaria a credencial do banco
 * para dentro do bundle do navegador.
 */

/** Um card pronto para a UI, com o estado do SRS no formato que `srs.ts` usa. */
export interface CardEstudo {
  id: string;
  deckId: string;
  front: string;
  reading: string;
  meaning: string;
  example: string | null;
  exampleMeaning: string | null;
  /** Caminho da imagem em `public/`, ou `null` para card sem imagem. */
  imagePath: string | null;
  /** Autor e licença, que as licenças CC exigem exibir. */
  imageCredit: string | null;
  srs: SrsState;
}

/** Colunas do banco necessárias para montar um `CardEstudo`. */
const SELECAO_CARD = {
  id: true,
  deckId: true,
  front: true,
  reading: true,
  meaning: true,
  example: true,
  exampleMeaning: true,
  imagePath: true,
  imageCredit: true,
  ease: true,
  intervalDays: true,
  repetitions: true,
  learningStep: true,
  dueAt: true,
  lapses: true,
} as const;

type LinhaCard = {
  [K in keyof typeof SELECAO_CARD]: K extends "dueAt"
    ? Date
    : K extends "learningStep"
      ? number | null
      : K extends "example" | "exampleMeaning" | "imagePath" | "imageCredit"
        ? string | null
        : K extends "id" | "deckId" | "front" | "reading" | "meaning"
          ? string
          : number;
};

/**
 * Converte a linha do banco no formato da UI.
 *
 * O SRS trabalha com milissegundos desde a época; o Postgres guarda
 * `timestamp`. A conversão acontece só aqui, nesta fronteira.
 */
export function paraCardEstudo(linha: LinhaCard): CardEstudo {
  return {
    id: linha.id,
    deckId: linha.deckId,
    front: linha.front,
    reading: linha.reading,
    meaning: linha.meaning,
    example: linha.example,
    exampleMeaning: linha.exampleMeaning,
    imagePath: linha.imagePath,
    imageCredit: linha.imageCredit,
    srs: {
      ease: linha.ease,
      intervalDays: linha.intervalDays,
      repetitions: linha.repetitions,
      learningStep: linha.learningStep,
      dueAt: linha.dueAt.getTime(),
      lapses: linha.lapses,
    },
  };
}

export interface DeckComStats {
  id: string;
  name: string;
  description: string;
  total: number;
  /**
   * Quantos cards a próxima sessão traria de verdade.
   *
   * Não é "tudo que venceu": palavras novas entram limitadas pelo lote. Um
   * deck de 159 palavras que anunciasse 159 prometeria o que a sessão não
   * entrega.
   */
  paraEstudar: number;
  /** Cards nunca estudados. */
  fresh: number;
  /** Cards que já foram estudados mas ainda não amadureceram. */
  learning: number;
  /** O deck tem palavras em kana, e portanto permite filtrar por silabário. */
  temHiragana: boolean;
  temKatakana: boolean;
}

/**
 * Lista os decks com o resumo de cada um.
 *
 * As contagens saem numa única varredura agregada no banco, em vez de uma
 * consulta por deck — com poucos decks a diferença é invisível, mas o padrão
 * evita o N+1 quando a lista crescer.
 */
export async function listarDecksComStats(
  agora: Date = new Date(),
): Promise<DeckComStats[]> {
  const [decks, linhas] = await Promise.all([
    prisma.deck.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.$queryRaw<
      {
        deck_id: string;
        total: bigint;
        due: bigint;
        fresh: bigint;
        learning: bigint;
        hiragana: bigint;
        katakana: bigint;
      }[]
    >`
      SELECT
        deck_id,
        count(*)                                                       AS total,
        -- Só o que já foi estudado conta como "vencido": palavra nunca vista
        -- não está atrasada, está esperando vaga.
        count(*) FILTER (WHERE introduced_at IS NOT NULL
                           AND due_at <= ${agora})                     AS due,
        -- "Nova" é a palavra nunca estudada. Contar por repetitions = 0
        -- incluía quem tinha acabado de errar, porque errar zera o contador.
        count(*) FILTER (WHERE introduced_at IS NULL)                  AS fresh,
        count(*) FILTER (WHERE introduced_at IS NOT NULL
                           AND interval_days < ${LIMIAR_MADURO_DIAS})  AS learning,
        count(*) FILTER (WHERE script = 'hiragana')                    AS hiragana,
        count(*) FILTER (WHERE script = 'katakana')                    AS katakana
      FROM cards
      GROUP BY deck_id
    `,
  ]);

  const porDeck = new Map(linhas.map((l) => [l.deck_id, l]));

  return decks.map((deck) => {
    const stats = porDeck.get(deck.id);
    // count() do Postgres volta como bigint, que não sobrevive à serialização
    // para o cliente — daí a conversão explícita.
    const vencidos = Number(stats?.due ?? 0);
    const novos = Number(stats?.fresh ?? 0);
    const ocupantes = Number(stats?.learning ?? 0);

    return {
      id: deck.id,
      name: deck.name,
      description: deck.description,
      total: Number(stats?.total ?? 0),
      paraEstudar:
        vencidos + Math.min(novos, vagasParaNovos(ocupantes, deck.loteAtivo)),
      fresh: novos,
      learning: ocupantes,
      temHiragana: Number(stats?.hiragana ?? 0) > 0,
      temKatakana: Number(stats?.katakana ?? 0) > 0,
    };
  });
}

/**
 * Quantos cards a próxima sessão traria, somando todos os decks.
 *
 * Reaproveita as estatísticas por deck em vez de recontar: é a mesma regra de
 * lote, e duas contas diferentes acabariam divergindo.
 */
export async function contarParaEstudar(agora: Date = new Date()): Promise<number> {
  const decks = await listarDecksComStats(agora);
  return decks.reduce((soma, deck) => soma + deck.paraEstudar, 0);
}

/** Busca um deck pelo id. Devolve `null` se não existir. */
export async function buscarDeck(deckId: string) {
  return prisma.deck.findUnique({ where: { id: deckId } });
}

/**
 * Monta um bloco de treino livre.
 *
 * Só entram palavras já introduzidas — treinar o que nunca foi visto seria
 * introduzir conteúdo pela porta dos fundos, furando o lote. A escolha
 * prioriza o que resiste mais (mais lapsos, menor facilidade), sorteando entre
 * as mais difíceis para o treino não virar sempre a mesma lista.
 *
 * Nada aqui altera agendamento: quem grava as revisões de treino é a Server
 * Action, e ela não reagenda.
 */
export async function buscarTreino(
  deckId: string | null,
  opcoes: { script?: FiltroScript; tamanho?: number } = {},
): Promise<CardEstudo[]> {
  const { script = "ambos", tamanho = TAMANHO_DO_BLOCO } = opcoes;

  const candidatos = await prisma.card.findMany({
    where: {
      ...(deckId ? { deckId } : {}),
      ...(script === "ambos" ? {} : { script }),
      introducedAt: { not: null },
    },
    // Ordenar já no banco evita trazer o deck inteiro só para escolher 20.
    orderBy: [{ lapses: "desc" }, { ease: "asc" }],
    take: tamanho * 5,
    select: SELECAO_CARD,
  });

  return montarBloco(
    candidatos.map(paraCardEstudo).map((card) => ({
      ...card,
      lapses: card.srs.lapses,
      ease: card.srs.ease,
    })),
    tamanho,
  );
}

/** Quantas palavras já foram introduzidas e portanto podem ser treinadas. */
export async function contarTreinaveis(
  deckId: string | null,
  script: FiltroScript = "ambos",
): Promise<number> {
  return prisma.card.count({
    where: {
      ...(deckId ? { deckId } : {}),
      ...(script === "ambos" ? {} : { script }),
      introducedAt: { not: null },
    },
  });
}

export interface OpcoesDaFila {
  /** Restringe a sessão a um silabário. */
  script?: FiltroScript;
  agora?: Date;
  /** Tamanho do lote; por padrão vem do deck. */
  tamanhoDoLote?: number;
}

/**
 * Monta a fila da sessão.
 *
 * São três grupos, nesta ordem de prioridade: o que está em aprendizado, o que
 * venceu, e por fim palavras novas — estas últimas só até preencher o lote.
 * É isso que impede o deck de despejar 159 palavras de uma vez e o que faz
 * voltar depois de uma semana parado significar "recupere o atraso", e não
 * "aqui estão dez novidades por cima dele".
 */
export async function buscarFila(
  deckId: string | null,
  opcoes: OpcoesDaFila = {},
): Promise<CardEstudo[]> {
  const { script = "ambos", agora = new Date() } = opcoes;

  const doDeck = deckId ? { deckId } : {};
  const doScript = script === "ambos" ? {} : { script };
  const base = { ...doDeck, ...doScript };

  const tamanhoDoLote =
    opcoes.tamanhoDoLote ??
    (deckId
      ? ((await prisma.deck.findUnique({ where: { id: deckId } }))?.loteAtivo ??
        LOTE_PADRAO)
      : LOTE_PADRAO);

  const [emAprendizado, vencidos, ocupantes] = await Promise.all([
    // Em aprendizado: inclui o que vence daqui a pouco. Filtrar só por
    // `dueAt <= agora` esvaziaria a tela de quem recarrega a página no meio
    // de um passo de 1 minuto.
    prisma.card.findMany({
      where: {
        ...base,
        introducedAt: { not: null },
        learningStep: { not: null },
        dueAt: { lte: new Date(agora.getTime() + HORIZONTE_SESSAO_MS) },
      },
      orderBy: { dueAt: "asc" },
      select: SELECAO_CARD,
    }),

    // Revisões vencidas de cards já graduados.
    prisma.card.findMany({
      where: {
        ...base,
        introducedAt: { not: null },
        learningStep: null,
        dueAt: { lte: agora },
      },
      orderBy: { dueAt: "asc" },
      take: 100,
      select: SELECAO_CARD,
    }),

    // Quem ocupa vaga no lote: já foi introduzido e ainda não amadureceu.
    prisma.card.count({
      where: {
        ...base,
        introducedAt: { not: null },
        intervalDays: { lt: LIMIAR_MADURO_DIAS },
      },
    }),
  ]);

  const vagas = vagasParaNovos(ocupantes, tamanhoDoLote);

  const novos = vagas
    ? await prisma.card.findMany({
        where: { ...base, introducedAt: null },
        // `createdAt` guarda a ordem pedagógica com que as palavras foram
        // semeadas: as primeiras usam os kana mais simples.
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: vagas,
        select: SELECAO_CARD,
      })
    : [];

  return ordenarFila(
    emAprendizado.map(paraCardEstudo),
    vencidos.map(paraCardEstudo),
    novos.map(paraCardEstudo),
  );
}

export interface CardComImagem {
  id: string;
  front: string;
  meaning: string;
  deckName: string;
  imageQuery: string | null;
  imagePath: string | null;
  imageCredit: string | null;
  imageSource: string | null;
}

/**
 * Todos os cards, para a tela de revisão das imagens.
 *
 * A escolha automática acerta a maioria e erra o resto de formas que só o olho
 * pega: procurando "ribbon" veio uma cachoeira chamada Ribbon Falls, e
 * procurando "milk glass" veio um saleiro — os dois com o termo no título.
 * Nenhuma heurística resolve isso; ver as 150 de uma vez, sim.
 */
export async function listarImagens(): Promise<CardComImagem[]> {
  const cards = await prisma.card.findMany({
    select: {
      id: true,
      front: true,
      meaning: true,
      imageQuery: true,
      imagePath: true,
      imageCredit: true,
      imageSource: true,
      deck: { select: { name: true } },
    },
    orderBy: [{ deck: { createdAt: "asc" } }, { createdAt: "asc" }],
  });

  return cards.map((c) => ({
    id: c.id,
    front: c.front,
    meaning: c.meaning,
    deckName: c.deck.name,
    imageQuery: c.imageQuery,
    imagePath: c.imagePath,
    imageCredit: c.imageCredit,
    imageSource: c.imageSource,
  }));
}
