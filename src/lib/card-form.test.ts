import { describe, expect, it } from "vitest";
import {
  CARD_VAZIO,
  type DadosDoCard,
  normalizarCard,
  scriptDoCard,
  temErro,
  validarCard,
} from "./card-form";

function card(campos: Partial<DadosDoCard>): DadosDoCard {
  return { ...CARD_VAZIO, deckId: "d1", front: "ねこ", reading: "ねこ", meaning: "gato", ...campos };
}

describe("validarCard", () => {
  it("aceita o card mínimo completo", () => {
    expect(validarCard(card({}))).toEqual({});
  });

  it("exige deck, frente, leitura e significado", () => {
    const erros = validarCard({ ...CARD_VAZIO });
    expect(Object.keys(erros).sort()).toEqual(["deckId", "front", "meaning", "reading"]);
  });

  it("recusa leitura que não é kana", () => {
    // O modo digitação converte o que foi digitado em kana e compara com este
    // campo. Romaji aqui faria a resposta certa ser reprovada na sessão.
    expect(validarCard(card({ reading: "neko" })).reading).toBeDefined();
    expect(validarCard(card({ reading: "猫" })).reading).toBeDefined();
  });

  it("aceita leituras alternativas separadas por ・", () => {
    expect(validarCard(card({ front: "日", reading: "にち・ひ" }))).toEqual({});
  });

  it("recusa alternativa inválida mesmo quando a primeira é boa", () => {
    // Sem olhar cada pedaço, "にち・nichi" passaria por ter kana no começo.
    expect(validarCard(card({ reading: "にち・nichi" })).reading).toBeDefined();
  });

  it("aceita frase de exemplo sem tradução, mas não o contrário", () => {
    expect(validarCard(card({ example: "ねこがいます。" }))).toEqual({});
    expect(
      validarCard(card({ exampleMeaning: "Há um gato." })).exampleMeaning,
    ).toBeDefined();
  });

  it("valida o texto já normalizado, não o cru", () => {
    // Só espaços não é um significado preenchido.
    expect(validarCard(card({ meaning: "   " })).meaning).toBeDefined();
  });
});

describe("normalizarCard", () => {
  it("tira espaço das pontas e colapsa o do meio", () => {
    const d = normalizarCard(card({ front: "  ねこ ", meaning: "gato   doméstico" }));
    expect(d.front).toBe("ねこ");
    expect(d.meaning).toBe("gato doméstico");
  });

  it("remove tags repetidas e vazias", () => {
    const d = normalizarCard(card({ tags: ["animal", " animal ", "", "n5"] }));
    expect(d.tags).toEqual(["animal", "n5"]);
  });
});

describe("scriptDoCard", () => {
  it("classifica pelo silabário da frente", () => {
    expect(scriptDoCard("ねこ")).toBe("hiragana");
    expect(scriptDoCard("コーヒー")).toBe("katakana");
  });

  it("devolve null para kanji e para mistura", () => {
    // Nenhum dos dois: forçar um lado faria a sessão "só hiragana" mostrar
    // katakana, que é justamente o que o filtro promete não fazer.
    expect(scriptDoCard("日")).toBeNull();
    expect(scriptDoCard("ねこカフェ")).toBeNull();
    expect(scriptDoCard("お茶")).toBeNull();
  });

  it("o prolongador sozinho não decide o silabário", () => {
    expect(scriptDoCard("ー")).toBeNull();
  });
});

describe("temErro", () => {
  it("distingue vazio de preenchido", () => {
    expect(temErro({})).toBe(false);
    expect(temErro({ front: "obrigatório" })).toBe(true);
  });
});
