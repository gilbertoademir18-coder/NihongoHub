import "server-only";

import { prisma } from "../prisma";

/**
 * Leituras do banco para as telas de cadastro e edição de cards.
 *
 * Separado de `study.ts` porque as perguntas são outras: ali é "o que estudar
 * agora", aqui é "o que existe no deck". Misturar faria a consulta da fila
 * carregar campos que a sessão não usa.
 */

export interface CardDaLista {
  id: string;
  front: string;
  reading: string;
  meaning: string;
  tags: string[];
  imagePath: string | null;
  /** Nunca estudado: dá para editar à vontade sem mexer em progresso nenhum. */
  novo: boolean;
}

export interface DeckSimples {
  id: string;
  name: string;
  total: number;
}

/** Os decks, só com o que o seletor do formulário precisa. */
export async function listarDecksSimples(): Promise<DeckSimples[]> {
  const decks = await prisma.deck.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, _count: { select: { cards: true } } },
  });
  return decks.map((d) => ({ id: d.id, name: d.name, total: d._count.cards }));
}

/**
 * Os cards de um deck, opcionalmente filtrados por texto.
 *
 * O filtro cobre frente, leitura e significado porque é assim que se procura
 * um card na prática: às vezes você lembra do japonês, às vezes só do que a
 * palavra quer dizer.
 */
export async function listarCards(
  deckId: string | null,
  busca = "",
): Promise<CardDaLista[]> {
  const termo = busca.trim();
  const cards = await prisma.card.findMany({
    where: {
      ...(deckId ? { deckId } : {}),
      ...(termo
        ? {
            OR: [
              { front: { contains: termo, mode: "insensitive" } },
              { reading: { contains: termo, mode: "insensitive" } },
              { meaning: { contains: termo, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      front: true,
      reading: true,
      meaning: true,
      tags: true,
      imagePath: true,
      introducedAt: true,
    },
  });

  return cards.map((c) => ({
    id: c.id,
    front: c.front,
    reading: c.reading,
    meaning: c.meaning,
    tags: c.tags,
    imagePath: c.imagePath,
    novo: c.introducedAt === null,
  }));
}

export interface CardParaEditar {
  id: string;
  deckId: string;
  front: string;
  reading: string;
  meaning: string;
  example: string;
  exampleMeaning: string;
  tags: string[];
  imageQuery: string;
  imagePath: string | null;
  imageCredit: string | null;
  /** Quantas revisões o card já tem — o que se perde ao excluí-lo. */
  revisoes: number;
}

/** Um card pronto para o formulário, ou `null` se o id não existe. */
export async function buscarCardParaEditar(id: string): Promise<CardParaEditar | null> {
  const card = await prisma.card.findUnique({
    where: { id },
    select: {
      id: true,
      deckId: true,
      front: true,
      reading: true,
      meaning: true,
      example: true,
      exampleMeaning: true,
      tags: true,
      imageQuery: true,
      imagePath: true,
      imageCredit: true,
      _count: { select: { reviews: true } },
    },
  });
  if (!card) return null;

  // O formulário trabalha com strings: `null` num <input> controlado dispara
  // o aviso de "componente não controlado" e ainda zera o campo.
  return {
    id: card.id,
    deckId: card.deckId,
    front: card.front,
    reading: card.reading,
    meaning: card.meaning,
    example: card.example ?? "",
    exampleMeaning: card.exampleMeaning ?? "",
    tags: card.tags,
    imageQuery: card.imageQuery ?? "",
    imagePath: card.imagePath,
    imageCredit: card.imageCredit,
    revisoes: card._count.reviews,
  };
}
