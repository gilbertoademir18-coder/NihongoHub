import {
  PROLONGADOR,
  SEPARADOR_LEITURAS,
  colapsarAmbiguos,
  expandirProlongador,
  paraHiragana,
  soTemKana,
} from "./kana";

/**
 * Transliteração de romaji Hepburn e veredito de resposta digitada.
 *
 * A direção importa: convertemos o **romaji digitado em kana** e comparamos
 * kana com kana. O caminho inverso (gerar o romaji esperado e comparar texto)
 * não fecha, porque uma mesma leitura tem várias grafias defensáveis e o
 * conjunto de respostas válidas cresce por multiplicação a cada sílaba.
 *
 * Nesta direção, Hepburn estrito sai de graça: a tabela simplesmente não tem
 * `si`, `ti`, `tu`, `hu` nem `zi`, então eles não tokenizam e viram erro. Sem
 * precisar de nenhuma regra de rejeição.
 *
 * Funções puras, sem I/O.
 */

/**
 * Tabela Hepburn. Sem as formas Kunrei (si/ti/tu/hu/zi/sya) de propósito —
 * a escolha foi ensinar a romanização que aparece em material didático.
 */
const HEPBURN: Record<string, string> = {
  // vogais
  a: "あ", i: "い", u: "う", e: "え", o: "お",
  // k / g
  ka: "か", ki: "き", ku: "く", ke: "け", ko: "こ",
  ga: "が", gi: "ぎ", gu: "ぐ", ge: "げ", go: "ご",
  kya: "きゃ", kyu: "きゅ", kyo: "きょ",
  gya: "ぎゃ", gyu: "ぎゅ", gyo: "ぎょ",
  // s / z
  sa: "さ", shi: "し", su: "す", se: "せ", so: "そ",
  za: "ざ", ji: "じ", zu: "ず", ze: "ぜ", zo: "ぞ",
  sha: "しゃ", shu: "しゅ", sho: "しょ",
  ja: "じゃ", ju: "じゅ", jo: "じょ",
  // t / d
  ta: "た", chi: "ち", tsu: "つ", te: "て", to: "と",
  da: "だ", de: "で", do: "ど",
  cha: "ちゃ", chu: "ちゅ", cho: "ちょ",
  // n
  na: "な", ni: "に", nu: "ぬ", ne: "ね", no: "の",
  nya: "にゃ", nyu: "にゅ", nyo: "にょ",
  // h / b / p
  ha: "は", hi: "ひ", fu: "ふ", he: "へ", ho: "ほ",
  ba: "ば", bi: "び", bu: "ぶ", be: "べ", bo: "ぼ",
  pa: "ぱ", pi: "ぴ", pu: "ぷ", pe: "ぺ", po: "ぽ",
  hya: "ひゃ", hyu: "ひゅ", hyo: "ひょ",
  bya: "びゃ", byu: "びゅ", byo: "びょ",
  pya: "ぴゃ", pyu: "ぴゅ", pyo: "ぴょ",
  // m
  ma: "ま", mi: "み", mu: "む", me: "め", mo: "も",
  mya: "みゃ", myu: "みゅ", myo: "みょ",
  // y / r / w
  ya: "や", yu: "ゆ", yo: "よ",
  ra: "ら", ri: "り", ru: "る", re: "れ", ro: "ろ",
  rya: "りゃ", ryu: "りゅ", ryo: "りょ",
  wa: "わ", wo: "を",
};

/** Macrons e circunflexos: `kōhī` é a mesma coisa que `koohii`. */
const VOGAIS_LONGAS: Record<string, string> = {
  ā: "aa", ī: "ii", ū: "uu", ē: "ee", ō: "oo",
  â: "aa", î: "ii", û: "uu", ê: "ee", ô: "oo",
};

const VOGAIS = new Set(["a", "i", "u", "e", "o"]);

/** Normaliza a digitação antes de tokenizar. */
function prepararEntrada(entrada: string): string {
  return entrada
    // Largura total (ｋ) vira ASCII — teclado japonês produz isso.
    .normalize("NFKC")
    .toLowerCase()
    .trim()
    .replace(/[\s]+/g, "")
    .replace(/[āīūēōâîûêô]/g, (c) => VOGAIS_LONGAS[c] ?? c)
    // O apóstrofo tipográfico do teclado do celular vale como o reto de `kan'i`.
    .replace(/[’`´]/g, "'");
}

/**
 * Converte romaji Hepburn em hiragana.
 *
 * Devolve `null` se algum trecho não for Hepburn válido — é assim que `si`,
 * `tu` e erros de digitação são rejeitados, sem lista de exceções.
 *
 * Se a entrada já vier em kana (IME ligado), passa direto.
 */
export function romajiParaKana(entrada: string): string | null {
  const texto = prepararEntrada(entrada);
  if (texto.length === 0) return null;
  if (soTemKana(texto)) return paraHiragana(texto);

  let resultado = "";
  let i = 0;

  while (i < texto.length) {
    const atual = texto[i];
    const proximo = texto[i + 1];

    // ん: quando o "n" não consegue formar sílaba com o que vem depois.
    // "kanji" → かんじ, mas "kani" → かに. O apóstrofo força: "kan'i" → かんい.
    if (atual === "n") {
      if (proximo === "'") {
        resultado += "ん";
        i += 2;
        continue;
      }
      const formaSilaba = proximo !== undefined && (VOGAIS.has(proximo) || proximo === "y");
      if (!formaSilaba) {
        resultado += "ん";
        i += 1;
        continue;
      }
    }

    // Sokuon: consoante dobrada vira っ. "gakkou" → がっこう, "kitte" → きって.
    if (proximo === atual && !VOGAIS.has(atual) && atual !== "n") {
      resultado += "っ";
      i += 1;
      continue;
    }

    // Hepburn escreve っち como "tch": "matcha" → まっちゃ.
    if (atual === "t" && texto.slice(i + 1, i + 3) === "ch") {
      resultado += "っ";
      i += 1;
      continue;
    }

    let casou = false;
    for (const tamanho of [3, 2, 1]) {
      const pedaco = texto.slice(i, i + tamanho);
      if (pedaco.length === tamanho && HEPBURN[pedaco]) {
        resultado += HEPBURN[pedaco];
        i += tamanho;
        casou = true;
        break;
      }
    }

    // Nada casou: a entrada não é Hepburn válido.
    if (!casou) return null;
  }

  return resultado;
}

/**
 * Versão tolerante, para o eco ao vivo abaixo do campo de digitação.
 *
 * Converte o que já fecha e mantém cru o que ainda está pela metade — quem
 * digitou "sak" vê さk e entende que falta terminar a sílaba.
 */
export function kanaParcial(entrada: string): string {
  const texto = prepararEntrada(entrada);

  // Converte o maior prefixo que fecha e deixa a sobra crua. Fatiar sílaba a
  // sílaba não serviria: o sokuon de "gakkou" só existe no contexto da
  // palavra inteira, e um "k" solto nunca converteria.
  for (let fim = texto.length; fim > 0; fim--) {
    const kana = romajiParaKana(texto.slice(0, fim));
    if (kana) return kana + texto.slice(fim);
  }

  return texto;
}

/**
 * Forma canônica para comparar duas leituras.
 *
 * Reúne as três normalizações que separam "a mesma resposta escrita de outro
 * jeito" de "resposta errada": katakana vira hiragana, o prolongador vira a
 * vogal que ele repete, e os pares que o Hepburn não distingue se fundem.
 */
export function chaveComparacao(kana: string): string {
  return colapsarAmbiguos(expandirProlongador(kana));
}

/**
 * As leituras que valem como resposta para um card.
 *
 * Metade dos cards de kanji tem alternativas separadas por `・` — 日 aceita
 * tanto "nichi" quanto "hi". Sem isso o modo digitação seria injusto com eles.
 */
export function leiturasAceitas(reading: string): string[] {
  return reading
    .split(SEPARADOR_LEITURAS)
    .map((parte) => parte.trim())
    .filter((parte) => parte.length > 0);
}

export interface Veredito {
  acertou: boolean;
  /** O kana que a digitação produziu; `null` quando não é Hepburn válido. */
  kana: string | null;
  /** A leitura que bateu — ou a primeira alternativa, quando errou. */
  leituraEsperada: string;
}

/** Confere uma resposta digitada contra a leitura do card. */
export function verificarResposta(digitado: string, reading: string): Veredito {
  const alternativas = leiturasAceitas(reading);
  const kana = romajiParaKana(digitado);

  if (kana === null) {
    return { acertou: false, kana: null, leituraEsperada: alternativas[0] ?? reading };
  }

  const chaveDigitada = chaveComparacao(kana);
  const acertada = alternativas.find(
    (alternativa) => chaveComparacao(alternativa) === chaveDigitada,
  );

  return {
    acertou: acertada !== undefined,
    kana,
    leituraEsperada: acertada ?? alternativas[0] ?? reading,
  };
}

/**
 * Kana que só existem nesta direção.
 *
 * `づ` e `ぢ` não cabem na tabela Hepburn: as chaves "zu" e "ji" pertencem a
 * `ず` e `じ`. Mas ao mostrar a resposta esperada eles precisam de romaji — e
 * o romaji Hepburn deles é justamente "zu" e "ji".
 */
const SO_NA_VOLTA: Record<string, string> = {
  づ: "zu",
  ぢ: "ji",
};

/** Mapa inverso, montado uma vez, com os dígrafos antes das sílabas simples. */
const KANA_PARA_ROMAJI: [string, string][] = [
  ...Object.entries(HEPBURN).map(([romaji, kana]) => [kana, romaji] as [string, string]),
  ...Object.entries(SO_NA_VOLTA),
].sort((a, b) => b[0].length - a[0].length);

/**
 * Converte kana em romaji Hepburn — usado para mostrar a resposta esperada.
 *
 * Não é o inverso exato de `romajiParaKana`: づ e ず saem ambos como "zu",
 * exatamente como o Hepburn faz.
 */
export function kanaParaRomaji(kana: string): string {
  const texto = expandirProlongador(kana);
  let resultado = "";
  let i = 0;

  while (i < texto.length) {
    const atual = texto[i];

    // っ dobra a consoante da sílaba seguinte.
    if (atual === "っ") {
      const proximaSilaba = KANA_PARA_ROMAJI.find(([k]) => texto.startsWith(k, i + 1));
      if (proximaSilaba) {
        resultado += proximaSilaba[1][0];
        i += 1;
        continue;
      }
    }

    if (atual === "ん") {
      resultado += "n";
      i += 1;
      continue;
    }

    const encontrado = KANA_PARA_ROMAJI.find(([k]) => texto.startsWith(k, i));
    if (encontrado) {
      resultado += encontrado[1];
      i += encontrado[0].length;
      continue;
    }

    resultado += atual;
    i += 1;
  }

  return resultado;
}

export { PROLONGADOR };
