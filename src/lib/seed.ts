import { type Card, type Deck, db } from "./db";
import { newCardState } from "./srs";

/**
 * Conteúdo inicial do app.
 *
 * Um SRS vazio é inútil no primeiro acesso — o usuário abre, não tem o que
 * revisar e vai embora. Estes dois decks dão o que estudar no minuto zero.
 */

interface SeedCard {
  front: string;
  reading: string;
  meaning: string;
  example?: string;
  exampleMeaning?: string;
  tags?: string[];
}

const KANJI_N5: SeedCard[] = [
  {
    front: "日",
    reading: "にち・ひ",
    meaning: "dia, sol",
    example: "今日はいい天気です。",
    exampleMeaning: "Hoje está um bom tempo.",
  },
  {
    front: "本",
    reading: "ほん",
    meaning: "livro, origem",
    example: "この本は面白いです。",
    exampleMeaning: "Este livro é interessante.",
  },
  {
    front: "人",
    reading: "ひと・じん",
    meaning: "pessoa",
    example: "あの人は先生です。",
    exampleMeaning: "Aquela pessoa é professora.",
  },
  {
    front: "水",
    reading: "みず",
    meaning: "água",
    example: "水を飲みます。",
    exampleMeaning: "Bebo água.",
  },
  {
    front: "火",
    reading: "ひ・か",
    meaning: "fogo",
    example: "火に気をつけてください。",
    exampleMeaning: "Tome cuidado com o fogo.",
  },
  {
    front: "木",
    reading: "き・もく",
    meaning: "árvore, madeira",
    example: "公園に木がたくさんあります。",
    exampleMeaning: "Há muitas árvores no parque.",
  },
  {
    front: "金",
    reading: "かね・きん",
    meaning: "dinheiro, ouro",
    example: "お金がありません。",
    exampleMeaning: "Não tenho dinheiro.",
  },
  {
    front: "山",
    reading: "やま・さん",
    meaning: "montanha",
    example: "山が高いです。",
    exampleMeaning: "A montanha é alta.",
  },
  {
    front: "川",
    reading: "かわ",
    meaning: "rio",
    example: "川で泳ぎます。",
    exampleMeaning: "Nado no rio.",
  },
  {
    front: "大",
    reading: "おお・だい",
    meaning: "grande",
    example: "大きい犬ですね。",
    exampleMeaning: "É um cachorro grande, né?",
  },
  {
    front: "小",
    reading: "ちい・しょう",
    meaning: "pequeno",
    example: "小さい部屋です。",
    exampleMeaning: "É um quarto pequeno.",
  },
  {
    front: "上",
    reading: "うえ・じょう",
    meaning: "em cima, acima",
    example: "机の上に本があります。",
    exampleMeaning: "Há um livro em cima da mesa.",
  },
  {
    front: "下",
    reading: "した・か",
    meaning: "embaixo, abaixo",
    example: "いすの下に猫がいます。",
    exampleMeaning: "Há um gato embaixo da cadeira.",
  },
  {
    front: "中",
    reading: "なか・ちゅう",
    meaning: "meio, dentro",
    example: "かばんの中に何がありますか。",
    exampleMeaning: "O que há dentro da bolsa?",
  },
  {
    front: "手",
    reading: "て・しゅ",
    meaning: "mão",
    example: "手を洗います。",
    exampleMeaning: "Lavo as mãos.",
  },
  {
    front: "目",
    reading: "め・もく",
    meaning: "olho",
    example: "目が痛いです。",
    exampleMeaning: "Meus olhos doem.",
  },
  {
    front: "口",
    reading: "くち・こう",
    meaning: "boca",
    example: "口を開けてください。",
    exampleMeaning: "Abra a boca, por favor.",
  },
  {
    front: "男",
    reading: "おとこ・だん",
    meaning: "homem",
    example: "男の子が三人います。",
    exampleMeaning: "Há três meninos.",
  },
  {
    front: "女",
    reading: "おんな・じょ",
    meaning: "mulher",
    example: "女の人が来ました。",
    exampleMeaning: "Uma mulher veio.",
  },
  {
    front: "子",
    reading: "こ・し",
    meaning: "criança, filho",
    example: "子どもが好きです。",
    exampleMeaning: "Gosto de crianças.",
  },
  {
    front: "先生",
    reading: "せんせい",
    meaning: "professor, mestre",
    example: "先生に聞きます。",
    exampleMeaning: "Vou perguntar ao professor.",
    tags: ["vocabulário"],
  },
  {
    front: "学生",
    reading: "がくせい",
    meaning: "estudante",
    example: "私は学生です。",
    exampleMeaning: "Eu sou estudante.",
    tags: ["vocabulário"],
  },
  {
    front: "学校",
    reading: "がっこう",
    meaning: "escola",
    example: "学校へ行きます。",
    exampleMeaning: "Vou para a escola.",
    tags: ["vocabulário"],
  },
  {
    front: "今",
    reading: "いま・こん",
    meaning: "agora",
    example: "今何時ですか。",
    exampleMeaning: "Que horas são agora?",
  },
  {
    front: "年",
    reading: "とし・ねん",
    meaning: "ano",
    example: "来年日本へ行きます。",
    exampleMeaning: "Ano que vem vou ao Japão.",
  },
  {
    front: "時間",
    reading: "じかん",
    meaning: "tempo, hora",
    example: "時間がありません。",
    exampleMeaning: "Não tenho tempo.",
    tags: ["vocabulário"],
  },
  {
    front: "何",
    reading: "なに・なん",
    meaning: "o que",
    example: "これは何ですか。",
    exampleMeaning: "O que é isto?",
  },
  {
    front: "私",
    reading: "わたし",
    meaning: "eu",
    example: "私は日本語を勉強します。",
    exampleMeaning: "Eu estudo japonês.",
  },
];

const SAUDACOES: SeedCard[] = [
  {
    front: "おはようございます",
    reading: "おはようございます",
    meaning: "Bom dia (formal, pela manhã)",
    example: "先生、おはようございます。",
    exampleMeaning: "Bom dia, professor.",
  },
  {
    front: "こんにちは",
    reading: "こんにちは",
    meaning: "Olá, boa tarde",
  },
  {
    front: "こんばんは",
    reading: "こんばんは",
    meaning: "Boa noite (ao encontrar alguém)",
  },
  {
    front: "おやすみなさい",
    reading: "おやすみなさい",
    meaning: "Boa noite (ao se despedir para dormir)",
  },
  {
    front: "ありがとうございます",
    reading: "ありがとうございます",
    meaning: "Obrigado (formal)",
  },
  {
    front: "すみません",
    reading: "すみません",
    meaning: "Com licença; desculpe",
    example: "すみません、駅はどこですか。",
    exampleMeaning: "Com licença, onde fica a estação?",
  },
  {
    front: "はじめまして",
    reading: "はじめまして",
    meaning: "Prazer em conhecê-lo (no primeiro encontro)",
  },
  {
    front: "よろしくお願いします",
    reading: "よろしくおねがいします",
    meaning: "Conto com você; prazer (fecha uma apresentação)",
  },
  {
    front: "いただきます",
    reading: "いただきます",
    meaning: "Dito antes de comer",
  },
  {
    front: "ごちそうさまでした",
    reading: "ごちそうさまでした",
    meaning: "Dito ao terminar de comer",
  },
  {
    front: "さようなら",
    reading: "さようなら",
    meaning: "Adeus (despedida mais longa)",
  },
  {
    front: "おつかれさまです",
    reading: "おつかれさまです",
    meaning: "Pelo seu esforço (colegas, ao fim do expediente)",
  },
];

interface SeedDeck {
  name: string;
  description: string;
  newPerDay: number;
  cards: SeedCard[];
}

const SEED_DECKS: SeedDeck[] = [
  {
    name: "Kanji N5 — Essenciais",
    description: "Os primeiros kanji do JLPT N5, com leitura e frase de exemplo.",
    newPerDay: 8,
    cards: KANJI_N5,
  },
  {
    name: "Saudações e Expressões",
    description: "O que se fala no dia a dia, da manhã à despedida.",
    newPerDay: 5,
    cards: SAUDACOES,
  },
];

/**
 * Popula o banco na primeira execução.
 *
 * É idempotente: se já houver qualquer deck, não faz nada — assim o usuário
 * nunca perde progresso nem ganha decks duplicados ao recarregar.
 */
export async function seedIfEmpty(now: number = Date.now()): Promise<boolean> {
  const existing = await db.decks.count();
  if (existing > 0) return false;

  await db.transaction("rw", db.decks, db.cards, async () => {
    for (const [index, seed] of SEED_DECKS.entries()) {
      const deck: Deck = {
        id: crypto.randomUUID(),
        name: seed.name,
        description: seed.description,
        newPerDay: seed.newPerDay,
        // O deslocamento por índice mantém a ordem da lista estável: com o
        // mesmo `createdAt` para todos, o desempate ficaria por conta do
        // IndexedDB e os decks trocariam de lugar entre carregamentos.
        createdAt: now + index,
      };
      await db.decks.add(deck);

      const cards: Card[] = seed.cards.map((card) => ({
        id: crypto.randomUUID(),
        deckId: deck.id,
        front: card.front,
        reading: card.reading,
        meaning: card.meaning,
        example: card.example,
        exampleMeaning: card.exampleMeaning,
        tags: card.tags ?? [],
        srs: newCardState(now),
        createdAt: now,
      }));
      await db.cards.bulkAdd(cards);
    }
  });

  return true;
}
