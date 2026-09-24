import Link from "next/link";
import { StudySession } from "@/components/study-session";
import { buscarDeck, buscarFila } from "@/lib/server/study";

export const metadata = {
  title: "Revisar — NihongoHub",
};

// A fila é montada no instante do acesso: nada aqui pode ser prerenderizado.
export const dynamic = "force-dynamic";

export default async function StudyPage({ searchParams }: PageProps<"/study">) {
  const { deck: deckId } = await searchParams;
  const idDoDeck = typeof deckId === "string" ? deckId : null;

  const deck = idDoDeck ? await buscarDeck(idDoDeck) : null;

  if (idDoDeck && !deck) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <p className="font-medium">Deck não encontrado</p>
        <p className="mt-1 text-sm text-muted">
          Ele pode ter sido removido depois que a página foi aberta.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex rounded-lg border border-border px-4 py-2 text-sm font-semibold transition-colors hover:border-accent"
        >
          Voltar ao início
        </Link>
      </div>
    );
  }

  const fila = await buscarFila(idDoDeck);

  return (
    <StudySession
      filaInicial={fila}
      deckName={deck?.name}
    />
  );
}
