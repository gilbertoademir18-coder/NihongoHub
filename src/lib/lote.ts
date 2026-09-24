/**
 * Montagem do lote de estudo.
 *
 * A ideia é simples e é o que separa isto de um "X cards novos por dia":
 * novas palavras só entram quando há **vaga**, e vaga só existe quando outra
 * palavra já foi aprendida. Depois de uns dias sem estudar, você encontra o
 * atraso — e não o atraso somado a dez novidades.
 *
 * Funções puras: nenhuma consulta acontece aqui, para que a regra possa ser
 * testada sem banco.
 */

/** Quantas palavras ficam em aprendizado ao mesmo tempo, quando o deck não diz. */
export const LOTE_PADRAO = 10;

/**
 * A partir deste intervalo a palavra conta como aprendida e libera a vaga.
 *
 * É o parâmetro delicado do modelo: alto demais prende você nas mesmas dez
 * palavras por semanas; baixo demais devolve o comportamento de "dez novas por
 * dia", já que um card gradua em poucos minutos. Uma semana é o meio-termo
 * inicial — ajuste depois de sentir o ritmo na prática.
 */
export const LIMIAR_MADURO_DIAS = 7;

/**
 * Cards em aprendizado voltam à fila um pouco antes de vencer.
 *
 * O mesmo horizonte que a sessão usa para reinserir um card: sem isso, quem
 * recarrega a página no meio de um passo de 1 minuto encontra a fila vazia,
 * mesmo tendo acabado de começar.
 */
export const HORIZONTE_SESSAO_MS = 20 * 60_000;

/** O que a montagem do lote precisa saber sobre um card. */
export interface CardParaLote {
  intervalDays: number;
  introducedAt: Date | null;
}

/** A palavra já foi aprendida a ponto de liberar a vaga? */
export function amadureceu(card: CardParaLote): boolean {
  return card.introducedAt !== null && card.intervalDays >= LIMIAR_MADURO_DIAS;
}

/** Ocupa uma vaga do lote: já foi introduzida, mas ainda não amadureceu. */
export function ocupaVaga(card: CardParaLote): boolean {
  return card.introducedAt !== null && !amadureceu(card);
}

/**
 * Quantas palavras novas cabem agora.
 *
 * Nunca negativo: um dia ruim pode devolver ao lote mais cards do que o
 * tamanho nominal (quem esquece uma palavra madura volta a ocupar vaga), e
 * nesse caso a resposta é simplesmente "nenhuma nova por enquanto".
 */
export function vagasParaNovos(ocupantes: number, tamanhoDoLote = LOTE_PADRAO): number {
  return Math.max(0, tamanhoDoLote - ocupantes);
}

/**
 * Ordena a fila de uma sessão.
 *
 * Primeiro o que está em aprendizado (o passo curto é o que fixa a palavra),
 * depois as revisões vencidas, e só então as novidades — quem já está atrasado
 * não precisa de mais conteúdo na frente.
 */
export function ordenarFila<T extends { srs: { dueAt: number; learningStep: number | null } }>(
  emAprendizado: T[],
  vencidos: T[],
  novos: T[],
): T[] {
  const porVencimento = (a: T, b: T) => a.srs.dueAt - b.srs.dueAt;

  return [
    ...[...emAprendizado].sort(porVencimento),
    ...[...vencidos].sort(porVencimento),
    ...novos,
  ];
}
