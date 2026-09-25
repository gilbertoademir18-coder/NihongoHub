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

describe("termos de busca de imagem", () => {
  /** Tem ao menos um caractere japonês — kana ou kanji. */
  function ehJapones(termo: string) {
    return /[぀-ヿ一-鿿]/.test(termo);
  }

  it("termo só em kana nunca é curto o bastante para colidir como substring", () => {
    // Japonês não separa palavras, então a conferência do script só consegue
    // casar por substring — e substring curto casa dentro de outra palavra.
    // Medido: `たたみ` (tatami) trouxe 折りたたみ自転車, uma bicicleta dobrável,
    // e `あお` (azul) trouxe fotos da atriz Miyazaki あおい.
    //
    // O piso vale só para kana, que é escrita fonética e por isso colide: dois
    // kanji já formam uma palavra específica (`紅葉` é folhagem de outono e
    // nada mais), e exigir três deles proibiria termos bons.
    const soKana = (x: string) => /^[぀-ヿ]+$/.test(x);
    for (const p of PALAVRAS_KANA) {
      if (!p.busca || !ehJapones(p.busca)) continue;
      for (const pedaco of p.busca.split(/\s+/)) {
        if (!soKana(pedaco)) continue;
        expect(
          pedaco.length,
          `${p.palavra}: "${pedaco}" é kana curto demais para buscar`,
        ).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("termo em alfabeto latino nunca é uma palavra só de duas letras", () => {
    // Mesma armadilha do outro lado: a conferência exige palavra inteira, mas
    // um termo minúsculo casa com qualquer coisa e não identifica nada.
    for (const p of PALAVRAS_KANA) {
      if (!p.busca || ehJapones(p.busca)) continue;
      expect(p.busca.trim().length, `${p.palavra}: termo "${p.busca}" curto demais`)
        .toBeGreaterThan(2);
    }
  });

  it("toda palavra sem termo é sem imagem por decisão, não por esquecimento", () => {
    // A lista é explícita de propósito: acrescentar uma palavra nova sem
    // termo quebra este teste, obrigando a decidir se ela tem imagem ou não.
    const SEM_IMAGEM = new Set([
      "あい", "うえ", "きく", "こえ", "これ", "ろく", "わたし", "れきし", "るす",
      "げんき", "じかん", "ぜんぶ", "どこ", "ちぢむ", "つづく", "いっぱい",
      "ぺらぺら", "きょう", "びょうき", "ガス", "キロ", "ゼロ", "モデル",
      "ルール", "ユーモア", "ツアー",
    ]);
    const semTermo = PALAVRAS_KANA.filter((p) => !p.busca).map((p) => p.palavra);
    expect(new Set(semTermo)).toEqual(SEM_IMAGEM);
  });
});
