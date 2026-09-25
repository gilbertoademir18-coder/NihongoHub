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
import { conferirImagem } from "@/lib/imagem";
import { prisma } from "@/lib/prisma";
import {
  type CardParaEditar,
  type DeckSimples,
  buscarCardParaEditar,
  listarDecksSimples,
} from "@/lib/server/cards";
import { apagarImagem, gravarImagem } from "@/lib/server/imagem";
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

/** Crédito de uma imagem enviada à mão — não há autor externo a atribuir. */
const CREDITO_PROPRIO = "Imagem enviada por você";

/**
 * Lê o arquivo enviado e confere se ele pode virar imagem de card.
 *
 * Acontece antes de qualquer escrita no banco: um arquivo recusado não pode
 * deixar para trás um card criado pela metade.
 */
async function lerImagem(form: FormData) {
  const enviado = form.get("imagem");
  if (!(enviado instanceof File) || enviado.size === 0) return null;

  const bytes = new Uint8Array(await enviado.arrayBuffer());
  const conferido = conferirImagem(bytes);
  return conferido.ok ? { bytes, extensao: conferido.extensao } : { motivo: conferido.motivo };
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

  const imagem = await lerImagem(form);
  if (imagem && "motivo" in imagem) return { erros: { imagem: imagem.motivo } };
  const removerImagem = form.get("removerImagem") === "1";

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
  let imagemAntiga: string | null = null;
  if (id) {
    const existente = await prisma.card.findUnique({
      where: { id },
      select: { id: true, imagePath: true },
    });
    if (!existente) return { erros: {}, mensagem: "Esse card não existe mais." };
    imagemAntiga = existente.imagePath;
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

  // A imagem é gravada depois, em segunda escrita, porque o nome do arquivo
  // leva o id do card — e num cadastro novo o id só existe agora. Só custa
  // essa escrita extra quando a imagem realmente mudou.
  let imagemFinal = imagemAntiga;
  if (imagem) {
    imagemFinal = await gravarImagem(salvoId, imagem.bytes, imagem.extensao);
  } else if (removerImagem) {
    imagemFinal = null;
  }

  if (imagemFinal !== imagemAntiga) {
    await prisma.card.update({
      where: { id: salvoId },
      data: {
        imagePath: imagemFinal,
        imageCredit: imagemFinal ? CREDITO_PROPRIO : null,
        // Imagem própria não tem página de origem. Zerar é obrigatório: o
        // crédito da anterior apontaria para uma foto que não está mais aqui.
        imageSource: null,
      },
    });
    // Só depois de o banco apontar para a nova: se apagar antes e a escrita
    // falhar, o card fica com caminho para arquivo inexistente.
    await apagarImagem(imagemAntiga);
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
        imagePath: imagemFinal,
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
  const card = await prisma.card.findUnique({
    where: { id },
    select: { id: true, imagePath: true },
  });
  if (!card) return;

  await prisma.card.delete({ where: { id } });
  // Sem card não há quem aponte para o arquivo, e ninguém varre a pasta: o
  // que ficasse aqui ficaria para sempre.
  await apagarImagem(card.imagePath);

  revalidatePath("/");
  revalidatePath("/cards");
  revalidatePath("/imagens");
}
