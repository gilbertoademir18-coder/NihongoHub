import Image from "next/image";
import Link from "next/link";
import { listarImagens } from "@/lib/server/study";

/**
 * Revisão das imagens dos cards.
 *
 * A escolha automática acerta a maioria e erra o resto de um jeito que só o
 * olho pega — os erros passam justamente por terem o termo no título:
 * procurando "ribbon" veio a cachoeira Ribbon Falls, e "milk glass" trouxe um
 * saleiro de vidro leitoso. Nenhuma pontuação de texto separa esses casos.
 *
 * Esta tela existe para esse julgamento: ver as ~150 de uma vez, com o termo
 * que as trouxe ao lado, e anotar quais trocar. A correção mora em
 * `src/lib/palavras-kana.ts`, não aqui — imagem errada é curadoria errada.
 */

export const dynamic = "force-dynamic";

export default async function ImagensPage() {
  const cards = await listarImagens();

  const comImagem = cards.filter((c) => c.imagePath);
  const semTermo = cards.filter((c) => !c.imageQuery);
  const pendentes = cards.filter((c) => c.imageQuery && !c.imagePath);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/" className="text-sm text-accent hover:underline">
        ← voltar
      </Link>

      <h1 className="mt-4 text-2xl font-semibold">Imagens dos cards</h1>
      <p className="mt-1 text-sm text-muted">
        {comImagem.length} com imagem · {semTermo.length} sem imagem por decisão
        {pendentes.length > 0 && ` · ${pendentes.length} ainda por buscar`}
      </p>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Para trocar uma imagem, ajuste o termo em{" "}
        <code className="rounded bg-surface-muted px-1">src/lib/palavras-kana.ts</code>,
        rode <code className="rounded bg-surface-muted px-1">npm run db:seed</code> e
        depois <code className="rounded bg-surface-muted px-1">npm run imagens</code>.
      </p>

      <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {comImagem.map((card) => (
          <li
            key={card.id}
            className="overflow-hidden rounded-lg border border-border bg-surface"
          >
            <div className="relative h-32 w-full bg-surface-muted">
              <Image
                src={card.imagePath!}
                alt={card.meaning}
                fill
                sizes="(min-width: 1024px) 15rem, (min-width: 640px) 20rem, 45vw"
                className="object-cover"
              />
            </div>
            <div className="p-2">
              <p className="jp text-lg leading-tight">{card.front}</p>
              <p className="text-xs text-muted">{card.meaning}</p>
              <p className="mt-1 truncate text-[11px] text-muted" title={card.imageQuery ?? ""}>
                busca: {card.imageQuery}
              </p>
              {card.imageSource ? (
                <a
                  href={card.imageSource}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-0.5 block truncate text-[11px] text-accent hover:underline"
                >
                  {card.imageCredit}
                </a>
              ) : (
                <p className="mt-0.5 truncate text-[11px] text-muted">{card.imageCredit}</p>
              )}
            </div>
          </li>
        ))}
      </ul>

      {semTermo.length > 0 && (
        <>
          <h2 className="mt-10 text-lg font-semibold">Sem imagem, de propósito</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Palavras sem imagem possível. Uma foto inventada para{" "}
            <span className="jp">ぜんぶ</span> (tudo) ensinaria uma associação
            errada — e num SRS a repetição fixa justamente isso.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {semTermo.map((card) => (
              <li
                key={card.id}
                className="rounded-full border border-border px-3 py-1 text-sm"
              >
                <span className="jp">{card.front}</span>
                <span className="ml-2 text-xs text-muted">{card.meaning}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
