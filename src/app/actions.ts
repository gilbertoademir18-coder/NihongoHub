"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { type CardEstudo, paraCardEstudo } from "@/lib/server/study";
import { type Rating, schedule } from "@/lib/srs";

const AVALIACOES: Rating[] = ["again", "hard", "good", "easy"];

/** Como o card foi apresentado — espelha o enum `ModoEstudo` do schema. */
export type ModoEstudo = "flashcard" | "digitacao";
const MODOS: ModoEstudo[] = ["flashcard", "digitacao"];

/** Corta a resposta guardada: é para diagnóstico, não para texto livre. */
const MAX_RESPOSTA = 100;

export interface DetalhesRevisao {
  modo?: ModoEstudo;
  /** O que foi digitado, quando errou. Serve para ver quais erros se repetem. */
  resposta?: string;
  /**
   * Prática fora da hora marcada.
   *
   * A revisão é registrada, mas o card **não** é reagendado: treinar hoje não
   * pode encurtar o intervalo de uma palavra que já estava bem aprendida.
   */
  treino?: boolean;
}

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
  detalhes: DetalhesRevisao = {},
): Promise<CardEstudo> {
  // Argumentos de Server Action chegam pela rede: valem como entrada externa,
  // por mais que só a nossa UI os envie.
  if (!AVALIACOES.includes(rating)) {
    throw new Error(`avaliação inválida: ${rating}`);
  }
  const modo = detalhes.modo ?? "flashcard";
  if (!MODOS.includes(modo)) {
    throw new Error(`modo inválido: ${modo}`);
  }
  const duracao = Number.isFinite(durationMs)
    ? Math.max(0, Math.round(durationMs))
    : 0;
  const resposta = detalhes.resposta?.slice(0, MAX_RESPOSTA) || null;
  const treino = detalhes.treino === true;

  const agora = new Date();

  const atualizado = await prisma.$transaction(async (tx) => {
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

    // Em treino o card não é reagendado: praticar fora de hora não pode
    // encurtar o intervalo de uma palavra que já estava bem aprendida. O
    // estado permanece exatamente como estava.
    const proximo = treino
      ? anterior
      : schedule(anterior, rating, { now: agora.getTime() });

    const atualizado = treino
      ? card
      : await tx.card.update({
          where: { id: cardId },
          data: {
            ease: proximo.ease,
            intervalDays: proximo.intervalDays,
            repetitions: proximo.repetitions,
            learningStep: proximo.learningStep,
            dueAt: new Date(proximo.dueAt),
            lapses: proximo.lapses,
            // Marca a estreia da palavra. É o que tira a vaga dela do lote de
            // novas — e só vale a primeira vez.
            introducedAt: card.introducedAt ?? agora,
          },
        });

    // A revisão e o novo agendamento gravam na mesma transação: se uma falhar,
    // as duas voltam atrás e o histórico nunca discorda do estado do card.
    await tx.review.create({
      data: {
        cardId,
        deckId: card.deckId,
        rating,
        modo,
        resposta,
        treino,
        reviewedAt: agora,
        intervalBefore: anterior.intervalDays,
        intervalAfter: proximo.intervalDays,
        durationMs: duracao,
      },
    });

    return paraCardEstudo(atualizado);
  });

  // Sem isto a home continua mostrando a contagem de antes da sessão: ela é
  // renderizada no servidor e o Next serve a versão em cache ao voltar.
  revalidatePath("/");

  return atualizado;
}
