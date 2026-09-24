"use server";

import { prisma } from "@/lib/prisma";
import { type CardEstudo, paraCardEstudo } from "@/lib/server/study";
import { type Rating, schedule } from "@/lib/srs";

const AVALIACOES: Rating[] = ["again", "hard", "good", "easy"];

/**
 * Registra uma revisão e devolve o card já reagendado.
 *
 * O agendamento roda no servidor, e não no navegador, porque o banco é a
 * autoridade sobre o estado do card: se dois aparelhos revisassem o mesmo
 * card, o cálculo feito no cliente poderia gravar por cima de um estado mais
 * novo sem perceber.
 */
export async function revisarCard(
  cardId: string,
  rating: Rating,
  durationMs: number,
): Promise<CardEstudo> {
  // Argumentos de Server Action chegam pela rede: valem como entrada externa,
  // por mais que só a nossa UI os envie.
  if (!AVALIACOES.includes(rating)) {
    throw new Error(`avaliação inválida: ${rating}`);
  }
  const duracao = Number.isFinite(durationMs)
    ? Math.max(0, Math.round(durationMs))
    : 0;

  const agora = new Date();

  return prisma.$transaction(async (tx) => {
    const card = await tx.card.findUnique({ where: { id: cardId } });
    if (!card) throw new Error(`card não encontrado: ${cardId}`);

    const anterior = {
      ease: card.ease,
      intervalDays: card.intervalDays,
      repetitions: card.repetitions,
      learningStep: card.learningStep,
      dueAt: card.dueAt.getTime(),
      lapses: card.lapses,
    };

    const proximo = schedule(anterior, rating, { now: agora.getTime() });

    const atualizado = await tx.card.update({
      where: { id: cardId },
      data: {
        ease: proximo.ease,
        intervalDays: proximo.intervalDays,
        repetitions: proximo.repetitions,
        learningStep: proximo.learningStep,
        dueAt: new Date(proximo.dueAt),
        lapses: proximo.lapses,
      },
    });

    // A revisão e o novo agendamento gravam na mesma transação: se uma falhar,
    // as duas voltam atrás e o histórico nunca discorda do estado do card.
    await tx.review.create({
      data: {
        cardId,
        deckId: card.deckId,
        rating,
        reviewedAt: agora,
        intervalBefore: anterior.intervalDays,
        intervalAfter: proximo.intervalDays,
        durationMs: duracao,
      },
    });

    return paraCardEstudo(atualizado);
  });
}
