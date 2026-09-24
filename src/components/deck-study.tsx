"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { StudySession } from "./study-session";

/**
 * Sessão de estudo de um deck específico.
 *
 * O nome do deck vem do IndexedDB, então esta busca precisa acontecer no
 * cliente — o servidor não tem acesso aos dados do usuário.
 */
export function DeckStudy({ deckId }: { deckId: string }) {
  const deck = useLiveQuery(() => db.decks.get(deckId), [deckId], undefined);

  if (deck === undefined) {
    return (
      <div className="h-64 animate-pulse rounded-xl border border-border bg-surface-muted" />
    );
  }

  if (deck === null) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <p className="font-medium">Deck não encontrado</p>
        <p className="mt-1 text-sm text-muted">
          Ele pode ter sido removido neste navegador.
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

  return <StudySession deckId={deck.id} deckName={deck.name} />;
}
