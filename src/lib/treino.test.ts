import { describe, expect, it } from "vitest";
import { DEFAULT_EASE, MAX_EASE, MIN_EASE } from "./srs";
import {
  FATOR_DE_SORTEIO,
  TAMANHO_DO_BLOCO,
  montarBloco,
  ordenarPorFraqueza,
  pontuacaoDeFraqueza,
} from "./treino";

const card = (lapses: number, ease = DEFAULT_EASE) => ({ lapses, ease });

describe("pontuacaoDeFraqueza", () => {
  it("palavra dominada pontua zero", () => {
    expect(pontuacaoDeFraqueza(card(0, MAX_EASE))).toBe(0);
  });

  it("esquecer pesa mais que achar difícil", () => {
    // Um lapso vale 2 pontos; toda a escala de facilidade vale 1,7.
    const esqueceuUmaVez = pontuacaoDeFraqueza(card(1, MAX_EASE));
    const nuncaEsqueceuMasCusta = pontuacaoDeFraqueza(card(0, MIN_EASE));
    expect(esqueceuUmaVez).toBeGreaterThan(nuncaEsqueceuMasCusta);
  });

  it("cresce com os lapsos", () => {
    expect(pontuacaoDeFraqueza(card(3))).toBeGreaterThan(pontuacaoDeFraqueza(card(1)));
  });

  it("cresce quando a facilidade cai", () => {
    expect(pontuacaoDeFraqueza(card(0, MIN_EASE))).toBeGreaterThan(
      pontuacaoDeFraqueza(card(0, DEFAULT_EASE)),
    );
  });
});

describe("ordenarPorFraqueza", () => {
  it("põe as mais resistentes na frente", () => {
    const cards = [card(0), card(5), card(2)];
    expect(ordenarPorFraqueza(cards).map((c) => c.lapses)).toEqual([5, 2, 0]);
  });

  it("não modifica o array recebido", () => {
    const cards = [card(0), card(5)];
    const copia = [...cards];
    ordenarPorFraqueza(cards);
    expect(cards).toEqual(copia);
  });
});

describe("montarBloco", () => {
  /** Sorteio fixo, para o teste não depender de acaso. */
  const semAcaso = () => 0;

  it("devolve no máximo o tamanho pedido", () => {
    const muitos = Array.from({ length: 100 }, (_, i) => card(i % 5));
    expect(montarBloco(muitos, 20, semAcaso)).toHaveLength(20);
  });

  it("devolve tudo quando há menos candidatos que o tamanho", () => {
    const poucos = [card(1), card(2)];
    expect(montarBloco(poucos, 20, semAcaso)).toHaveLength(2);
  });

  it("sorteia só entre as mais fracas, não entre todas", () => {
    // 10 resistentes e 90 dominadas: um bloco de 2 nunca deve trazer dominada.
    const resistentes = Array.from({ length: 10 }, () => card(9, MIN_EASE));
    const dominadas = Array.from({ length: 90 }, () => card(0, MAX_EASE));

    const bloco = montarBloco([...dominadas, ...resistentes], 2, semAcaso);
    expect(bloco.every((c) => c.lapses === 9)).toBe(true);
  });

  it("varia a ordem entre blocos, para não virar decoreba", () => {
    const candidatos = Array.from({ length: 30 }, (_, i) => card(i % 4));
    const primeiro = montarBloco(candidatos, 5, () => 0.1);
    const segundo = montarBloco(candidatos, 5, () => 0.9);
    expect(primeiro).not.toEqual(segundo);
  });

  it("considera mais candidatos do que o bloco, para sobrar de onde sortear", () => {
    const candidatos = Array.from({ length: 200 }, (_, i) => card(i));
    // Com o fator de sorteio, o bloco sai de um conjunto maior que ele mesmo.
    const bloco = montarBloco(candidatos, TAMANHO_DO_BLOCO, () => 0.5);
    const lapsosNoBloco = new Set(bloco.map((c) => c.lapses));
    expect(lapsosNoBloco.size).toBeGreaterThan(1);
    expect(TAMANHO_DO_BLOCO * FATOR_DE_SORTEIO).toBeGreaterThan(TAMANHO_DO_BLOCO);
  });
});
