import { SEPARADOR_LEITURAS, detectarScript, soTemKana } from "./kana";

/**
 * Validação de um card, em funções puras.
 *
 * Fica fora do servidor de propósito: a mesma regra roda no formulário, para
 * avisar enquanto se digita, e de novo na Server Action, que é onde ela
 * realmente vale. Argumento de Server Action chega pela rede — validar só no
 * navegador é não validar.
 */

/** Limites generosos. Existem para barrar colagem acidental, não para apertar. */
export const MAX_FRENTE = 60;
export const MAX_LEITURA = 120;
export const MAX_SIGNIFICADO = 200;
export const MAX_EXEMPLO = 300;
export const MAX_TERMO_BUSCA = 80;
export const MAX_TAGS = 8;

export interface DadosDoCard {
  deckId: string;
  front: string;
  reading: string;
  meaning: string;
  example: string;
  exampleMeaning: string;
  tags: string[];
  imageQuery: string;
}

export const CARD_VAZIO: DadosDoCard = {
  deckId: "",
  front: "",
  reading: "",
  meaning: "",
  example: "",
  exampleMeaning: "",
  tags: [],
  imageQuery: "",
};

/**
 * Erros por campo. Objeto vazio significa que está tudo certo.
 *
 * `imagem` entra aqui apesar de não ser um campo de `DadosDoCard`: o arquivo
 * não é texto e não passa por `normalizarCard`, mas o erro dele precisa
 * aparecer do lado do seletor, como o de qualquer outro campo.
 */
export type ErrosDoCard = Partial<Record<keyof DadosDoCard | "imagem", string>>;

function limpar(texto: string) {
  return texto.trim().replace(/\s+/g, " ");
}

/**
 * Normaliza antes de validar e de gravar.
 *
 * Espaço sobrando é a sujeira mais comum ao colar de um dicionário, e um
 * `front` com espaço no fim viraria um card que nunca casa com a resposta
 * digitada — um bug que só aparece na hora de estudar.
 */
export function normalizarCard(dados: DadosDoCard): DadosDoCard {
  return {
    deckId: dados.deckId.trim(),
    front: limpar(dados.front),
    reading: limpar(dados.reading),
    meaning: limpar(dados.meaning),
    example: limpar(dados.example),
    exampleMeaning: limpar(dados.exampleMeaning),
    tags: [...new Set(dados.tags.map(limpar).filter(Boolean))].slice(0, MAX_TAGS),
    imageQuery: limpar(dados.imageQuery),
  };
}

/**
 * O que está errado no card, campo a campo.
 *
 * `example` sem tradução passa: um exemplo em japonês já ajuda sozinho. O
 * contrário, não — tradução sem frase é um pedaço órfão na tela.
 */
export function validarCard(dados: DadosDoCard): ErrosDoCard {
  const erros: ErrosDoCard = {};
  const d = normalizarCard(dados);

  if (!d.deckId) erros.deckId = "Escolha um deck.";

  if (!d.front) erros.front = "A frente do card é obrigatória.";
  else if (d.front.length > MAX_FRENTE) erros.front = `No máximo ${MAX_FRENTE} caracteres.`;

  if (!d.reading) erros.reading = "A leitura em kana é obrigatória.";
  else if (d.reading.length > MAX_LEITURA)
    erros.reading = `No máximo ${MAX_LEITURA} caracteres.`;
  else {
    // Cada alternativa separada por ・ precisa ser kana por si só: é assim que
    // a conferência do modo digitação lê o campo, e romaji ou kanji aqui
    // fariam a resposta certa ser recusada na sessão.
    const alternativas = d.reading.split(SEPARADOR_LEITURAS).map((x) => x.trim());
    if (alternativas.some((alt) => !soTemKana(alt))) {
      erros.reading = `A leitura tem que ser só kana (use ${SEPARADOR_LEITURAS} para separar alternativas).`;
    }
  }

  if (!d.meaning) erros.meaning = "O significado é obrigatório.";
  else if (d.meaning.length > MAX_SIGNIFICADO)
    erros.meaning = `No máximo ${MAX_SIGNIFICADO} caracteres.`;

  if (d.example.length > MAX_EXEMPLO)
    erros.example = `No máximo ${MAX_EXEMPLO} caracteres.`;
  if (d.exampleMeaning.length > MAX_EXEMPLO)
    erros.exampleMeaning = `No máximo ${MAX_EXEMPLO} caracteres.`;
  if (d.exampleMeaning && !d.example)
    erros.exampleMeaning = "Tradução sem a frase original não diz nada.";

  if (d.imageQuery.length > MAX_TERMO_BUSCA)
    erros.imageQuery = `No máximo ${MAX_TERMO_BUSCA} caracteres.`;

  return erros;
}

export function temErro(erros: ErrosDoCard): boolean {
  return Object.keys(erros).length > 0;
}

/**
 * O silabário que o card terá, a partir da frente.
 *
 * Vem da **frente**, e não da leitura: é a frente que aparece na tela, e é
 * por ela que uma sessão "só katakana" tem de filtrar. Um card de kanji tem
 * leitura em hiragana e não pertence a nenhum dos dois filtros.
 */
export function scriptDoCard(front: string): "hiragana" | "katakana" | null {
  return detectarScript(front);
}

/**
 * Resultado de uma tentativa de salvar, como o formulário o enxerga.
 *
 * Mora aqui, e não junto da Server Action, por uma regra do Next: num módulo
 * `"use server"` todo export precisa ser função async, porque cada um vira um
 * endpoint. Uma constante exportada de lá não chega ao cliente — ela volta
 * `undefined`, e o formulário quebra na primeira renderização.
 */
export interface EstadoDoForm {
  erros: ErrosDoCard;
  /** Erro que não pertence a nenhum campo — deck apagado, card sumido. */
  mensagem?: string;
  /**
   * O card já gravado, quando a edição acontece em modal.
   *
   * Em página o sucesso é um `redirect`, e nada precisa voltar. Em modal não
   * há para onde ir: quem abriu o modal continua na tela de trás, e precisa
   * destes campos para mostrar o texto novo sem recarregar — durante uma
   * sessão de estudo, recarregar seria perder a fila.
   */
  salvo?: CardSalvo;
}

/** O que muda na tela de trás depois de salvar. */
export interface CardSalvo {
  id: string;
  front: string;
  reading: string;
  meaning: string;
  /** A imagem depois do envio ou da remoção — `null` quando o card ficou sem. */
  imagePath: string | null;
}

export const ESTADO_INICIAL: EstadoDoForm = { erros: {} };
