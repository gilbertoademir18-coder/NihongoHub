import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { excluirCard, limparImagem } from "@/app/cards/actions";
import { CardForm } from "@/components/card-form";
import { buscarCardParaEditar, listarDecksSimples } from "@/lib/server/cards";

export const dynamic = "force-dynamic";

export default async function EditarCardPage({
  searchParams,
}: PageProps<"/cards/editar">) {
  const params = await searchParams;
  const id = typeof params.id === "string" ? params.id : "";
  if (!id) notFound();

  const [card, decks] = await Promise.all([
    buscarCardParaEditar(id),
    listarDecksSimples(),
  ]);
  if (!card) notFound();

  return (
    <div className="space-y-5">
      <div>
        <Link
          href={`/cards?deck=${encodeURIComponent(card.deckId)}`}
          className="text-sm text-accent hover:underline"
        >
          ← voltar
        </Link>
        <h1 className="jp mt-3 text-2xl font-semibold">{card.front}</h1>
        <p className="mt-1 text-sm text-muted tabular-nums">
          {card.revisoes === 0
            ? "Ainda não estudado."
            : `${card.revisoes} ${card.revisoes === 1 ? "revisão" : "revisões"} no histórico.`}
        </p>
      </div>

      <CardForm decks={decks} card={card} />

      {card.imagePath && (
        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold">Imagem atual</h2>
          <div className="mt-3 flex items-center gap-4">
            <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-lg bg-surface-muted">
              <Image
                src={card.imagePath}
                alt={card.meaning}
                fill
                sizes="8rem"
                className="object-cover"
              />
            </div>
            <div className="min-w-0 text-sm">
              <p className="text-muted">{card.imageCredit}</p>
              {/* Descartar, e não trocar na hora: a busca é uma chamada de rede
                  a um serviço com limite de requisições, e ela pertence ao
                  `npm run imagens`, que sabe esperar e repetir. */}
              <form action={limparImagem} className="mt-2">
                <input type="hidden" name="id" value={card.id} />
                <button
                  type="submit"
                  className="rounded-lg border border-border px-3 py-1.5 text-sm hover:border-accent"
                >
                  Descartar imagem
                </button>
              </form>
              <p className="mt-1 text-xs text-muted">
                Sem imagem, o card volta para a fila do <code>npm run imagens</code>.
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-accent/30 bg-accent-soft p-4">
        <h2 className="text-sm font-semibold">Excluir card</h2>
        <p className="mt-1 text-sm">
          {card.revisoes === 0
            ? "Este card nunca foi estudado, então não há histórico a perder."
            : `As ${card.revisoes} revisões dele são apagadas junto — o histórico de um card que não existe mais não significa nada, mas não dá para desfazer.`}
        </p>
        <form action={excluirCard} className="mt-3">
          <input type="hidden" name="id" value={card.id} />
          <button
            type="submit"
            className="rounded-lg border border-accent px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent hover:text-white"
          >
            Excluir definitivamente
          </button>
        </form>
      </section>
    </div>
  );
}
