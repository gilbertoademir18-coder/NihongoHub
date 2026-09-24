import Link from "next/link";

/** Tela de fim de sessão, igual nos dois modos de estudo. */
export function SessionDone({
  revisados,
  deckName,
}: {
  revisados: number;
  deckName?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-8 text-center">
      <p className="jp text-4xl">お疲れさま！</p>
      <p className="mt-3 font-medium">
        {revisados > 0
          ? `${revisados} ${revisados === 1 ? "card revisado" : "cards revisados"}.`
          : "Nada vencido por aqui."}
      </p>
      <p className="mt-1 text-sm text-muted">
        {revisados > 0
          ? "Os próximos voltam quando for a hora certa."
          : `${deckName ?? "Seus decks"} está em dia.`}
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
