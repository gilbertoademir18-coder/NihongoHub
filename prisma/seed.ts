import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { PALAVRAS_KANA } from "../src/lib/palavras-kana";
import { SEED_DECKS } from "../src/lib/seed-data";
import { newCardState } from "../src/lib/srs";

/**
 * Popula o banco com os decks iniciais.
 *
 * Idempotente **por deck**, e não pelo banco inteiro: decks já existentes são
 * deixados como estão (com todo o progresso de quem estudou), e apenas os que
 * faltam são criados. É o que permite acrescentar conteúdo novo mais tarde sem
 * precisar zerar nada.
 */

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL não está definida");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

interface CardParaSemear {
  front: string;
  reading: string;
  meaning: string;
  example?: string;
  exampleMeaning?: string;
  tags?: string[];
  script?: "hiragana" | "katakana";
}

interface DeckParaSemear {
  name: string;
  description: string;
  loteAtivo: number;
  cards: CardParaSemear[];
}

/** Os decks de kanji e saudações, como já eram. */
const DECKS_EXISTENTES: DeckParaSemear[] = SEED_DECKS.map((deck) => ({
  name: deck.name,
  description: deck.description,
  loteAtivo: deck.newPerDay,
  cards: deck.cards,
}));

/**
 * O vocabulário em kana.
 *
 * A palavra é ao mesmo tempo a frente e a leitura: ela já está escrita no
 * silabário, que é justamente o que se treina aqui.
 */
const DECK_KANA: DeckParaSemear = {
  name: "Palavras em Kana",
  description:
    "Palavras reais cobrindo todo o hiragana e o katakana. Dá para estudar um silabário de cada vez.",
  loteAtivo: 10,
  cards: PALAVRAS_KANA.map((palavra) => ({
    front: palavra.palavra,
    reading: palavra.palavra,
    meaning: palavra.meaning,
    tags: palavra.expressao ? ["expressão"] : [],
    script: palavra.script,
  })),
};

const TODOS_OS_DECKS: DeckParaSemear[] = [...DECKS_EXISTENTES, DECK_KANA];

async function main() {
  const jaExistentes = new Set(
    (await prisma.deck.findMany({ select: { name: true } })).map((d) => d.name),
  );

  const agora = new Date();
  let criados = 0;

  for (const [indice, seed] of TODOS_OS_DECKS.entries()) {
    if (jaExistentes.has(seed.name)) {
      console.log(`· ${seed.name}: já existe, preservado`);
      continue;
    }

    const estadoInicial = newCardState(agora.getTime());

    const deck = await prisma.deck.create({
      data: {
        name: seed.name,
        description: seed.description,
        loteAtivo: seed.loteAtivo,
        // O deslocamento por índice mantém a ordem da lista estável: com o
        // mesmo instante para todos, o desempate ficaria a cargo do banco e
        // os decks trocariam de lugar entre carregamentos.
        createdAt: new Date(agora.getTime() + indice),
        cards: {
          create: seed.cards.map((card, posicao) => ({
            front: card.front,
            reading: card.reading,
            meaning: card.meaning,
            example: card.example,
            exampleMeaning: card.exampleMeaning,
            tags: card.tags ?? [],
            script: card.script,
            // Mesmo truque, agora por card: é o `createdAt` que define a ordem
            // de introdução das palavras, e ela é pedagógica — as primeiras
            // usam os kana mais simples.
            createdAt: new Date(agora.getTime() + posicao),
            ease: estadoInicial.ease,
            intervalDays: estadoInicial.intervalDays,
            repetitions: estadoInicial.repetitions,
            learningStep: estadoInicial.learningStep,
            dueAt: new Date(estadoInicial.dueAt),
            lapses: estadoInicial.lapses,
          })),
        },
      },
      include: { _count: { select: { cards: true } } },
    });

    console.log(`✓ ${deck.name}: ${deck._count.cards} cards`);
    criados += 1;
  }

  if (criados === 0) console.log("nada novo a semear");
}

main()
  .catch((erro) => {
    console.error("falha ao popular o banco:", erro);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
