"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  CARD_VAZIO,
  type DadosDoCard,
  type EstadoDoForm,
  normalizarCard,
  scriptDoCard,
  temErro,
  validarCard,
} from "@/lib/card-form";
import { prisma } from "@/lib/prisma";
import {
  type CardParaEditar,
  type DeckSimples,
  buscarCardParaEditar,
  listarDecksSimples,
} from "@/lib/server/cards";
import { newCardState } from "@/lib/srs";

/**
 * Cadastro, edição e exclusão de cards.
 *
 * A validação roda aqui de novo, e não só no formulário: argumento de Server
 * Action chega pela rede e vale como entrada externa, por mais que só a nossa
 * tela o envie.
 */

/**
 * Editar em modal ou em página.
 *
 * Em página, salvar termina em `redirect`. Em modal não há para onde ir — a
 * tela de trás continua lá, e pode ser uma sessão de estudo cuja fila vive na
 * memória do navegador: navegar a perderia.
 */
type Contexto = "pagina" | "modal";

function lerContexto(form: FormData): Contexto {
  return form.get("contexto") === "modal" ? "modal" : "pagina";
}

/**
 * Carrega um card e a lista de decks para o modal de edição.
 *
 * O modal abre a partir de uma tela que não tem esses dados — a sessão de
 * estudo carrega só o que ela usa. Buscar na hora de abrir evita puxar
 * exemplo, etiquetas e termo de imagem de todo card da fila para o caso de
 * alguém querer editar um.
 */
export async function carregarCardParaEdicao(
  id: string,
): Promise<{ card: CardParaEditar; decks: DeckSimples[] } | null> {
  const limpo = String(id ?? "").trim();
  if (!limpo) return null;

  const [card, decks] = await Promise.all([
    buscarCardParaEditar(limpo),
    listarDecksSimples(),
  ]);
  if (!card) return null;
  return { card, decks };
}

function lerFormulario(form: FormData): DadosDoCard {
  const texto = (campo: string) => String(form.get(campo) ?? "");
  return {
    ...CARD_VAZIO,
    deckId: texto("deckId"),
    front: texto("front"),
    reading: texto("reading"),
    meaning: texto("meaning"),
    example: texto("example"),
    exampleMeaning: texto("exampleMeaning"),
    // Tags chegam como texto separado por vírgula: é o que se digita rápido.
    tags: texto("tags")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    imageQuery: texto("imageQuery"),
  };
}

/**
 * Cria ou atualiza, conforme venha `id` no formulário.
 *
 * Um caminho só porque os dois fazem a mesma validação e gravam os mesmos
 * campos; separar duplicaria a regra e deixaria as duas metades divergirem.
 */
export async function salvarCard(
  _anterior: EstadoDoForm,
  form: FormData,
): Promise<EstadoDoForm> {
  const id = String(form.get("id") ?? "").trim();
  const dados = normalizarCard(lerFormulario(form));

  const erros = validarCard(dados);
  if (temErro(erros)) return { erros };

  const deck = await prisma.deck.findUnique({ where: { id: dados.deckId } });
  if (!deck) return { erros: {}, mensagem: "Esse deck não existe mais." };

  // Frente repetida no mesmo deck quase sempre é cadastro em duplicata — e
  // dois cards iguais na fila viram duas revisões do mesmo conteúdo.
  const irmao = await prisma.card.findFirst({
    where: { deckId: dados.deckId, front: dados.front, ...(id ? { id: { not: id } } : {}) },
    select: { id: true },
  });
  if (irmao) {
    return { erros: { front: `O deck "${deck.name}" já tem um card com essa frente.` } };
  }

  const campos = {
    deckId: dados.deckId,
    front: dados.front,
    reading: dados.reading,
    meaning: dados.meaning,
    // Campo opcional vazio vira `null`, e não "": no banco, ausência é null,
    // e uma string vazia faria a tela renderizar um bloco de exemplo em branco.
    example: dados.example || null,
    exampleMeaning: dados.exampleMeaning || null,
    tags: dados.tags,
    imageQuery: dados.imageQuery || null,
    // Derivado, nunca digitado: o silabário é uma propriedade da escrita, e
    // deixar escolher à mão só criaria card marcado como katakana em hiragana.
    script: scriptDoCard(dados.front),
  };

  let salvoId = id;
  if (id) {
    const existente = await prisma.card.findUnique({ where: { id }, select: { id: true } });
    if (!existente) return { erros: {}, mensagem: "Esse card não existe mais." };
    await prisma.card.update({ where: { id }, data: campos });
  } else {
    // Card novo entra como nunca estudado: `introducedAt` fica null, e é o
    // lote que decide quando ele aparece pela primeira vez.
    const inicial = newCardState(Date.now());
    const criado = await prisma.card.create({
      data: {
        ...campos,
        ease: inicial.ease,
        intervalDays: inicial.intervalDays,
        repetitions: inicial.repetitions,
        learningStep: inicial.learningStep,
        dueAt: new Date(inicial.dueAt),
        lapses: inicial.lapses,
      },
      select: { id: true },
    });
    salvoId = criado.id;
  }

  revalidatePath("/");
  revalidatePath("/cards");
  revalidatePath("/imagens");

  if (lerContexto(form) === "modal") {
    return {
      erros: {},
      salvo: {
        id: id || salvoId,
        front: dados.front,
        reading: dados.reading,
        meaning: dados.meaning,
      },
    };
  }
  redirect(`/cards?deck=${encodeURIComponent(dados.deckId)}&salvo=1`);
}

/**
 * Exclui um card — e, por tabela, todo o histórico de revisões dele.
 *
 * O `onDelete: Cascade` do schema apaga as revisões junto. É o comportamento
 * certo (histórico de card inexistente não significa nada), mas é perda de
 * dado real, e por isso o modal pede confirmação antes de chamar isto.
 *
 * Não redireciona: quem chama está num modal sobre a lista ou sobre uma
 * sessão de estudo, e navegar levaria a fila junto.
 */
export async function excluirCard(form: FormData): Promise<void> {
  const id = String(form.get("id") ?? "").trim();
  if (!id) throw new Error("card não informado");

  // Já excluído por outra aba: não é erro, o resultado pedido é o que já vale.
  const card = await prisma.card.findUnique({ where: { id }, select: { id: true } });
  if (!card) return;

  await prisma.card.delete({ where: { id } });

  revalidatePath("/");
  revalidatePath("/cards");
  revalidatePath("/imagens");
}

/**
 * Descarta a imagem do card, mantendo o termo de busca.
 *
 * Não apaga o arquivo do disco: a varredura de órfãos faz isso, e apagar aqui
 * significaria perder a imagem antes de saber se a próxima é melhor. Com o
 * `imagePath` em branco, `npm run imagens` busca este card de novo.
 */
export async function limparImagem(form: FormData): Promise<void> {
  const id = String(form.get("id") ?? "").trim();
  if (!id) throw new Error("card não informado");

  await prisma.card.update({
    where: { id },
    data: { imagePath: null, imageCredit: null, imageSource: null },
  });

  revalidatePath("/cards");
  revalidatePath("/imagens");
}
