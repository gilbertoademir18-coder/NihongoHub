import { describe, expect, it } from "vitest";
import {
  LIMIAR_MADURO_DIAS,
  LOTE_PADRAO,
  amadureceu,
  ocupaVaga,
  ordenarFila,
  vagasParaNovos,
} from "./lote";

const ONTEM = new Date(2026, 0, 1);

describe("amadureceu", () => {
  it("palavra nunca vista não amadureceu", () => {
    expect(amadureceu({ intervalDays: 0, introducedAt: null })).toBe(false);
  });

  it("palavra em aprendizado não amadureceu", () => {
    expect(amadureceu({ intervalDays: 1, introducedAt: ONTEM })).toBe(false);
  });

  it("palavra com intervalo longo amadureceu", () => {
    expect(
      amadureceu({ intervalDays: LIMIAR_MADURO_DIAS, introducedAt: ONTEM }),
    ).toBe(true);
  });
});

describe("ocupaVaga", () => {
  it("palavra nova não ocupa vaga — ela ainda vai disputar uma", () => {
    expect(ocupaVaga({ intervalDays: 0, introducedAt: null })).toBe(false);
  });

  it("palavra em aprendizado ocupa vaga", () => {
    expect(ocupaVaga({ intervalDays: 2, introducedAt: ONTEM })).toBe(true);
  });

  it("palavra madura libera a vaga", () => {
    expect(ocupaVaga({ intervalDays: 30, introducedAt: ONTEM })).toBe(false);
  });
});

describe("vagasParaNovos", () => {
  it("lote vazio abre todas as vagas", () => {
    expect(vagasParaNovos(0)).toBe(LOTE_PADRAO);
  });

  it("lote cheio não abre nenhuma", () => {
    expect(vagasParaNovos(LOTE_PADRAO)).toBe(0);
  });

  it("respeita o tamanho do deck", () => {
    expect(vagasParaNovos(3, 5)).toBe(2);
  });

  it("nunca devolve negativo, mesmo com o lote estourado", () => {
    // Acontece de verdade: esquecer palavras maduras devolve todas ao lote.
    expect(vagasParaNovos(18, 10)).toBe(0);
  });
});

describe("ordenarFila", () => {
  const card = (dueAt: number, learningStep: number | null = null) => ({
    srs: { dueAt, learningStep },
  });

  it("põe aprendizado antes de revisão, e novidade por último", () => {
    const fila = ordenarFila(
      [card(500, 0)],
      [card(100)],
      [card(0)],
    );
    expect(fila.map((c) => c.srs.dueAt)).toEqual([500, 100, 0]);
  });

  it("dentro de cada grupo, o mais atrasado vem primeiro", () => {
    const fila = ordenarFila([], [card(300), card(100), card(200)], []);
    expect(fila.map((c) => c.srs.dueAt)).toEqual([100, 200, 300]);
  });

  it("preserva a ordem de introdução das palavras novas", () => {
    // As novas vêm ordenadas do banco pela ordem pedagógica: não reordenar.
    const fila = ordenarFila([], [], [card(30), card(10), card(20)]);
    expect(fila.map((c) => c.srs.dueAt)).toEqual([30, 10, 20]);
  });

  it("não modifica os arrays recebidos", () => {
    const vencidos = [card(300), card(100)];
    const copia = [...vencidos];
    ordenarFila([], vencidos, []);
    expect(vencidos).toEqual(copia);
  });
});
