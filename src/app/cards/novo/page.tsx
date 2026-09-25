import Link from "next/link";
import { CardForm } from "@/components/card-form";
import { listarDecksSimples } from "@/lib/server/cards";

export const dynamic = "force-dynamic";

export default async function NovoCardPage({
  searchParams,
}: PageProps<"/cards/novo">) {
  const params = await searchParams;
  const deckPadrao = typeof params.deck === "string" ? params.deck : undefined;
  const decks = await listarDecksSimples();

  if (decks.length === 0) {
    return (
      <div className="space-y-4">
        <Link href="/" className="text-sm text-accent hover:underline">
          ← voltar
        </Link>
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
          Não há nenhum deck onde guardar o card. Rode <code>npm run db:seed</code>{" "}
          para carregar os decks de exemplo.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <Link
          href={`/cards${deckPadrao ? `?deck=${encodeURIComponent(deckPadrao)}` : ""}`}
          className="text-sm text-accent hover:underline"
        >
          ← voltar
        </Link>
        <h1 className="mt-3 text-2xl font-semibold">Novo card</h1>
        <p className="mt-1 text-sm text-muted">
          Ele entra como nunca estudado: só aparece na fila quando o lote do deck
          abrir uma vaga.
        </p>
      </div>

      <CardForm decks={decks} deckPadrao={deckPadrao} />
    </div>
  );
}
