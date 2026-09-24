import { describe, expect, it } from "vitest";
import {
  FORA_DE_META,
  FORA_DE_META_KATAKANA,
  alvoDeCobertura,
  caracteresDe,
  ehKana,
  paraHiragana,
} from "./kana";
import { PALAVRAS_KANA } from "./palavras-kana";
import { SEPARADOR_LEITURAS } from "./kana";
import { kanaParaRomaji, verificarResposta } from "./romaji";

const hiragana = PALAVRAS_KANA.filter((p) => p.script === "hiragana");
const katakana = PALAVRAS_KANA.filter((p) => p.script === "katakana");

/** Os kana que este conjunto de palavras efetivamente ensina. */
function cobertosPor(palavras: { palavra: string }[]): Set<string> {
  const vistos = new Set<string>();
  for (const { palavra } of palavras) {
    for (const c of caracteresDe(palavra)) vistos.add(c);
  }
  return vistos;
}

describe("cobertura de hiragana", () => {
  it("cobre todo kana da meta", () => {
    const vistos = cobertosPor(hiragana);
    const faltando = alvoDeCobertura("hiragana").filter((k) => !vistos.has(k));

    // A mensagem de erro é a ferramenta de trabalho: ela diz exatamente quais
    // palavras ainda precisam ser escolhidas.
    expect(faltando, `faltam palavras com: ${faltando.join(" ")}`).toEqual([]);
  });
});

describe("cobertura de katakana", () => {
  it("cobre todo kana da meta", () => {
    // Comparamos em hiragana porque `caracteresDe` normaliza o script.
    const vistos = cobertosPor(katakana);
    const faltando = alvoDeCobertura("katakana")
      .map(paraHiragana)
      .filter((k) => !vistos.has(k));

    expect(faltando, `faltam palavras com: ${faltando.join(" ")}`).toEqual([]);
  });
});

describe("fronteira da meta", () => {
  it("declara o motivo de cada kana deixado de fora", () => {
    // Uma exclusão sem justificativa escrita é indistinguível de um esquecimento.
    for (const motivo of Object.values({ ...FORA_DE_META, ...FORA_DE_META_KATAKANA })) {
      expect(motivo.length).toBeGreaterThan(10);
    }
  });

  it("を aparece em expressão, já que não ocorre dentro de palavras", () => {
    const comWo = PALAVRAS_KANA.filter((p) => p.palavra.includes("を"));
    expect(comWo.length).toBeGreaterThan(0);
    // Se を entrasse como palavra solta, seria a sílaba isolada que o modo
    // justamente evita.
    expect(comWo.every((p) => p.expressao === true)).toBe(true);
  });
});

describe("integridade dos dados", () => {
  it("não repete palavras", () => {
    const vistos = PALAVRAS_KANA.map((p) => p.palavra);
    expect(new Set(vistos).size).toBe(vistos.length);
  });

  it("toda palavra tem significado", () => {
    for (const p of PALAVRAS_KANA) {
      expect(p.meaning.trim().length, `sem significado: ${p.palavra}`).toBeGreaterThan(0);
    }
  });

  it("toda palavra é feita só de kana", () => {
    // Exigir kanji mudaria o exercício: aqui se treina ler o silabário.
    for (const p of PALAVRAS_KANA) {
      const invalidos = [...p.palavra].filter((c) => !ehKana(c));
      expect(invalidos, `${p.palavra} tem caractere fora do kana`).toEqual([]);
    }
  });

  it("nenhuma palavra usa o separador de leituras", () => {
    for (const p of PALAVRAS_KANA) {
      expect(p.palavra.includes(SEPARADOR_LEITURAS)).toBe(false);
    }
  });

  it("palavras de hiragana não contêm katakana, e vice-versa", () => {
    const faixaKatakana = /[ァ-ヶ]/;
    for (const p of PALAVRAS_KANA) {
      if (p.expressao) continue; // expressões podem misturar
      const temKatakana = faixaKatakana.test(p.palavra);
      expect(temKatakana, `${p.palavra} declarado como ${p.script}`).toBe(
        p.script === "katakana",
      );
    }
  });
});

describe("compatibilidade com o modo de digitação", () => {
  it("toda palavra pode ser respondida digitando seu próprio romaji", () => {
    // Se esta invariante quebrar, existe palavra impossível de acertar.
    for (const p of PALAVRAS_KANA) {
      const romaji = kanaParaRomaji(p.palavra);
      expect(
        verificarResposta(romaji, p.palavra).acertou,
        `${p.palavra} → "${romaji}" não volta`,
      ).toBe(true);
    }
  });
});

describe("ordem pedagógica", () => {
  it("nenhuma palavra introduz mais de 3 caracteres novos de uma vez", () => {
    // Garante que o primeiro lote de 10 seja aprendível, e que ninguém
    // acrescente uma palavra difícil no começo da lista sem perceber.
    for (const script of ["hiragana", "katakana"] as const) {
      const vistos = new Set<string>();
      for (const p of PALAVRAS_KANA.filter((x) => x.script === script)) {
        // Deduplica: コーヒー tem quatro posições, mas só três caracteres
        // distintos — o ー repetido não é novidade para quem está aprendendo.
        const novos = [...new Set(caracteresDe(p.palavra))].filter((c) => !vistos.has(c));
        expect(
          novos.length,
          `${p.palavra} introduz ${novos.length} caracteres novos: ${novos.join("")}`,
        ).toBeLessThanOrEqual(3);
        for (const c of caracteresDe(p.palavra)) vistos.add(c);
      }
    }
  });
});
