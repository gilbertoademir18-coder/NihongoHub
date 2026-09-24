import Link from "next/link";
import { StudySession } from "@/components/study-session";
import { TypingSession } from "@/components/typing-session";
import {
  type FiltroScript,
  buscarDeck,
  buscarFila,
  buscarTreino,
  contarTreinaveis,
} from "@/lib/server/study";

export const metadata = {
  title: "Revisar — NihongoHub",
};

// A fila é montada no instante do acesso: nada aqui pode ser prerenderizado.
export const dynamic = "force-dynamic";

const SCRIPTS: FiltroScript[] = ["hiragana", "katakana", "ambos"];

function lerScript(valor: string | string[] | undefined): FiltroScript {
  return typeof valor === "string" && (SCRIPTS as string[]).includes(valor)
    ? (valor as FiltroScript)
    : "ambos";
}

export default async function StudyPage({ searchParams }: PageProps<"/study">) {
  const params = await searchParams;

  const idDoDeck = typeof params.deck === "string" ? params.deck : null;
  const digitando = params.modo === "digitacao";
  const script = lerScript(params.script);
  const treinando = params.treino === "1";

  const deck = idDoDeck ? await buscarDeck(idDoDeck) : null;

  if (idDoDeck && !deck) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <p className="font-medium">Deck não encontrado</p>
        <p className="mt-1 text-sm text-muted">
          Ele pode ter sido removido depois que a página foi aberta.
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

  const [fila, treinaveis] = await Promise.all([
    treinando ? buscarTreino(idDoDeck, { script }) : buscarFila(idDoDeck, { script }),
    contarTreinaveis(idDoDeck, script),
  ]);

  // O treino só é oferecido quando há o que repassar: sem nenhuma palavra
  // introduzida, o link levaria a uma sessão vazia.
  const linkTreino =
    treinaveis > 0
      ? `/study?${new URLSearchParams({
          ...(idDoDeck ? { deck: idDoDeck } : {}),
          ...(digitando ? { modo: "digitacao" } : {}),
          ...(script !== "ambos" ? { script } : {}),
          treino: "1",
        })}`
      : undefined;

  const comum = {
    filaInicial: fila,
    deckName: deck?.name,
    treino: treinando,
    linkTreino,
  };

  /**
   * Identidade da sessão.
   *
   * A sessão guarda a fila em `useState`, que só lê a prop na montagem. Ao
   * trocar de sessão — terminar a revisão e ir para o treino — o React
   * reaproveitaria o mesmo componente e a fila nova seria ignorada, deixando a
   * tela em "nada para estudar". A chave resolve isso remontando.
   *
   * Ela é feita dos **parâmetros**, e não da fila: gravar uma resposta dispara
   * revalidação, esta página re-renderiza com a fila já menor, e uma chave
   * derivada do conteúdo mudaria no meio do caminho — remontando a sessão e
   * zerando o progresso a cada card. Para pedir outro bloco de treino na mesma
   * URL existe o `bloco`, que o botão "Treinar mais" troca.
   */
  const chaveDaSessao = [
    idDoDeck,
    script,
    digitando ? "digitacao" : "flashcard",
    treinando ? "treino" : "revisao",
    typeof params.bloco === "string" ? params.bloco : "",
  ].join("|");

  // O modo é da sessão, não do conteúdo: o mesmo deck pode ser estudado
  // revelando a resposta ou digitando.
  return digitando ? (
    <TypingSession key={chaveDaSessao} {...comum} />
  ) : (
    <StudySession key={chaveDaSessao} {...comum} />
  );
}
