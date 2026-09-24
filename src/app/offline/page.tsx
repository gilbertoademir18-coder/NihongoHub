import Link from "next/link";

export const metadata = {
  title: "Offline — NihongoHub",
};

/**
 * Último recurso do service worker: mostrada só quando nem a rota pedida nem
 * a home estão em cache — ou seja, numa primeira visita sem rede.
 */
export default function OfflinePage() {
  return (
    <div className="rounded-xl border border-border bg-surface p-8 text-center">
      <p className="jp text-4xl text-accent">圏外</p>
      <h1 className="mt-3 text-lg font-semibold">Sem conexão</h1>
      <p className="mt-2 text-sm text-muted">
        Esta página ainda não tinha sido aberta neste aparelho, então não estava
        salva. Seus decks e seu progresso continuam intactos.
      </p>
      <Link
        href="/"
        className="mt-5 inline-flex rounded-lg border border-border px-4 py-2 text-sm font-semibold transition-colors hover:border-accent"
      >
        Ir para os meus decks
      </Link>
    </div>
  );
}
