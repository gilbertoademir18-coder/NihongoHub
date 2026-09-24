import Link from "next/link";
import type { DeckComStats } from "@/lib/server/study";

/**
 * Um deck na lista da home, com o resumo e as formas de estudá-lo.
 *
 * Recebe as estatísticas já prontas em vez de buscá-las: quem monta a lista
 * traz as contagens de todos os decks numa consulta agregada só.
 */
export function DeckCard({ deck }: { deck: DeckComStats }) {
  const temKana = deck.temHiragana || deck.temKatakana;

  return (
    <article className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="jp truncate font-semibold">{deck.name}</h3>
          <p className="mt-0.5 text-sm text-muted">{deck.description}</p>
        </div>

        {deck.paraEstudar > 0 && (
          <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent tabular-nums">
            {deck.paraEstudar} na fila
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

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/study?deck=${deck.id}`}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:border-accent"
        >
          Revelar
        </Link>
        <Link
          href={`/study?deck=${deck.id}&modo=digitacao`}
          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Digitar
        </Link>
      </div>

      {/* O filtro de silabário só faz sentido onde há palavras em kana. */}
      {temKana && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <span className="text-xs text-muted">Digitar só:</span>
          {deck.temHiragana && (
            <Link
              href={`/study?deck=${deck.id}&modo=digitacao&script=hiragana`}
              className="jp rounded-full border border-border px-2.5 py-1 text-xs transition-colors hover:border-accent"
            >
              ひらがな
            </Link>
          )}
          {deck.temKatakana && (
            <Link
              href={`/study?deck=${deck.id}&modo=digitacao&script=katakana`}
              className="jp rounded-full border border-border px-2.5 py-1 text-xs transition-colors hover:border-accent"
            >
              カタカナ
            </Link>
          )}
        </div>
      )}
    </article>
  );
}
