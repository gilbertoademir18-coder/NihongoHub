import "server-only";

import { prisma } from "../prisma";
import type { SrsState } from "../srs";

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
      : K extends "example" | "exampleMeaning"
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
  /** Cards vencidos, prontos para revisar. */
  due: number;
  /** Cards nunca estudados. */
  fresh: number;
  /** Cards que já foram estudados mas ainda não graduaram. */
  learning: number;
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
      { deck_id: string; total: bigint; due: bigint; fresh: bigint; learning: bigint }[]
    >`
      SELECT
        deck_id,
        count(*)                                                       AS total,
        count(*) FILTER (WHERE due_at <= ${agora})                     AS due,
        count(*) FILTER (WHERE repetitions = 0)                        AS fresh,
        count(*) FILTER (WHERE learning_step IS NOT NULL
                           AND repetitions > 0)                        AS learning
      FROM cards
      GROUP BY deck_id
    `,
  ]);

  const porDeck = new Map(linhas.map((l) => [l.deck_id, l]));

  return decks.map((deck) => {
    const stats = porDeck.get(deck.id);
    return {
      id: deck.id,
      name: deck.name,
      description: deck.description,
      // count() do Postgres volta como bigint, que não sobrevive à
      // serialização para o cliente — daí a conversão explícita.
      total: Number(stats?.total ?? 0),
      due: Number(stats?.due ?? 0),
      fresh: Number(stats?.fresh ?? 0),
      learning: Number(stats?.learning ?? 0),
    };
  });
}

/** Quantos cards estão vencidos no total, em todos os decks. */
export async function contarVencidos(agora: Date = new Date()): Promise<number> {
  return prisma.card.count({ where: { dueAt: { lte: agora } } });
}

/** Busca um deck pelo id. Devolve `null` se não existir. */
export async function buscarDeck(deckId: string) {
  return prisma.deck.findUnique({ where: { id: deckId } });
}

/**
 * A fila de revisão: cards vencidos, os mais atrasados primeiro.
 *
 * Quem passou mais tempo do ponto é quem está mais perto de ser esquecido.
 */
export async function buscarFila(
  deckId: string | null,
  agora: Date = new Date(),
  limite = 100,
): Promise<CardEstudo[]> {
  const linhas = await prisma.card.findMany({
    where: {
      dueAt: { lte: agora },
      ...(deckId ? { deckId } : {}),
    },
    orderBy: { dueAt: "asc" },
    take: limite,
    select: SELECAO_CARD,
  });

  return linhas.map(paraCardEstudo);
}
