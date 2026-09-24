/**
 * Vocabulário em kana — palavras reais, não sílabas soltas.
 *
 * A ordem importa: é nela que as palavras são introduzidas, e o primeiro lote
 * de estudo são as primeiras da lista. Por isso nenhuma palavra traz mais de
 * três caracteres inéditos de uma vez (há um teste para isso) — assim o começo
 * é aprendível em vez de ser um despejo de silabário.
 *
 * Tudo aqui é escrito só em kana, sem kanji: no modo de digitação o exercício
 * é ler o silabário, e um kanji na frente mudaria o que está sendo treinado.
 */

export interface PalavraKana {
  /** A palavra como aparece na tela — e também a resposta esperada. */
  palavra: string;
  /** Significado em português. */
  meaning: string;
  script: "hiragana" | "katakana";
  /**
   * Frase curta em vez de palavra isolada. Reservado para o que só existe
   * dentro de uma frase, como a partícula を.
   */
  expressao?: boolean;
}

const HIRAGANA: PalavraKana[] = [
  // Começo: vogais e a linha か, com palavras de dois caracteres.
  { palavra: "あい", meaning: "amor", script: "hiragana" },
  { palavra: "いえ", meaning: "casa", script: "hiragana" },
  { palavra: "うえ", meaning: "em cima", script: "hiragana" },
  { palavra: "あお", meaning: "azul", script: "hiragana" },
  { palavra: "かお", meaning: "rosto", script: "hiragana" },
  { palavra: "あき", meaning: "outono", script: "hiragana" },
  { palavra: "きく", meaning: "ouvir, perguntar", script: "hiragana" },
  { palavra: "いけ", meaning: "lago, tanque", script: "hiragana" },
  { palavra: "こえ", meaning: "voz", script: "hiragana" },
  { palavra: "あさ", meaning: "manhã", script: "hiragana" },

  // Linha さ / た
  { palavra: "しお", meaning: "sal", script: "hiragana" },
  { palavra: "すいか", meaning: "melancia", script: "hiragana" },
  { palavra: "せかい", meaning: "mundo", script: "hiragana" },
  { palavra: "そら", meaning: "céu", script: "hiragana" },
  { palavra: "うた", meaning: "canção", script: "hiragana" },
  { palavra: "くち", meaning: "boca", script: "hiragana" },
  { palavra: "つくえ", meaning: "mesa, escrivaninha", script: "hiragana" },
  { palavra: "て", meaning: "mão", script: "hiragana" },
  { palavra: "とけい", meaning: "relógio", script: "hiragana" },
  { palavra: "たいこ", meaning: "tambor", script: "hiragana" },

  // Linha な / は
  { palavra: "なつ", meaning: "verão", script: "hiragana" },
  { palavra: "にく", meaning: "carne", script: "hiragana" },
  { palavra: "いぬ", meaning: "cachorro", script: "hiragana" },
  { palavra: "ねこ", meaning: "gato", script: "hiragana" },
  { palavra: "のり", meaning: "alga marinha", script: "hiragana" },
  { palavra: "はな", meaning: "flor; nariz", script: "hiragana" },
  { palavra: "ひと", meaning: "pessoa", script: "hiragana" },
  { palavra: "ふね", meaning: "barco, navio", script: "hiragana" },
  { palavra: "へや", meaning: "quarto", script: "hiragana" },
  { palavra: "ほし", meaning: "estrela", script: "hiragana" },

  // Linha ま / や / ら / わ
  { palavra: "まち", meaning: "cidade, bairro", script: "hiragana" },
  { palavra: "みみ", meaning: "orelha", script: "hiragana" },
  { palavra: "むし", meaning: "inseto", script: "hiragana" },
  { palavra: "め", meaning: "olho", script: "hiragana" },
  { palavra: "もり", meaning: "floresta", script: "hiragana" },
  { palavra: "やま", meaning: "montanha", script: "hiragana" },
  { palavra: "ゆき", meaning: "neve", script: "hiragana" },
  { palavra: "よる", meaning: "noite", script: "hiragana" },
  { palavra: "さくら", meaning: "flor de cerejeira", script: "hiragana" },
  { palavra: "とり", meaning: "pássaro", script: "hiragana" },
  { palavra: "くるま", meaning: "carro", script: "hiragana" },
  { palavra: "これ", meaning: "isto", script: "hiragana" },
  { palavra: "ろく", meaning: "seis", script: "hiragana" },
  { palavra: "わたし", meaning: "eu", script: "hiragana" },
  { palavra: "ほん", meaning: "livro", script: "hiragana" },
  { palavra: "ぬの", meaning: "tecido, pano", script: "hiragana" },
  { palavra: "けむり", meaning: "fumaça", script: "hiragana" },
  { palavra: "れきし", meaning: "história", script: "hiragana" },
  { palavra: "るす", meaning: "ausência (estar fora de casa)", script: "hiragana" },
  { palavra: "えき", meaning: "estação (de trem)", script: "hiragana" },

  // Partícula を — só existe dentro de frase.
  { palavra: "みずをのむ", meaning: "beber água", script: "hiragana", expressao: true },

  // Dakuten: linha が / ざ / だ
  { palavra: "かがみ", meaning: "espelho", script: "hiragana" },
  { palavra: "かぎ", meaning: "chave", script: "hiragana" },
  { palavra: "かぐ", meaning: "móveis", script: "hiragana" },
  { palavra: "げんき", meaning: "saúde, disposição", script: "hiragana" },
  { palavra: "ごはん", meaning: "arroz cozido; refeição", script: "hiragana" },
  { palavra: "ざっし", meaning: "revista", script: "hiragana" },
  { palavra: "じかん", meaning: "tempo, hora", script: "hiragana" },
  { palavra: "みず", meaning: "água", script: "hiragana" },
  { palavra: "ぜんぶ", meaning: "tudo", script: "hiragana" },
  { palavra: "ぞう", meaning: "elefante", script: "hiragana" },
  { palavra: "だいがく", meaning: "universidade", script: "hiragana" },
  { palavra: "でんわ", meaning: "telefone", script: "hiragana" },
  { palavra: "どこ", meaning: "onde", script: "hiragana" },

  // ぢ e づ: raros, mas existem em palavras correntes.
  { palavra: "はなぢ", meaning: "sangramento nasal", script: "hiragana" },
  { palavra: "ちぢむ", meaning: "encolher", script: "hiragana" },
  { palavra: "つづく", meaning: "continuar", script: "hiragana" },
  { palavra: "みかづき", meaning: "lua crescente", script: "hiragana" },

  // Dakuten: linha ば
  { palavra: "たばこ", meaning: "cigarro", script: "hiragana" },
  { palavra: "びょういん", meaning: "hospital", script: "hiragana" },
  { palavra: "ぶた", meaning: "porco", script: "hiragana" },
  { palavra: "べんきょう", meaning: "estudo", script: "hiragana" },
  { palavra: "ぼうし", meaning: "chapéu", script: "hiragana" },

  // Handakuten: linha ぱ — quase sempre depois de っ ou ん.
  { palavra: "いっぱい", meaning: "cheio; bastante", script: "hiragana" },
  { palavra: "えんぴつ", meaning: "lápis", script: "hiragana" },
  { palavra: "きっぷ", meaning: "bilhete, passagem", script: "hiragana" },
  { palavra: "ぺらぺら", meaning: "fluente (ao falar)", script: "hiragana" },
  { palavra: "さんぽ", meaning: "passeio, caminhada", script: "hiragana" },

  // Sokuon e dígrafos
  { palavra: "きって", meaning: "selo postal", script: "hiragana" },
  { palavra: "がっこう", meaning: "escola", script: "hiragana" },
  { palavra: "きょう", meaning: "hoje", script: "hiragana" },
  { palavra: "しゃしん", meaning: "fotografia", script: "hiragana" },
  { palavra: "でんしゃ", meaning: "trem", script: "hiragana" },
  { palavra: "りょうり", meaning: "culinária, prato", script: "hiragana" },
  { palavra: "びょうき", meaning: "doença", script: "hiragana" },
  { palavra: "おちゃ", meaning: "chá", script: "hiragana" },
  { palavra: "ぎゅうにゅう", meaning: "leite (de vaca)", script: "hiragana" },
  { palavra: "としょかん", meaning: "biblioteca", script: "hiragana" },
];

const KATAKANA: PalavraKana[] = [
  // Empréstimos curtos primeiro.
  { palavra: "パン", meaning: "pão", script: "katakana" },
  { palavra: "ペン", meaning: "caneta", script: "katakana" },
  { palavra: "バス", meaning: "ônibus", script: "katakana" },
  { palavra: "ガス", meaning: "gás", script: "katakana" },
  { palavra: "ドア", meaning: "porta", script: "katakana" },
  { palavra: "ビル", meaning: "prédio", script: "katakana" },
  { palavra: "キロ", meaning: "quilo", script: "katakana" },
  { palavra: "ゼロ", meaning: "zero", script: "katakana" },
  { palavra: "ピザ", meaning: "pizza", script: "katakana" },
  { palavra: "ワイン", meaning: "vinho", script: "katakana" },

  // Com prolongador — o ー é essencial em katakana.
  { palavra: "コーヒー", meaning: "café", script: "katakana" },
  { palavra: "ケーキ", meaning: "bolo", script: "katakana" },
  { palavra: "スープ", meaning: "sopa", script: "katakana" },
  { palavra: "ノート", meaning: "caderno", script: "katakana" },
  { palavra: "テレビ", meaning: "televisão", script: "katakana" },
  { palavra: "ラジオ", meaning: "rádio", script: "katakana" },
  { palavra: "タクシー", meaning: "táxi", script: "katakana" },
  { palavra: "カメラ", meaning: "câmera", script: "katakana" },
  { palavra: "ホテル", meaning: "hotel", script: "katakana" },
  { palavra: "トイレ", meaning: "banheiro", script: "katakana" },

  { palavra: "ミルク", meaning: "leite", script: "katakana" },
  { palavra: "チーズ", meaning: "queijo", script: "katakana" },
  { palavra: "ナイフ", meaning: "faca", script: "katakana" },
  { palavra: "フォーク", meaning: "garfo", script: "katakana" },
  { palavra: "シャツ", meaning: "camisa", script: "katakana" },
  { palavra: "ズボン", meaning: "calça", script: "katakana" },
  { palavra: "ボタン", meaning: "botão", script: "katakana" },
  { palavra: "ベッド", meaning: "cama", script: "katakana" },
  { palavra: "ソファ", meaning: "sofá", script: "katakana" },
  { palavra: "プール", meaning: "piscina", script: "katakana" },

  { palavra: "ギター", meaning: "violão, guitarra", script: "katakana" },
  { palavra: "ピアノ", meaning: "piano", script: "katakana" },
  { palavra: "ゲーム", meaning: "jogo", script: "katakana" },
  { palavra: "ゴルフ", meaning: "golfe", script: "katakana" },
  { palavra: "サッカー", meaning: "futebol", script: "katakana" },
  { palavra: "ダンス", meaning: "dança", script: "katakana" },
  { palavra: "クラス", meaning: "classe, turma", script: "katakana" },
  { palavra: "グラス", meaning: "copo", script: "katakana" },
  { palavra: "ブラシ", meaning: "escova", script: "katakana" },
  { palavra: "マッチ", meaning: "fósforo", script: "katakana" },

  { palavra: "オレンジ", meaning: "laranja", script: "katakana" },
  { palavra: "ジュース", meaning: "suco", script: "katakana" },
  { palavra: "アイス", meaning: "sorvete, gelo", script: "katakana" },
  { palavra: "インク", meaning: "tinta", script: "katakana" },
  { palavra: "エアコン", meaning: "ar-condicionado", script: "katakana" },
  { palavra: "ネクタイ", meaning: "gravata", script: "katakana" },
  { palavra: "ハンカチ", meaning: "lenço", script: "katakana" },
  { palavra: "メニュー", meaning: "cardápio", script: "katakana" },
  { palavra: "モデル", meaning: "modelo", script: "katakana" },
  { palavra: "レストラン", meaning: "restaurante", script: "katakana" },

  { palavra: "ロボット", meaning: "robô", script: "katakana" },
  { palavra: "リボン", meaning: "fita, laço", script: "katakana" },
  { palavra: "ルール", meaning: "regra", script: "katakana" },
  { palavra: "ニュース", meaning: "notícias", script: "katakana" },
  { palavra: "ヌードル", meaning: "macarrão", script: "katakana" },
  { palavra: "ヨーグルト", meaning: "iogurte", script: "katakana" },
  { palavra: "ユーモア", meaning: "humor", script: "katakana" },
  { palavra: "タイヤ", meaning: "pneu", script: "katakana" },
  { palavra: "セーター", meaning: "suéter", script: "katakana" },
  { palavra: "ソース", meaning: "molho", script: "katakana" },

  { palavra: "デパート", meaning: "loja de departamentos", script: "katakana" },
  { palavra: "ポスト", meaning: "caixa de correio", script: "katakana" },
  { palavra: "ヘリコプター", meaning: "helicóptero", script: "katakana" },
  { palavra: "ホーム", meaning: "plataforma (de estação)", script: "katakana" },
  { palavra: "ツアー", meaning: "excursão", script: "katakana" },
  { palavra: "ウイスキー", meaning: "uísque", script: "katakana" },
  { palavra: "エレベーター", meaning: "elevador", script: "katakana" },
  { palavra: "アメリカ", meaning: "Estados Unidos", script: "katakana" },
  { palavra: "イタリア", meaning: "Itália", script: "katakana" },
  { palavra: "メモ", meaning: "anotação", script: "katakana" },
  { palavra: "リゾート", meaning: "resort, estância", script: "katakana" },
];

export const PALAVRAS_KANA: PalavraKana[] = [...HIRAGANA, ...KATAKANA];
