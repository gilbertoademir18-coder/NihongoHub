import { describe, expect, it } from "vitest";
import {
  DEFAULT_EASE,
  EASY_INTERVAL_DAYS,
  GRADUATING_INTERVAL_DAYS,
  MAX_INTERVAL_DAYS,
  MIN_EASE,
  type Rating,
  type SrsState,
  formatDelay,
  isDue,
  newCardState,
  previewIntervals,
  schedule,
} from "./srs";

const NOW = Date.UTC(2026, 0, 1, 12, 0, 0);
const MINUTE = 60_000;
const DAY = 86_400_000;

/** Sem fuzz: os testes comparam datas exatas. */
const fixed = { now: NOW, fuzz: false as const };

/** Um card já graduado, para exercitar o caminho de revisão. */
function graduated(overrides: Partial<SrsState> = {}): SrsState {
  return {
    ease: DEFAULT_EASE,
    intervalDays: 10,
    repetitions: 3,
    learningStep: null,
    dueAt: NOW,
    lapses: 0,
    ...overrides,
  };
}

/** Avalia o card várias vezes seguidas, sempre "agora". */
function replay(state: SrsState, ratings: Rating[]): SrsState {
  return ratings.reduce((acc, rating) => schedule(acc, rating, fixed), state);
}

describe("newCardState", () => {
  it("cria um card que vence imediatamente e está em aprendizado", () => {
    const state = newCardState(NOW);
    expect(state.dueAt).toBe(NOW);
    expect(state.learningStep).toBe(0);
    expect(state.intervalDays).toBe(0);
    expect(isDue(state, NOW)).toBe(true);
  });
});

describe("aprendizado", () => {
  it("avança um passo com 'good' sem graduar", () => {
    const state = schedule(newCardState(NOW), "good", fixed);
    expect(state.learningStep).toBe(1);
    expect(state.dueAt).toBe(NOW + 10 * MINUTE);
    expect(state.intervalDays).toBe(0);
  });

  it("gradua depois do último passo", () => {
    const state = replay(newCardState(NOW), ["good", "good"]);
    expect(state.learningStep).toBeNull();
    expect(state.intervalDays).toBe(GRADUATING_INTERVAL_DAYS);
    expect(state.dueAt).toBe(NOW + GRADUATING_INTERVAL_DAYS * DAY);
  });

  it("'easy' pula o aprendizado e gradua direto", () => {
    const state = schedule(newCardState(NOW), "easy", fixed);
    expect(state.learningStep).toBeNull();
    expect(state.intervalDays).toBe(EASY_INTERVAL_DAYS);
  });

  it("'hard' repete o passo atual em vez de avançar", () => {
    const step1 = schedule(newCardState(NOW), "good", fixed);
    const stillStep1 = schedule(step1, "hard", fixed);
    expect(stillStep1.learningStep).toBe(1);
    expect(stillStep1.intervalDays).toBe(0); // não graduou
  });

  it("'hard' espera entre o passo atual e o próximo — nunca o mesmo que 'again'", () => {
    const fresh = newCardState(NOW);
    const again = schedule(fresh, "again", fixed);
    const hard = schedule(fresh, "hard", fixed);
    const good = schedule(fresh, "good", fixed);

    // Passos [1, 10]: again volta em 1 min, hard no meio (~6), good em 10.
    expect(hard.dueAt).toBeGreaterThan(again.dueAt);
    expect(hard.dueAt).toBeLessThan(good.dueAt);
    expect(hard.dueAt).toBe(NOW + 6 * MINUTE);
  });

  it("no último passo, 'hard' ainda espera mais que 'again'", () => {
    const lastStep = schedule(newCardState(NOW), "good", fixed);
    const again = schedule(lastStep, "again", fixed);
    const hard = schedule(lastStep, "hard", fixed);
    expect(hard.dueAt).toBeGreaterThan(again.dueAt);
  });

  it("'again' volta para o primeiro passo", () => {
    const state = replay(newCardState(NOW), ["good", "again"]);
    expect(state.learningStep).toBe(0);
    expect(state.dueAt).toBe(NOW + 1 * MINUTE);
  });
});

describe("revisão de cards graduados", () => {
  it("'good' multiplica o intervalo pelo ease", () => {
    const state = schedule(graduated(), "good", fixed);
    expect(state.intervalDays).toBe(Math.round(10 * DEFAULT_EASE)); // 25
    expect(state.repetitions).toBe(4);
  });

  it("'hard' cresce devagar e reduz o ease", () => {
    const state = schedule(graduated(), "hard", fixed);
    expect(state.intervalDays).toBe(12); // 10 * 1.2
    expect(state.ease).toBeCloseTo(DEFAULT_EASE - 0.15, 5);
  });

  it("'easy' cresce mais que 'good' e aumenta o ease", () => {
    const good = schedule(graduated(), "good", fixed);
    const easy = schedule(graduated(), "easy", fixed);
    expect(easy.intervalDays).toBeGreaterThan(good.intervalDays);
    expect(easy.ease).toBeGreaterThan(DEFAULT_EASE);
  });

  it("o intervalo sempre avança pelo menos um dia, mesmo com ease no piso", () => {
    const state = schedule(graduated({ ease: MIN_EASE, intervalDays: 1 }), "hard", fixed);
    expect(state.intervalDays).toBeGreaterThan(1);
  });

  it("respeita o teto de intervalo", () => {
    const state = schedule(graduated({ intervalDays: MAX_INTERVAL_DAYS }), "easy", fixed);
    expect(state.intervalDays).toBe(MAX_INTERVAL_DAYS);
  });
});

describe("lapsos", () => {
  it("'again' num card graduado conta lapso e manda para reaprendizado", () => {
    const state = schedule(graduated(), "again", fixed);
    expect(state.lapses).toBe(1);
    expect(state.learningStep).toBe(0);
    expect(state.repetitions).toBe(0);
    expect(state.dueAt).toBe(NOW + 10 * MINUTE);
    expect(state.intervalDays).toBe(5); // metade de 10, preservada para a volta
  });

  it("ao reaprender, volta com o intervalo reduzido — e não do zero", () => {
    const lapsed = schedule(graduated({ intervalDays: 30 }), "again", fixed);
    const back = schedule(lapsed, "good", fixed);
    expect(back.learningStep).toBeNull();
    // 30 -> 15 no lapso, e a volta mantém esses 15: o corte é um só.
    expect(back.intervalDays).toBe(15);
    expect(back.intervalDays).toBeGreaterThan(GRADUATING_INTERVAL_DAYS);
  });

  it("um único erro corta o intervalo uma vez só, não a cada etapa", () => {
    const before = graduated({ intervalDays: 40 });
    const back = schedule(schedule(before, "again", fixed), "good", fixed);
    expect(back.intervalDays).toBe(before.intervalDays / 2);
  });

  it("o ease nunca cai abaixo do piso, por mais que se erre", () => {
    const state = replay(graduated(), Array(30).fill("again"));
    expect(state.ease).toBe(MIN_EASE);
  });

  it("o ease nunca sobe indefinidamente", () => {
    const state = replay(graduated(), Array(30).fill("easy"));
    expect(state.ease).toBeLessThanOrEqual(3.0);
  });
});

describe("imutabilidade", () => {
  it("não modifica o estado recebido", () => {
    const original = graduated();
    const snapshot = { ...original };
    schedule(original, "good", fixed);
    expect(original).toEqual(snapshot);
  });
});

describe("fuzz", () => {
  it("espalha o vencimento dentro de ±5% do intervalo", () => {
    const state = graduated({ intervalDays: 100 });
    const early = schedule(state, "good", { now: NOW, random: () => 0 });
    const late = schedule(state, "good", { now: NOW, random: () => 1 });
    const exact = NOW + early.intervalDays * DAY;
    const tolerance = 0.05 * early.intervalDays * DAY;

    expect(early.dueAt).toBeGreaterThanOrEqual(exact - tolerance);
    expect(late.dueAt).toBeLessThanOrEqual(exact + tolerance);
    expect(early.dueAt).toBeLessThan(late.dueAt);
    // O intervalo em si não muda: o fuzz só mexe no instante de vencimento.
    expect(early.intervalDays).toBe(late.intervalDays);
  });

  it("não espalha intervalos curtos, que não têm folga", () => {
    const state = schedule(newCardState(NOW), "easy", { now: NOW, random: () => 1 });
    const exact = NOW + EASY_INTERVAL_DAYS * DAY;
    expect(Math.abs(state.dueAt - exact)).toBeLessThanOrEqual(0.05 * EASY_INTERVAL_DAYS * DAY);
  });
});

describe("previewIntervals", () => {
  it("devolve esperas crescentes de 'again' até 'easy'", () => {
    const preview = previewIntervals(graduated(), NOW);
    expect(preview.again).toBeLessThan(preview.hard);
    expect(preview.hard).toBeLessThan(preview.good);
    expect(preview.good).toBeLessThan(preview.easy);
  });

  it("também cresce num card novo — os quatro botões são distintos", () => {
    const preview = previewIntervals(newCardState(NOW), NOW);
    const esperas = [preview.again, preview.hard, preview.good, preview.easy];
    expect(esperas).toEqual([...esperas].sort((a, b) => a - b));
    expect(new Set(esperas).size).toBe(4);
  });

  it("é determinístico — dois preview seguidos batem", () => {
    const a = previewIntervals(graduated(), NOW);
    const b = previewIntervals(graduated(), NOW);
    expect(a).toEqual(b);
  });
});

describe("formatDelay", () => {
  it.each([
    [1 * MINUTE, "1 min"],
    [10 * MINUTE, "10 min"],
    [3 * 3_600_000, "3 h"],
    [5 * DAY, "5 d"],
    [90 * DAY, "3 mês"],
    [400 * DAY, "1.1 ano"],
  ])("formata %i como %s", (ms, expected) => {
    expect(formatDelay(ms)).toBe(expected);
  });
});
