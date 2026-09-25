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
  /**
   * Termo usado para procurar a imagem ilustrativa.
   *
   * Em japonês onde a imagem japonesa **é** a representação certa: `ごはん`
   * devolve uma tigela de arroz, enquanto "rice" devolve um saco de grãos;
   * `日本 駅` devolve uma estação japonesa, e não a Grand Central.
   *
   * Em inglês onde o kana é ambíguo demais para buscar. Palavras de duas
   * moras colidem com nomes próprios — medido: `あお` devolve fotos da atriz
   * Miyazaki Aoi, `うえ` devolve o parque de Ueno, `いけ` devolve uma
   * ilustradora chamada Ike. Nesses casos o significado é o único termo que
   * identifica o conceito.
   *
   * **Ausente é uma decisão, não uma pendência**: `ぜんぶ` (tudo), `どこ`
   * (onde) e `つづく` (continuar) não têm imagem possível, e inventar uma
   * ensinaria a associação errada — que num SRS é o pior defeito possível,
   * porque a repetição a fixa.
   */
  busca?: string;
}

const HIRAGANA: PalavraKana[] = [
  // Começo: vogais e a linha か, com palavras de dois caracteres.
  { palavra: "あい", meaning: "amor", script: "hiragana" },
  { palavra: "いえ", meaning: "casa", busca: "日本家屋", script: "hiragana" },
  { palavra: "うえ", meaning: "em cima", script: "hiragana" },
  { palavra: "あお", meaning: "azul", busca: "blue", script: "hiragana" },
  { palavra: "かお", meaning: "rosto", busca: "human face", script: "hiragana" },
  { palavra: "あき", meaning: "outono", busca: "紅葉", script: "hiragana" },
  { palavra: "きく", meaning: "ouvir, perguntar", script: "hiragana" },
  { palavra: "いけ", meaning: "lago, tanque", busca: "pond", script: "hiragana" },
  { palavra: "こえ", meaning: "voz", script: "hiragana" },
  { palavra: "あさ", meaning: "manhã", busca: "morning sunrise", script: "hiragana" },

  // Linha さ / た
  { palavra: "しお", meaning: "sal", busca: "salt", script: "hiragana" },
  { palavra: "すいか", meaning: "melancia", busca: "watermelon", script: "hiragana" },
  { palavra: "せかい", meaning: "mundo", busca: "planet earth", script: "hiragana" },
  { palavra: "そら", meaning: "céu", busca: "sky", script: "hiragana" },
  { palavra: "うた", meaning: "canção", busca: "singing", script: "hiragana" },
  { palavra: "くち", meaning: "boca", busca: "mouth", script: "hiragana" },
  { palavra: "つくえ", meaning: "mesa, escrivaninha", busca: "desk", script: "hiragana" },
  { palavra: "て", meaning: "mão", busca: "hand fingers palm", script: "hiragana" },
  { palavra: "とけい", meaning: "relógio", busca: "clock", script: "hiragana" },
  { palavra: "たいこ", meaning: "tambor", busca: "太鼓", script: "hiragana" },

  // Linha な / は
  { palavra: "なつ", meaning: "verão", busca: "summer beach", script: "hiragana" },
  { palavra: "にく", meaning: "carne", busca: "meat", script: "hiragana" },
  { palavra: "いぬ", meaning: "cachorro", busca: "dog", script: "hiragana" },
  { palavra: "ねこ", meaning: "gato", busca: "domestic cat", script: "hiragana" },
  { palavra: "のり", meaning: "alga marinha", busca: "海苔", script: "hiragana" },
  { palavra: "はな", meaning: "flor; nariz", busca: "flower", script: "hiragana" },
  { palavra: "ひと", meaning: "pessoa", busca: "person", script: "hiragana" },
  { palavra: "ふね", meaning: "barco, navio", busca: "boat", script: "hiragana" },
  { palavra: "へや", meaning: "quarto", busca: "bedroom", script: "hiragana" },
  { palavra: "ほし", meaning: "estrela", busca: "stars night sky", script: "hiragana" },

  // Linha ま / や / ら / わ
  { palavra: "まち", meaning: "cidade, bairro", busca: "日本 商店街", script: "hiragana" },
  { palavra: "みみ", meaning: "orelha", busca: "ear anatomy", script: "hiragana" },
  { palavra: "むし", meaning: "inseto", busca: "insect", script: "hiragana" },
  { palavra: "め", meaning: "olho", busca: "human eye", script: "hiragana" },
  { palavra: "もり", meaning: "floresta", busca: "forest", script: "hiragana" },
  { palavra: "やま", meaning: "montanha", busca: "mountain", script: "hiragana" },
  { palavra: "ゆき", meaning: "neve", busca: "snow", script: "hiragana" },
  { palavra: "よる", meaning: "noite", busca: "night sky", script: "hiragana" },
  { palavra: "さくら", meaning: "flor de cerejeira", busca: "cherry blossom", script: "hiragana" },
  { palavra: "とり", meaning: "pássaro", busca: "bird", script: "hiragana" },
  { palavra: "くるま", meaning: "carro", busca: "car", script: "hiragana" },
  { palavra: "これ", meaning: "isto", script: "hiragana" },
  { palavra: "ろく", meaning: "seis", script: "hiragana" },
  { palavra: "わたし", meaning: "eu", script: "hiragana" },
  { palavra: "ほん", meaning: "livro", busca: "open book pages", script: "hiragana" },
  { palavra: "ぬの", meaning: "tecido, pano", busca: "fabric cloth", script: "hiragana" },
  { palavra: "けむり", meaning: "fumaça", busca: "smoke", script: "hiragana" },
  { palavra: "れきし", meaning: "história", script: "hiragana" },
  { palavra: "るす", meaning: "ausência (estar fora de casa)", script: "hiragana" },
  { palavra: "えき", meaning: "estação (de trem)", busca: "日本 駅", script: "hiragana" },

  // Partícula を — só existe dentro de frase.
  { palavra: "みずをのむ", meaning: "beber água", busca: "drinking water", script: "hiragana", expressao: true },

  // Dakuten: linha が / ざ / だ
  { palavra: "かがみ", meaning: "espelho", busca: "mirror", script: "hiragana" },
  { palavra: "かぎ", meaning: "chave", busca: "key", script: "hiragana" },
  { palavra: "かぐ", meaning: "móveis", busca: "furniture", script: "hiragana" },
  { palavra: "げんき", meaning: "saúde, disposição", script: "hiragana" },
  { palavra: "ごはん", meaning: "arroz cozido; refeição", busca: "ごはん 茶碗", script: "hiragana" },
  { palavra: "ざっし", meaning: "revista", busca: "magazine", script: "hiragana" },
  { palavra: "じかん", meaning: "tempo, hora", script: "hiragana" },
  { palavra: "みず", meaning: "água", busca: "water", script: "hiragana" },
  { palavra: "ぜんぶ", meaning: "tudo", script: "hiragana" },
  { palavra: "ぞう", meaning: "elefante", busca: "elephant", script: "hiragana" },
  { palavra: "だいがく", meaning: "universidade", busca: "university campus", script: "hiragana" },
  { palavra: "でんわ", meaning: "telefone", busca: "telephone", script: "hiragana" },
  { palavra: "どこ", meaning: "onde", script: "hiragana" },

  // ぢ e づ: raros, mas existem em palavras correntes.
  { palavra: "はなぢ", meaning: "sangramento nasal", busca: "nosebleed", script: "hiragana" },
  { palavra: "ちぢむ", meaning: "encolher", script: "hiragana" },
  { palavra: "つづく", meaning: "continuar", script: "hiragana" },
  { palavra: "みかづき", meaning: "lua crescente", busca: "crescent moon", script: "hiragana" },

  // Dakuten: linha ば
  { palavra: "たばこ", meaning: "cigarro", busca: "cigarette", script: "hiragana" },
  { palavra: "びょういん", meaning: "hospital", busca: "hospital", script: "hiragana" },
  { palavra: "ぶた", meaning: "porco", busca: "pig", script: "hiragana" },
  { palavra: "べんきょう", meaning: "estudo", busca: "studying student", script: "hiragana" },
  { palavra: "ぼうし", meaning: "chapéu", busca: "hat", script: "hiragana" },

  // Handakuten: linha ぱ — quase sempre depois de っ ou ん.
  { palavra: "いっぱい", meaning: "cheio; bastante", script: "hiragana" },
  { palavra: "えんぴつ", meaning: "lápis", busca: "pencil", script: "hiragana" },
  { palavra: "きっぷ", meaning: "bilhete, passagem", busca: "きっぷ 切符", script: "hiragana" },
  { palavra: "ぺらぺら", meaning: "fluente (ao falar)", script: "hiragana" },
  { palavra: "さんぽ", meaning: "passeio, caminhada", busca: "walking in the park", script: "hiragana" },

  // Sokuon e dígrafos
  { palavra: "きって", meaning: "selo postal", busca: "postage stamp", script: "hiragana" },
  { palavra: "がっこう", meaning: "escola", busca: "日本 小学校", script: "hiragana" },
  { palavra: "きょう", meaning: "hoje", script: "hiragana" },
  { palavra: "しゃしん", meaning: "fotografia", busca: "photograph", script: "hiragana" },
  { palavra: "でんしゃ", meaning: "trem", busca: "でんしゃ", script: "hiragana" },
  { palavra: "りょうり", meaning: "culinária, prato", busca: "日本料理", script: "hiragana" },
  { palavra: "びょうき", meaning: "doença", script: "hiragana" },
  { palavra: "おちゃ", meaning: "chá", busca: "おちゃ 日本茶", script: "hiragana" },
  { palavra: "ぎゅうにゅう", meaning: "leite (de vaca)", busca: "milk", script: "hiragana" },
  { palavra: "としょかん", meaning: "biblioteca", busca: "library", script: "hiragana" },
];

const KATAKANA: PalavraKana[] = [
  // Empréstimos curtos primeiro.
  { palavra: "パン", meaning: "pão", busca: "bread", script: "katakana" },
  { palavra: "ペン", meaning: "caneta", busca: "ballpoint pen", script: "katakana" },
  { palavra: "バス", meaning: "ônibus", busca: "bus", script: "katakana" },
  { palavra: "ガス", meaning: "gás", script: "katakana" },
  { palavra: "ドア", meaning: "porta", busca: "door", script: "katakana" },
  { palavra: "ビル", meaning: "prédio", busca: "office building", script: "katakana" },
  { palavra: "キロ", meaning: "quilo", script: "katakana" },
  { palavra: "ゼロ", meaning: "zero", script: "katakana" },
  { palavra: "ピザ", meaning: "pizza", busca: "pizza", script: "katakana" },
  { palavra: "ワイン", meaning: "vinho", busca: "glass of red wine", script: "katakana" },

  // Com prolongador — o ー é essencial em katakana.
  { palavra: "コーヒー", meaning: "café", busca: "coffee cup", script: "katakana" },
  { palavra: "ケーキ", meaning: "bolo", busca: "cake", script: "katakana" },
  { palavra: "スープ", meaning: "sopa", busca: "soup", script: "katakana" },
  { palavra: "ノート", meaning: "caderno", busca: "notebook", script: "katakana" },
  { palavra: "テレビ", meaning: "televisão", busca: "television", script: "katakana" },
  { palavra: "ラジオ", meaning: "rádio", busca: "radio", script: "katakana" },
  { palavra: "タクシー", meaning: "táxi", busca: "taxi", script: "katakana" },
  { palavra: "カメラ", meaning: "câmera", busca: "camera", script: "katakana" },
  { palavra: "ホテル", meaning: "hotel", busca: "hotel", script: "katakana" },
  { palavra: "トイレ", meaning: "banheiro", busca: "toilet", script: "katakana" },

  { palavra: "ミルク", meaning: "leite", busca: "glass of milk", script: "katakana" },
  { palavra: "チーズ", meaning: "queijo", busca: "cheese wheel", script: "katakana" },
  { palavra: "ナイフ", meaning: "faca", busca: "knife", script: "katakana" },
  { palavra: "フォーク", meaning: "garfo", busca: "fork", script: "katakana" },
  { palavra: "シャツ", meaning: "camisa", busca: "shirt", script: "katakana" },
  { palavra: "ズボン", meaning: "calça", busca: "trousers", script: "katakana" },
  { palavra: "ボタン", meaning: "botão", busca: "button", script: "katakana" },
  { palavra: "ベッド", meaning: "cama", busca: "bed", script: "katakana" },
  { palavra: "ソファ", meaning: "sofá", busca: "sofa", script: "katakana" },
  { palavra: "プール", meaning: "piscina", busca: "swimming pool", script: "katakana" },

  { palavra: "ギター", meaning: "violão, guitarra", busca: "guitar", script: "katakana" },
  { palavra: "ピアノ", meaning: "piano", busca: "piano", script: "katakana" },
  { palavra: "ゲーム", meaning: "jogo", busca: "video game", script: "katakana" },
  { palavra: "ゴルフ", meaning: "golfe", busca: "golf", script: "katakana" },
  { palavra: "サッカー", meaning: "futebol", busca: "football soccer", script: "katakana" },
  { palavra: "ダンス", meaning: "dança", busca: "dancing", script: "katakana" },
  { palavra: "クラス", meaning: "classe, turma", busca: "classroom", script: "katakana" },
  { palavra: "グラス", meaning: "copo", busca: "drinking glass", script: "katakana" },
  { palavra: "ブラシ", meaning: "escova", busca: "hairbrush", script: "katakana" },
  { palavra: "マッチ", meaning: "fósforo", busca: "matchstick", script: "katakana" },

  { palavra: "オレンジ", meaning: "laranja", busca: "orange fruit", script: "katakana" },
  { palavra: "ジュース", meaning: "suco", busca: "juice", script: "katakana" },
  { palavra: "アイス", meaning: "sorvete, gelo", busca: "ice cream", script: "katakana" },
  { palavra: "インク", meaning: "tinta", busca: "ink", script: "katakana" },
  { palavra: "エアコン", meaning: "ar-condicionado", busca: "air conditioner", script: "katakana" },
  { palavra: "ネクタイ", meaning: "gravata", busca: "necktie", script: "katakana" },
  { palavra: "ハンカチ", meaning: "lenço", busca: "handkerchief", script: "katakana" },
  { palavra: "メニュー", meaning: "cardápio", busca: "restaurant menu", script: "katakana" },
  { palavra: "モデル", meaning: "modelo", script: "katakana" },
  { palavra: "レストラン", meaning: "restaurante", busca: "restaurant", script: "katakana" },

  { palavra: "ロボット", meaning: "robô", busca: "robot", script: "katakana" },
  { palavra: "リボン", meaning: "fita, laço", busca: "gift ribbon bow", script: "katakana" },
  { palavra: "ルール", meaning: "regra", script: "katakana" },
  { palavra: "ニュース", meaning: "notícias", busca: "newspaper", script: "katakana" },
  { palavra: "ヌードル", meaning: "macarrão", busca: "noodles", script: "katakana" },
  { palavra: "ヨーグルト", meaning: "iogurte", busca: "yogurt", script: "katakana" },
  { palavra: "ユーモア", meaning: "humor", script: "katakana" },
  { palavra: "タイヤ", meaning: "pneu", busca: "car tire wheel", script: "katakana" },
  { palavra: "セーター", meaning: "suéter", busca: "sweater", script: "katakana" },
  { palavra: "ソース", meaning: "molho", busca: "condiment bottle", script: "katakana" },

  { palavra: "デパート", meaning: "loja de departamentos", busca: "department store", script: "katakana" },
  { palavra: "ポスト", meaning: "caixa de correio", busca: "日本 郵便ポスト", script: "katakana" },
  { palavra: "ヘリコプター", meaning: "helicóptero", busca: "helicopter", script: "katakana" },
  { palavra: "ホーム", meaning: "plataforma (de estação)", busca: "日本 駅 ホーム", script: "katakana" },
  { palavra: "ツアー", meaning: "excursão", script: "katakana" },
  { palavra: "ウイスキー", meaning: "uísque", busca: "whisky", script: "katakana" },
  { palavra: "エレベーター", meaning: "elevador", busca: "elevator interior", script: "katakana" },
  { palavra: "アメリカ", meaning: "Estados Unidos", busca: "united states flag", script: "katakana" },
  { palavra: "イタリア", meaning: "Itália", busca: "italy", script: "katakana" },
  { palavra: "メモ", meaning: "anotação", busca: "sticky note", script: "katakana" },
  { palavra: "リゾート", meaning: "resort, estância", busca: "beach resort", script: "katakana" },
];

export const PALAVRAS_KANA: PalavraKana[] = [...HIRAGANA, ...KATAKANA];
