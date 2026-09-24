import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { SEED_DECKS } from "../src/lib/seed-data";
import { newCardState } from "../src/lib/srs";

/**
 * Popula o banco com os decks iniciais.
 *
 * É idempotente: se já houver qualquer deck, não faz nada. Assim rodar o seed
 * de novo nunca duplica conteúdo nem apaga o progresso de quem já estudou.
 */

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL não está definida");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const existentes = await prisma.deck.count();
  if (existentes > 0) {
    console.log(`banco já tem ${existentes} deck(s) — nada a fazer`);
    return;
  }

  const agora = new Date();

  for (const [indice, seed] of SEED_DECKS.entries()) {
    const estadoInicial = newCardState(agora.getTime());

    const deck = await prisma.deck.create({
      data: {
        name: seed.name,
        description: seed.description,
        newPerDay: seed.newPerDay,
        // O deslocamento por índice mantém a ordem da lista estável: com o
        // mesmo instante para todos, o desempate ficaria a cargo do banco e
        // os decks trocariam de lugar entre carregamentos.
        createdAt: new Date(agora.getTime() + indice),
        cards: {
          create: seed.cards.map((card) => ({
            front: card.front,
            reading: card.reading,
            meaning: card.meaning,
            example: card.example,
            exampleMeaning: card.exampleMeaning,
            tags: card.tags ?? [],
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
  }
}

main()
  .catch((erro) => {
    console.error("falha ao popular o banco:", erro);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
