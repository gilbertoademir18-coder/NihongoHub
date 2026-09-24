import Dexie, { type Table } from "dexie";
import { type Rating, type SrsState, newCardState, schedule } from "./srs";

/**
 * O banco local é a fonte de verdade do NihongoHub.
 *
 * Tudo que uma sessão de estudo precisa — cards, agendamento, histórico —
 * mora no IndexedDB do navegador. É o que permite revisar no metrô sem sinal:
 * nenhuma resposta depende de ida e volta ao servidor. Um sync opcional pode
 * ser adicionado depois por cima disso, sem mexer na experiência de estudo.
 */

export interface Deck {
  id: string;
  name: string;
  description: string;
  /** Quantos cards novos podem ser introduzidos por dia. */
  newPerDay: number;
  createdAt: number;
}

export interface Card {
  id: string;
  deckId: string;
  /** O que aparece na frente: um kanji, uma palavra ou uma expressão. */
  front: string;
  /** Leitura em kana (hiragana/katakana). */
  reading: string;
  /** Significado em português. */
  meaning: string;
  /** Frase de exemplo, opcional — contexto ajuda mais que tradução solta. */
  example?: string;
  /** Tradução da frase de exemplo. */
  exampleMeaning?: string;
  tags: string[];
  srs: SrsState;
  createdAt: number;
}

export interface ReviewLog {
  /** Autoincremento do Dexie. */
  id?: number;
  cardId: string;
  deckId: string;
  rating: Rating;
  reviewedAt: number;
  /** Intervalo em dias antes e depois — permite reconstruir a curva depois. */
  intervalBefore: number;
  intervalAfter: number;
  /** Quanto tempo o card ficou na tela, em ms. */
  durationMs: number;
}

class NihongoHubDB extends Dexie {
  decks!: Table<Deck, string>;
  cards!: Table<Card, string>;
  reviews!: Table<ReviewLog, number>;

  constructor() {
    super("nihongohub");
    this.version(1).stores({
      decks: "id, name, createdAt",
      // O índice composto [deckId+srs.dueAt] é o que faz a busca da fila
      // de revisão ser uma varredura de range, e não um filtro na memória.
      cards: "id, deckId, srs.dueAt, [deckId+srs.dueAt], *tags, createdAt",
      reviews: "++id, cardId, deckId, reviewedAt",
    });
  }
}

export const db = new NihongoHubDB();

/** Cards vencidos de um deck (ou de todos), prontos para revisar. */
export async function getDueCards(
  deckId: string | null,
  now: number = Date.now(),
  limit = 100,
): Promise<Card[]> {
  const query = deckId
    ? db.cards.where("[deckId+srs.dueAt]").between([deckId, 0], [deckId, now], true, true)
    : db.cards.where("srs.dueAt").belowOrEqual(now);

  const due = await query.limit(limit).toArray();
  // Os mais atrasados primeiro: quem já passou do ponto esquece mais rápido.
  return due.sort((a, b) => a.srs.dueAt - b.srs.dueAt);
}

export interface DeckStats {
  total: number;
  due: number;
  /** Cards que ainda não graduaram. */
  learning: number;
  /** Cards nunca estudados. */
  fresh: number;
}

export async function getDeckStats(
  deckId: string,
  now: number = Date.now(),
): Promise<DeckStats> {
  const cards = await db.cards.where("deckId").equals(deckId).toArray();
  return {
    total: cards.length,
    due: cards.filter((c) => c.srs.dueAt <= now).length,
    learning: cards.filter((c) => c.srs.learningStep !== null && c.srs.repetitions > 0)
      .length,
    fresh: cards.filter((c) => c.srs.repetitions === 0).length,
  };
}

/**
 * Registra uma revisão: avança o agendamento do card e grava o histórico,
 * numa transação só para os dois nunca saírem de sincronia.
 */
export async function reviewCard(
  cardId: string,
  rating: Rating,
  durationMs: number,
  now: number = Date.now(),
): Promise<Card> {
  return db.transaction("rw", db.cards, db.reviews, async () => {
    const card = await db.cards.get(cardId);
    if (!card) throw new Error(`Card não encontrado: ${cardId}`);

    const next = schedule(card.srs, rating, { now });

    await db.cards.update(cardId, { srs: next });
    await db.reviews.add({
      cardId,
      deckId: card.deckId,
      rating,
      reviewedAt: now,
      intervalBefore: card.srs.intervalDays,
      intervalAfter: next.intervalDays,
      durationMs,
    });

    return { ...card, srs: next };
  });
}

export interface NewCardInput {
  deckId: string;
  front: string;
  reading: string;
  meaning: string;
  example?: string;
  exampleMeaning?: string;
  tags?: string[];
}

export async function addCard(
  input: NewCardInput,
  now: number = Date.now(),
): Promise<Card> {
  const card: Card = {
    id: crypto.randomUUID(),
    ...input,
    tags: input.tags ?? [],
    srs: newCardState(now),
    createdAt: now,
  };
  await db.cards.add(card);
  return card;
}

export async function createDeck(
  name: string,
  description = "",
  newPerDay = 10,
  now: number = Date.now(),
): Promise<Deck> {
  const deck: Deck = {
    id: crypto.randomUUID(),
    name,
    description,
    newPerDay,
    createdAt: now,
  };
  await db.decks.add(deck);
  return deck;
}

/** Revisões por dia nos últimos `days` dias — alimenta o gráfico de ofensiva. */
export async function getReviewHistory(
  days = 30,
  now: number = Date.now(),
): Promise<{ date: string; count: number }[]> {
  const since = now - days * 86_400_000;
  const logs = await db.reviews.where("reviewedAt").above(since).toArray();

  const byDay = new Map<string, number>();
  for (const log of logs) {
    const key = new Date(log.reviewedAt).toISOString().slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }

  return Array.from({ length: days }, (_, i) => {
    const date = new Date(now - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10);
    return { date, count: byDay.get(date) ?? 0 };
  });
}
