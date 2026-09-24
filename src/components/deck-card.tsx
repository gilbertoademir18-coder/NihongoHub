import Link from "next/link";
import type { DeckComStats } from "@/lib/server/study";

/**
 * Um deck na lista da home, com o resumo do que está esperando nele.
 *
 * Recebe as estatísticas já prontas em vez de buscá-las: quem monta a lista
 * traz as contagens de todos os decks numa consulta agregada só.
 */
export function DeckCard({ deck }: { deck: DeckComStats }) {
  return (
    <Link
      href={`/study?deck=${deck.id}`}
      className="block rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="jp truncate font-semibold">{deck.name}</h3>
          <p className="mt-0.5 text-sm text-muted">{deck.description}</p>
        </div>

        {deck.due > 0 && (
          <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent tabular-nums">
            {deck.due} {deck.due === 1 ? "vencido" : "vencidos"}
          </span>
        )}
      </div>

      <dl className="mt-3 flex gap-4 text-xs text-muted tabular-nums">
        <div className="flex gap-1">
          <dt>Total</dt>
          <dd className="font-medium text-foreground">{deck.total}</dd>
        </div>
        <div className="flex gap-1">
          <dt>Novos</dt>
          <dd className="font-medium text-foreground">{deck.fresh}</dd>
        </div>
        <div className="flex gap-1">
          <dt>Aprendendo</dt>
          <dd className="font-medium text-foreground">{deck.learning}</dd>
        </div>
      </dl>
    </Link>
  );
}
