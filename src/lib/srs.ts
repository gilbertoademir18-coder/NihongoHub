/**
 * Agendamento SRS baseado em SM-2, com passos de aprendizado no estilo Anki.
 *
 * Funções puras de propósito: recebem o estado atual e devolvem o próximo.
 * Nada de I/O aqui — é o que torna o agendamento testável e faz com que ele
 * funcione offline sem depender de servidor.
 */

/** Como o usuário avaliou a própria lembrança do card. */
export type Rating = "again" | "hard" | "good" | "easy";

export interface SrsState {
  /** Fator de facilidade do SM-2: quanto maior, mais rápido o intervalo cresce. */
  ease: number;
  /** Intervalo atual, em dias. 0 enquanto o card ainda está em aprendizado. */
  intervalDays: number;
  /** Revisões corretas consecutivas. */
  repetitions: number;
  /**
   * Índice do passo de aprendizado/reaprendizado atual.
   * `null` significa que o card já graduou e está em revisão normal.
   */
  learningStep: number | null;
  /** Quando o card deve reaparecer (epoch em ms). */
  dueAt: number;
  /** Quantas vezes o card já foi esquecido depois de ter graduado. */
  lapses: number;
}

/** Minutos entre cada passo antes do card graduar. */
export const LEARNING_STEPS_MIN = [1, 10] as const;
/** Minutos de espera depois de errar um card já graduado. */
export const RELEARNING_STEPS_MIN = [10] as const;

/** Intervalo em dias ao graduar com "good". */
export const GRADUATING_INTERVAL_DAYS = 1;
/** Intervalo em dias ao pular o aprendizado com "easy". */
export const EASY_INTERVAL_DAYS = 4;

/** Abaixo disso o card viraria uma tortura diária; o SM-2 original usa o mesmo piso. */
export const MIN_EASE = 1.3;
export const MAX_EASE = 3.0;
export const DEFAULT_EASE = 2.5;

/** Teto para não agendar cards para daqui a séculos. */
export const MAX_INTERVAL_DAYS = 365 * 5;

/** Quanto cada avaliação mexe no fator de facilidade. */
const EASE_DELTA: Record<Rating, number> = {
  again: -0.2,
  hard: -0.15,
  good: 0,
  easy: 0.15,
};

/** Multiplicador de intervalo do "hard" (não usa o ease, por definição do SM-2). */
const HARD_MULTIPLIER = 1.2;
/** Bônus aplicado por cima do ease quando a resposta é "easy". */
const EASY_BONUS = 1.3;
/** Fração do intervalo que sobrevive a um lapso. */
const LAPSE_MULTIPLIER = 0.5;

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** Estado de um card que nunca foi estudado: vence imediatamente. */
export function newCardState(now: number = Date.now()): SrsState {
  return {
    ease: DEFAULT_EASE,
    intervalDays: 0,
    repetitions: 0,
    learningStep: 0,
    dueAt: now,
    lapses: 0,
  };
}

export function isLearning(state: SrsState): boolean {
  return state.learningStep !== null;
}

export function isDue(state: SrsState, now: number = Date.now()): boolean {
  return state.dueAt <= now;
}

export interface ScheduleOptions {
  /** Momento da revisão. Injetável para manter os testes determinísticos. */
  now?: number;
  /**
   * Fonte de aleatoriedade do espalhamento de vencimentos. Injetável para
   * testes; na prática só é usada quando `fuzz` está ligado.
   */
  random?: () => number;
  /**
   * Espalha os vencimentos em ±5% para que cards estudados juntos não voltem
   * todos no mesmo dia. Desligue em testes e importações em lote.
   */
  fuzz?: boolean;
}

/**
 * Calcula o próximo estado do card a partir da avaliação do usuário.
 *
 * O estado de entrada não é modificado: sempre devolvemos um objeto novo.
 */
export function schedule(
  state: SrsState,
  rating: Rating,
  options: ScheduleOptions = {},
): SrsState {
  const { now = Date.now(), random = Math.random, fuzz = true } = options;

  const ease = clamp(state.ease + EASE_DELTA[rating], MIN_EASE, MAX_EASE);

  // --- Card ainda em aprendizado (ou reaprendizado) ---------------------
  if (state.learningStep !== null) {
    // Um card com intervalo > 0 já graduou algum dia: está reaprendendo.
    const steps =
      state.intervalDays > 0 ? RELEARNING_STEPS_MIN : LEARNING_STEPS_MIN;

    if (rating === "again") {
      // Errou de novo: volta para o primeiro passo.
      return {
        ...state,
        ease,
        learningStep: 0,
        repetitions: 0,
        dueAt: now + steps[0] * MINUTE_MS,
      };
    }

    if (rating === "easy") {
      // "Easy" pula o resto do aprendizado e gradua na hora.
      return graduate(state, ease, EASY_INTERVAL_DAYS, now, random, fuzz);
    }

    if (rating === "hard") {
      // "Hard" não avança o passo, mas também não pode devolver a mesma espera
      // do "again" — dois botões com o mesmo resultado confundem quem estuda.
      // Fica no meio do caminho entre o passo atual e o seguinte.
      const current = steps[state.learningStep];
      const following = steps[state.learningStep + 1];
      const delayMin =
        following === undefined ? current * HARD_MULTIPLIER : (current + following) / 2;

      return {
        ...state,
        ease,
        learningStep: state.learningStep,
        dueAt: now + Math.round(delayMin) * MINUTE_MS,
      };
    }

    // Só resta "good": avança para o próximo passo.
    const nextStep = state.learningStep + 1;

    if (nextStep >= steps.length) {
      // Passou do último passo: o card gradua. Quem está reaprendendo volta
      // com o intervalo que já foi cortado no lapso — cortar de novo aqui
      // puniria o mesmo erro duas vezes.
      const interval =
        state.intervalDays > 0 ? state.intervalDays : GRADUATING_INTERVAL_DAYS;
      return graduate(state, ease, interval, now, random, fuzz);
    }

    return {
      ...state,
      ease,
      learningStep: nextStep,
      dueAt: now + steps[nextStep] * MINUTE_MS,
    };
  }

  // --- Card já graduado, em revisão normal ------------------------------
  if (rating === "again") {
    // Lapso: cai para o reaprendizado e perde metade do intervalo.
    return {
      ...state,
      ease,
      repetitions: 0,
      lapses: state.lapses + 1,
      intervalDays: Math.max(
        1,
        Math.round(state.intervalDays * LAPSE_MULTIPLIER),
      ),
      learningStep: 0,
      dueAt: now + RELEARNING_STEPS_MIN[0] * MINUTE_MS,
    };
  }

  const multiplier =
    rating === "hard"
      ? HARD_MULTIPLIER
      : rating === "easy"
        ? ease * EASY_BONUS
        : ease;

  // O piso de +1 dia garante que o intervalo sempre avance, mesmo com ease mínimo.
  const rawInterval = Math.max(
    state.intervalDays + 1,
    Math.round(state.intervalDays * multiplier),
  );
  const intervalDays = clamp(rawInterval, 1, MAX_INTERVAL_DAYS);

  return {
    ...state,
    ease,
    intervalDays,
    repetitions: state.repetitions + 1,
    learningStep: null,
    dueAt: dueFromInterval(intervalDays, now, random, fuzz),
  };
}

function graduate(
  state: SrsState,
  ease: number,
  intervalDays: number,
  now: number,
  random: () => number,
  fuzz: boolean,
): SrsState {
  const capped = clamp(intervalDays, 1, MAX_INTERVAL_DAYS);
  return {
    ...state,
    ease,
    intervalDays: capped,
    repetitions: state.repetitions + 1,
    learningStep: null,
    dueAt: dueFromInterval(capped, now, random, fuzz),
  };
}

/** Converte um intervalo em dias no instante de vencimento, com leve espalhamento. */
function dueFromInterval(
  intervalDays: number,
  now: number,
  random: () => number,
  fuzz: boolean,
): number {
  if (!fuzz || intervalDays < 2) {
    // Intervalos curtos não têm folga para espalhar sem bagunçar a ordem do dia.
    return now + intervalDays * DAY_MS;
  }
  const spread = 0.05 * intervalDays * DAY_MS;
  return Math.round(now + intervalDays * DAY_MS + (random() * 2 - 1) * spread);
}

/** Pré-visualiza a espera de cada botão, para mostrar na UI de revisão. */
export function previewIntervals(
  state: SrsState,
  now: number = Date.now(),
): Record<Rating, number> {
  const ratings: Rating[] = ["again", "hard", "good", "easy"];
  const preview = {} as Record<Rating, number>;
  for (const rating of ratings) {
    preview[rating] = schedule(state, rating, { now, fuzz: false }).dueAt - now;
  }
  return preview;
}

/** Formata uma espera em ms no rótulo curto dos botões ("10 min", "3 d"). */
export function formatDelay(ms: number): string {
  const minutes = ms / MINUTE_MS;
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))} min`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours)} h`;
  const days = hours / 24;
  if (days < 30) return `${Math.round(days)} d`;
  const months = days / 30;
  if (months < 12) return `${Math.round(months)} mês`;
  return `${(days / 365).toFixed(1)} ano`;
}
