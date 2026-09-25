import Image from "next/image";
import Link from "next/link";
import { listarCards, listarDecksSimples } from "@/lib/server/cards";

/**
 * Lista de cards de um deck, com busca e atalhos para editar.
 *
 * O deck vem por query param, como no resto do app (`/study?deck=`), em vez de
 * segmento dinâmico — uma convenção só evita ter que lembrar qual tela usa
 * qual forma.
 */

export const dynamic = "force-dynamic";

export default async function CardsPage({
  searchParams,
}: PageProps<"/cards">) {
  const params = await searchParams;
  const deckId = typeof params.deck === "string" ? params.deck : null;
  const busca = typeof params.q === "string" ? params.q : "";
  const salvo = params.salvo === "1";
  const excluido = params.excluido === "1";

  const [decks, cards] = await Promise.all([
    listarDecksSimples(),
    listarCards(deckId, busca),
  ]);

  const deckAtual = decks.find((d) => d.id === deckId);
  const linkNovo = `/cards/novo${deckId ? `?deck=${encodeURIComponent(deckId)}` : ""}`;

  return (
    <div className="space-y-5">
      <div>
        <Link href="/" className="text-sm text-accent hover:underline">
          ← voltar
        </Link>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">
            {deckAtual ? deckAtual.name : "Todos os cards"}
          </h1>
          <Link
            href={linkNovo}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Novo card
          </Link>
        </div>
      </div>

      {(salvo || excluido) && (
        <p
          role="status"
          className="rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm text-success"
        >
          {salvo ? "Card salvo." : "Card excluído."}
        </p>
      )}

      <nav className="flex flex-wrap gap-2 text-sm">
        <FiltroDeck href="/cards" ativo={!deckId} rotulo="Todos" />
        {decks.map((d) => (
          <FiltroDeck
            key={d.id}
            href={`/cards?deck=${encodeURIComponent(d.id)}`}
            ativo={d.id === deckId}
            rotulo={`${d.name} (${d.total})`}
          />
        ))}
      </nav>

      {/* Formulário simples com GET: a busca fica na URL, então dá para
          recarregar, voltar e compartilhar o resultado. */}
      <form action="/cards" method="get" className="flex gap-2">
        {deckId && <input type="hidden" name="deck" value={deckId} />}
        <input
          name="q"
          defaultValue={busca}
          placeholder="Procurar por japonês ou significado"
          aria-label="Procurar card"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:border-accent"
        >
          Buscar
        </button>
      </form>

      <p className="text-sm text-muted tabular-nums">
        {cards.length} {cards.length === 1 ? "card" : "cards"}
        {busca && ` para "${busca}"`}
      </p>

      {cards.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
          {busca ? "Nada encontrado." : "Nenhum card ainda."}
        </p>
      ) : (
        <ul className="space-y-2">
          {cards.map((card) => (
            <li key={card.id}>
              <Link
                href={`/cards/editar?id=${encodeURIComponent(card.id)}`}
                className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 transition-colors hover:border-accent"
              >
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded bg-surface-muted">
                  {card.imagePath && (
                    <Image
                      src={card.imagePath}
                      alt=""
                      fill
                      sizes="3rem"
                      className="object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="jp truncate text-lg leading-tight">{card.front}</p>
                  <p className="truncate text-sm text-muted">
                    <span className="jp">{card.reading}</span> · {card.meaning}
                  </p>
                </div>
                {card.novo && (
                  <span className="shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-[11px] text-muted">
                    novo
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FiltroDeck({
  href,
  ativo,
  rotulo,
}: {
  href: string;
  ativo: boolean;
  rotulo: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 transition-colors ${
        ativo
          ? "border-accent bg-accent-soft text-accent"
          : "border-border text-muted hover:border-accent"
      }`}
    >
      {rotulo}
    </Link>
  );
}
