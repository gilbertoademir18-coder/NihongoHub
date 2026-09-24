"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { type Deck, getDeckStats } from "@/lib/db";

/** Um deck na lista da home, com o resumo do que está esperando nele. */
export function DeckCard({ deck }: { deck: Deck }) {
  const stats = useLiveQuery(() => getDeckStats(deck.id), [deck.id]);

  const due = stats?.due ?? 0;

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

        {due > 0 && (
          <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent tabular-nums">
            {due} {due === 1 ? "vencido" : "vencidos"}
          </span>
        )}
      </div>

      {stats && (
        <dl className="mt-3 flex gap-4 text-xs text-muted tabular-nums">
          <div className="flex gap-1">
            <dt>Total</dt>
            <dd className="font-medium text-foreground">{stats.total}</dd>
          </div>
          <div className="flex gap-1">
            <dt>Novos</dt>
            <dd className="font-medium text-foreground">{stats.fresh}</dd>
          </div>
          <div className="flex gap-1">
            <dt>Aprendendo</dt>
            <dd className="font-medium text-foreground">{stats.learning}</dd>
          </div>
        </dl>
      )}
    </Link>
  );
}
