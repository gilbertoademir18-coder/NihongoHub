"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/bootstrap";
import { DeckCard } from "@/components/deck-card";

export default function HomePage() {
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    ensureSeeded().then(() => setSeeded(true));
  }, []);

  const decks = useLiveQuery(
    async () => db.decks.orderBy("createdAt").toArray(),
    [],
    undefined,
  );

  // Recalcula a fila do dia junto com qualquer mudança em cards.
  const dueTotal = useLiveQuery(
    async () => db.cards.where("srs.dueAt").belowOrEqual(Date.now()).count(),
    [],
    undefined,
  );

  const loading = !seeded || decks === undefined;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-surface p-5">
        <p className="text-sm text-muted">Sua fila de hoje</p>
        <p className="mt-1 flex items-baseline gap-2">
          <span className="text-4xl font-bold tabular-nums">
            {dueTotal ?? "—"}
          </span>
          <span className="text-sm text-muted">
            {dueTotal === 1 ? "card para revisar" : "cards para revisar"}
          </span>
        </p>

        {dueTotal !== undefined && dueTotal > 0 ? (
          <Link
            href="/study"
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Revisar agora
          </Link>
        ) : (
          <p className="mt-3 text-sm text-muted">
            {dueTotal === 0
              ? "Tudo em dia. お疲れさま！"
              : "Preparando seus decks…"}
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Seus decks
        </h2>

        {loading ? (
          <ul className="space-y-3">
            {[0, 1].map((i) => (
              <li
                key={i}
                className="h-24 animate-pulse rounded-xl border border-border bg-surface-muted"
              />
            ))}
          </ul>
        ) : decks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
            Nenhum deck ainda.
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
