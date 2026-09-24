import Link from "next/link";
import { DeckCard } from "@/components/deck-card";
import { contarParaEstudar, listarDecksComStats } from "@/lib/server/study";

// A fila muda a cada revisão: prerenderizar esta página serviria números
// velhos, e no build nem haveria banco para consultar.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [decks, paraEstudar] = await Promise.all([
    listarDecksComStats(),
    contarParaEstudar(),
  ]);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-surface p-5">
        <p className="text-sm text-muted">Sua fila de hoje</p>
        <p className="mt-1 flex items-baseline gap-2">
          <span className="text-4xl font-bold tabular-nums">{paraEstudar}</span>
          <span className="text-sm text-muted">
            {paraEstudar === 1 ? "card para revisar" : "cards para revisar"}
          </span>
        </p>

        {paraEstudar > 0 ? (
          <Link
            href="/study"
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Revisar agora
          </Link>
        ) : (
          <p className="mt-3 text-sm text-muted">Tudo em dia. お疲れさま！</p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Seus decks
        </h2>

        {decks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
            Nenhum deck ainda. Rode <code>npm run db:seed</code> para carregar os
            decks de exemplo.
          </p>
        ) : (
          <ul className="space-y-3">
            {decks.map((deck) => (
              <li key={deck.id}>
                <DeckCard deck={deck} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
