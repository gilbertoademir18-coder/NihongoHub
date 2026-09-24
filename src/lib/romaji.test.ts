import { describe, expect, it } from "vitest";
import {
  avaliarDigitacao,
  chaveComparacao,
  kanaParaRomaji,
  kanaParcial,
  leiturasAceitas,
  romajiParaKana,
  verificarResposta,
} from "./romaji";

describe("romajiParaKana — sílabas", () => {
  it.each([
    ["sakura", "さくら"],
    ["neko", "ねこ"],
    ["yama", "やま"],
    ["mizu", "みず"],
    ["tamago", "たまご"],
    ["denwa", "でんわ"],
  ])("%s → %s", (entrada, esperado) => {
    expect(romajiParaKana(entrada)).toBe(esperado);
  });

  it.each([
    ["shashin", "しゃしん"],
    ["kyou", "きょう"],
    ["ryouri", "りょうり"],
    ["byouki", "びょうき"],
    ["juu", "じゅう"],
  ])("dígrafo: %s → %s", (entrada, esperado) => {
    expect(romajiParaKana(entrada)).toBe(esperado);
  });
});

describe("romajiParaKana — Hepburn estrito", () => {
  // A escolha foi ensinar Hepburn: as formas Kunrei não estão na tabela e,
  // por isso, simplesmente não tokenizam.
  it.each(["si", "ti", "tu", "hu", "zi", "sya", "syu", "jya", "tya"])(
    "rejeita a forma Kunrei %s",
    (entrada) => {
      expect(romajiParaKana(entrada)).toBeNull();
    },
  );

  it.each(["shi", "chi", "tsu", "fu", "ji", "sha", "ja"])(
    "aceita a forma Hepburn %s",
    (entrada) => {
      expect(romajiParaKana(entrada)).not.toBeNull();
    },
  );

  it.each(["", "xyz", "sakura!", "123"])("rejeita entrada inválida %s", (entrada) => {
    expect(romajiParaKana(entrada)).toBeNull();
  });
});

describe("romajiParaKana — sokuon (っ)", () => {
  it.each([
    ["gakkou", "がっこう"],
    ["kitte", "きって"],
    ["kippu", "きっぷ"],
    ["zasshi", "ざっし"],
    ["ippai", "いっぱい"],
    ["matcha", "まっちゃ"], // Hepburn escreve っち como "tch"
  ])("%s → %s", (entrada, esperado) => {
    expect(romajiParaKana(entrada)).toBe(esperado);
  });
});

describe("romajiParaKana — ん", () => {
  it("vira ん quando não forma sílaba com o que vem depois", () => {
    expect(romajiParaKana("kanji")).toBe("かんじ");
    expect(romajiParaKana("nihon")).toBe("にほん");
    expect(romajiParaKana("ringo")).toBe("りんご");
  });

  it("forma sílaba quando pode — kani não é kan-i", () => {
    expect(romajiParaKana("kani")).toBe("かに");
    expect(romajiParaKana("hon'ya")).toBe("ほんや");
    expect(romajiParaKana("honya")).toBe("ほにゃ");
  });

  it("o apóstrofo força a separação", () => {
    expect(romajiParaKana("kan'i")).toBe("かんい");
  });

  it("n duplo não vira sokuon: sennin é せんにん", () => {
    expect(romajiParaKana("sennin")).toBe("せんにん");
  });
});

describe("romajiParaKana — vogais longas", () => {
  it("aceita macron como vogal dobrada", () => {
    expect(romajiParaKana("kōhī")).toBe(romajiParaKana("koohii"));
    expect(romajiParaKana("tōkyō")).toBe(romajiParaKana("tookyoo"));
  });

  it("distingue おう de おお — são grafias diferentes", () => {
    expect(romajiParaKana("kou")).toBe("こう");
    expect(romajiParaKana("koo")).toBe("こお");
  });
});

describe("romajiParaKana — entrada já em kana", () => {
  it("passa direto quando o IME está ligado", () => {
    expect(romajiParaKana("さくら")).toBe("さくら");
  });

  it("converte katakana digitado para hiragana", () => {
    expect(romajiParaKana("コーヒー")).toBe("こーひー");
  });
});

describe("chaveComparacao", () => {
  it("iguala katakana e hiragana", () => {
    expect(chaveComparacao("コーヒー")).toBe(chaveComparacao("こーひー"));
  });

  it("expande o prolongador para a vogal que ele repete", () => {
    expect(chaveComparacao("コーヒー")).toBe(chaveComparacao("こおひい"));
  });

  it("funde os pares que o Hepburn não distingue", () => {
    // づ e ず são ambos "zu"; ぢ e じ, ambos "ji".
    expect(chaveComparacao("つづく")).toBe(chaveComparacao("つずく"));
    expect(chaveComparacao("はなぢ")).toBe(chaveComparacao("はなじ"));
  });

  it("não funde o que o Hepburn distingue", () => {
    expect(chaveComparacao("こう")).not.toBe(chaveComparacao("こお"));
    expect(chaveComparacao("さか")).not.toBe(chaveComparacao("さが"));
  });
});

describe("leiturasAceitas", () => {
  it("separa as alternativas dos cards de kanji", () => {
    expect(leiturasAceitas("にち・ひ")).toEqual(["にち", "ひ"]);
  });

  it("devolve uma só quando não há separador", () => {
    expect(leiturasAceitas("がっこう")).toEqual(["がっこう"]);
  });
});

describe("verificarResposta", () => {
  it("aceita a resposta certa", () => {
    expect(verificarResposta("sakura", "さくら").acertou).toBe(true);
  });

  it("recusa a resposta errada", () => {
    expect(verificarResposta("sakana", "さくら").acertou).toBe(false);
  });

  it("aceita qualquer leitura alternativa do card", () => {
    // 日 aceita tanto にち quanto ひ.
    expect(verificarResposta("nichi", "にち・ひ").acertou).toBe(true);
    expect(verificarResposta("hi", "にち・ひ").acertou).toBe(true);
    expect(verificarResposta("tsuki", "にち・ひ").acertou).toBe(false);
  });

  it("diz qual leitura bateu", () => {
    expect(verificarResposta("hi", "にち・ひ").leituraEsperada).toBe("ひ");
  });

  it("aceita づ escrito como zu, que é o Hepburn correto", () => {
    expect(verificarResposta("tsuzuku", "つづく").acertou).toBe(true);
    expect(verificarResposta("hanaji", "はなぢ").acertou).toBe(true);
  });

  it("aceita a palavra em katakana digitada com vogal dobrada", () => {
    expect(verificarResposta("koohii", "コーヒー").acertou).toBe(true);
    expect(verificarResposta("kōhī", "コーヒー").acertou).toBe(true);
  });

  it("exige o alongamento — kohi não é コーヒー", () => {
    expect(verificarResposta("kohi", "コーヒー").acertou).toBe(false);
  });

  it("devolve kana null quando a digitação não é Hepburn", () => {
    const veredito = verificarResposta("si", "し");
    expect(veredito.acertou).toBe(false);
    expect(veredito.kana).toBeNull();
  });

  it("ignora espaços e maiúsculas", () => {
    expect(verificarResposta("  SaKuRa ", "さくら").acertou).toBe(true);
  });
});

describe("avaliarDigitacao — conferência a cada tecla", () => {
  it("fica em aberto enquanto a resposta ainda pode se formar", () => {
    for (const parcial of ["s", "sa", "sak", "saku", "sakur"]) {
      expect(avaliarDigitacao(parcial, "さくら"), parcial).toBe("incompleto");
    }
  });

  it("reprova assim que o caminho para a resposta se fecha", () => {
    // さくな nunca vira さくら: não adianta esperar o resto.
    expect(avaliarDigitacao("sakuna", "さくら")).toBe("errou");
    expect(avaliarDigitacao("neko", "さくら")).toBe("errou");
  });

  it("aprova no instante em que a palavra fecha", () => {
    expect(avaliarDigitacao("sakura", "さくら")).toBe("acertou");
  });

  it("campo vazio fica em aberto, não é erro", () => {
    expect(avaliarDigitacao("", "さくら")).toBe("incompleto");
  });

  it("considera todas as leituras alternativas", () => {
    // 日 aceita にち e ひ: digitar "hi" fecha, "ni" ainda está a caminho.
    expect(avaliarDigitacao("hi", "にち・ひ")).toBe("acertou");
    expect(avaliarDigitacao("ni", "にち・ひ")).toBe("incompleto");
    expect(avaliarDigitacao("nichi", "にち・ひ")).toBe("acertou");
    expect(avaliarDigitacao("tsu", "にち・ひ")).toBe("errou");
  });

  it("exige o alongamento do katakana", () => {
    expect(avaliarDigitacao("ko", "コーヒー")).toBe("incompleto");
    expect(avaliarDigitacao("koohii", "コーヒー")).toBe("acertou");
    // こひ não é começo de こおひい: reprova sem esperar.
    expect(avaliarDigitacao("kohi", "コーヒー")).toBe("errou");
  });

  it("não reprova no meio de uma sílaba", () => {
    // "gakk" ainda é caminho para がっこう, mesmo com o k solto no fim.
    expect(avaliarDigitacao("gakk", "がっこう")).toBe("incompleto");
    expect(avaliarDigitacao("gakkou", "がっこう")).toBe("acertou");
  });
});

describe("kanaParcial — eco enquanto digita", () => {
  it("converte o que já fecha e mantém o resto cru", () => {
    expect(kanaParcial("sak")).toBe("さk");
    expect(kanaParcial("sakur")).toBe("さくr");
  });

  it("converte tudo quando a palavra fecha", () => {
    expect(kanaParcial("sakura")).toBe("さくら");
    expect(kanaParcial("gakkou")).toBe("がっこう");
  });

  it("não quebra com entrada vazia", () => {
    expect(kanaParcial("")).toBe("");
  });
});

describe("kanaParaRomaji", () => {
  it.each([
    ["さくら", "sakura"],
    ["がっこう", "gakkou"],
    ["しゃしん", "shashin"],
    ["にほん", "nihon"],
    ["きって", "kitte"],
  ])("%s → %s", (kana, esperado) => {
    expect(kanaParaRomaji(kana)).toBe(esperado);
  });

  it("expande o prolongador do katakana", () => {
    expect(kanaParaRomaji("コーヒー")).toBe("koohii");
  });
});

describe("ida e volta", () => {
  // Invariante que vale por dezenas de casos: o romaji gerado a partir de uma
  // leitura precisa ser aceito de volta como resposta correta dela.
  it.each([
    "さくら", "がっこう", "しゃしん", "にほん", "きって", "つづく",
    "でんわ", "りょうり", "せんせい", "コーヒー", "テレビ", "ぱん",
  ])("%s sobrevive a kana → romaji → kana", (leitura) => {
    const romaji = kanaParaRomaji(leitura);
    expect(verificarResposta(romaji, leitura).acertou).toBe(true);
  });
});
