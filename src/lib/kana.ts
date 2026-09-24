/**
 * Inventário e manipulação de kana.
 *
 * Funções puras, sem I/O — o mesmo espírito de `srs.ts`. Este módulo não
 * conhece romaji: ele só sabe o que é kana, como normalizá-lo e quais
 * caracteres existem. A transliteração mora em `romaji.ts`.
 */

const HIRAGANA_INICIO = 0x3041;
const HIRAGANA_FIM = 0x3096;
const KATAKANA_INICIO = 0x30a1;
const KATAKANA_FIM = 0x30f6;

/** Distância entre um hiragana e o katakana correspondente na tabela Unicode. */
const DISTANCIA_KATAKANA = 0x60;

/** Prolonga a vogal anterior. Só aparece em katakana: コーヒー. */
export const PROLONGADOR = "ー";

/** Separa leituras alternativas num mesmo card: 日 → "にち・ひ". */
export const SEPARADOR_LEITURAS = "・";

export function ehHiragana(caractere: string): boolean {
  const cp = caractere.codePointAt(0) ?? -1;
  return cp >= HIRAGANA_INICIO && cp <= HIRAGANA_FIM;
}

export function ehKatakana(caractere: string): boolean {
  const cp = caractere.codePointAt(0) ?? -1;
  return cp >= KATAKANA_INICIO && cp <= KATAKANA_FIM;
}

export function ehKana(caractere: string): boolean {
  return (
    ehHiragana(caractere) ||
    ehKatakana(caractere) ||
    caractere === PROLONGADOR
  );
}

/** Todo o texto é kana (ou prolongador)? Strings vazias não contam. */
export function soTemKana(texto: string): boolean {
  return texto.length > 0 && [...texto].every(ehKana);
}

/**
 * Converte katakana em hiragana, preservando o resto.
 *
 * É o primeiro passo para comparar respostas: para quem digita romaji, コーヒー
 * e こーひー são a mesma palavra.
 */
export function paraHiragana(texto: string): string {
  return [...texto]
    .map((c) =>
      ehKatakana(c) ? String.fromCodePoint(c.codePointAt(0)! - DISTANCIA_KATAKANA) : c,
    )
    .join("");
}

/** A vogal que cada hiragana carrega — usada para expandir o prolongador. */
const VOGAL_DE: Record<string, string> = {
  あ: "あ", か: "あ", さ: "あ", た: "あ", な: "あ", は: "あ", ま: "あ",
  や: "あ", ら: "あ", わ: "あ", が: "あ", ざ: "あ", だ: "あ", ば: "あ",
  ぱ: "あ", ゃ: "あ",
  い: "い", き: "い", し: "い", ち: "い", に: "い", ひ: "い", み: "い",
  り: "い", ぎ: "い", じ: "い", ぢ: "い", び: "い", ぴ: "い",
  う: "う", く: "う", す: "う", つ: "う", ぬ: "う", ふ: "う", む: "う",
  ゆ: "う", る: "う", ぐ: "う", ず: "う", づ: "う", ぶ: "う", ぷ: "う",
  ゅ: "う",
  え: "え", け: "え", せ: "え", て: "え", ね: "え", へ: "え", め: "え",
  れ: "え", げ: "え", ぜ: "え", で: "え", べ: "え", ぺ: "え",
  お: "お", こ: "お", そ: "お", と: "お", の: "お", ほ: "お", も: "お",
  よ: "お", ろ: "お", ご: "お", ぞ: "お", ど: "お", ぼ: "お", ぽ: "お",
  ょ: "お",
};

/**
 * Troca cada `ー` pela vogal que ele prolonga: コーヒー → こおひい.
 *
 * Sem isso, quem digita "koohii" nunca acertaria コーヒー — o prolongador não
 * tem romaji próprio, ele apenas repete o som anterior.
 */
export function expandirProlongador(kana: string): string {
  let resultado = "";
  for (const caractere of paraHiragana(kana)) {
    if (caractere === PROLONGADOR) {
      const anterior = resultado[resultado.length - 1];
      resultado += VOGAL_DE[anterior] ?? "";
    } else {
      resultado += caractere;
    }
  }
  return resultado;
}

/**
 * Pares que o Hepburn escreve igual: づ e ず são ambos "zu"; ぢ e じ, "ji".
 *
 * Como a resposta é digitada em romaji, é impossível distingui-los — "tsuzuku"
 * é a romanização correta de つづく. Colapsar os dois lados na comparação
 * evita marcar como erro uma resposta certa. Não há colisão real: つずく não é
 * palavra.
 */
export function colapsarAmbiguos(kana: string): string {
  return kana.replace(/づ/g, "ず").replace(/ぢ/g, "じ");
}

// --- Inventário para a meta de cobertura -----------------------------------

/** Os 46 sons básicos, na ordem da tabela gojūon. */
export const GOJUON = [
  "あ", "い", "う", "え", "お",
  "か", "き", "く", "け", "こ",
  "さ", "し", "す", "せ", "そ",
  "た", "ち", "つ", "て", "と",
  "な", "に", "ぬ", "ね", "の",
  "は", "ひ", "ふ", "へ", "ほ",
  "ま", "み", "む", "め", "も",
  "や", "ゆ", "よ",
  "ら", "り", "る", "れ", "ろ",
  "わ", "を", "ん",
] as const;

/** Sons com dakuten (゛) e handakuten (゜). */
export const DIACRITICOS = [
  "が", "ぎ", "ぐ", "げ", "ご",
  "ざ", "じ", "ず", "ぜ", "ぞ",
  "だ", "ぢ", "づ", "で", "ど",
  "ば", "び", "ぶ", "べ", "ぼ",
  "ぱ", "ぴ", "ぷ", "ぺ", "ぽ",
] as const;

/**
 * Kana que não ocorrem dentro de palavras do japonês moderno.
 *
 * Não é preguiça de curadoria — é a língua. Declarar a fronteira aqui, com o
 * motivo, é mais honesto do que prometer "todos os kana" e pular estes quatro
 * em silêncio.
 */
export const FORA_DE_META: Record<string, string> = {
  を: "só existe como partícula; entra no app dentro de uma frase, não como palavra",
  ゐ: "obsoleto no japonês moderno",
  ゑ: "obsoleto no japonês moderno",
};

/** Idem para katakana, onde o léxico de empréstimos é mais restrito. */
export const FORA_DE_META_KATAKANA: Record<string, string> = {
  ヲ: "não ocorre em empréstimos; a partícula se escreve em hiragana",
  ヂ: "empréstimos modernos usam ジ",
  ヅ: "empréstimos modernos usam ズ",
  ヰ: "obsoleto no japonês moderno",
  ヱ: "obsoleto no japonês moderno",
};

/** Todo kana pleno que o app espera ver coberto por alguma palavra. */
export function alvoDeCobertura(script: "hiragana" | "katakana"): string[] {
  const base = [...GOJUON, ...DIACRITICOS];
  const fora = script === "hiragana" ? FORA_DE_META : FORA_DE_META_KATAKANA;

  return base
    .map((c) =>
      script === "katakana"
        ? String.fromCodePoint(c.codePointAt(0)! + DISTANCIA_KATAKANA)
        : c,
    )
    .filter((c) => !(c in fora));
}

/**
 * Os caracteres que uma palavra "ensina".
 *
 * Ignora os kana pequenos (ゃゅょっ) porque eles não são sons independentes:
 * quem lê きょ já encontrou き e ょ juntos.
 */
export function caracteresDe(palavra: string): string[] {
  return [...paraHiragana(palavra)].filter(ehKana);
}
