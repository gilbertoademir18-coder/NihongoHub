import { MAX_EASE } from "./srs";

/**
 * Treino livre: estudar fora da hora marcada.
 *
 * O SRS existe para **não** mostrar o que você já sabe — e é isso que faz o
 * app dizer "tudo em dia" justamente quando dá vontade de praticar. O treino
 * resolve a tensão separando os dois objetivos: aqui se repassa o quanto
 * quiser, e **nada muda no agendamento**. Uma palavra treinada hoje volta na
 * data que já tinha.
 *
 * As revisões de treino são gravadas mesmo assim, marcadas como tal: elas não
 * valem para o algoritmo, mas contam para responder "quais palavras eu mais
 * erro".
 *
 * Funções puras: a escolha do que treinar é testável sem banco.
 */

/** Quantas palavras entram num bloco de treino. */
export const TAMANHO_DO_BLOCO = 20;

/**
 * De quantos candidatos o bloco é sorteado.
 *
 * Pegar exatamente as 20 mais fracas faria o treino repetir sempre a mesma
 * lista; sortear entre as mais fracas mantém o foco na dificuldade sem virar
 * decoreba de ordem.
 */
export const FATOR_DE_SORTEIO = 3;

/** O que a seleção de treino precisa saber sobre um card. */
export interface CardParaTreino {
  /** Quantas vezes a palavra já foi esquecida depois de aprendida. */
  lapses: number;
  /** Fator de facilidade do SM-2: quanto menor, mais custou. */
  ease: number;
}

/** Peso de cada lapso em relação à escala de facilidade. */
const PESO_DO_LAPSO = 2;

/**
 * Quanto uma palavra ainda resiste.
 *
 * Soma os esquecimentos ao quanto ela vem se mostrando difícil. Zero é o piso:
 * palavra nunca esquecida e com facilidade máxima.
 */
export function pontuacaoDeFraqueza(card: CardParaTreino): number {
  return card.lapses * PESO_DO_LAPSO + (MAX_EASE - card.ease);
}

/**
 * Ordena da palavra mais resistente para a mais dominada.
 *
 * Não modifica o array recebido.
 */
export function ordenarPorFraqueza<T extends CardParaTreino>(cards: T[]): T[] {
  return [...cards].sort((a, b) => pontuacaoDeFraqueza(b) - pontuacaoDeFraqueza(a));
}

/**
 * Monta um bloco de treino: as mais difíceis primeiro, com sorteio entre elas.
 *
 * `sortear` é injetável para manter os testes determinísticos.
 */
export function montarBloco<T extends CardParaTreino>(
  candidatos: T[],
  tamanho = TAMANHO_DO_BLOCO,
  sortear: () => number = Math.random,
): T[] {
  const maisFracos = ordenarPorFraqueza(candidatos).slice(0, tamanho * FATOR_DE_SORTEIO);

  // Embaralhamento de Fisher-Yates sobre os candidatos já filtrados.
  const baralho = [...maisFracos];
  for (let i = baralho.length - 1; i > 0; i--) {
    const j = Math.floor(sortear() * (i + 1));
    [baralho[i], baralho[j]] = [baralho[j], baralho[i]];
  }

  return baralho.slice(0, tamanho);
}
