"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * Tela de fim de sessão, igual nos dois modos de estudo.
 *
 * É aqui que o treino livre é oferecido: "tudo em dia" costuma ser a resposta
 * certa do algoritmo e a resposta errada para quem abriu o app querendo
 * praticar. O treino não mexe no agendamento.
 */
export function SessionDone({
  revisados,
  deckName,
  treino = false,
  linkTreino,
}: {
  revisados: number;
  deckName?: string;
  /** A sessão que acabou de terminar era de treino. */
  treino?: boolean;
  /** Para onde ir para treinar. */
  linkTreino?: string;
}) {
  const router = useRouter();
  const fezAlgo = revisados > 0;

  /**
   * Pede outro bloco de treino.
   *
   * O carimbo de tempo não é enfeite: sem ele a URL seria a mesma de agora, e
   * navegar para a própria URL não recarrega nada. Ele também renova a
   * identidade da sessão, para que a tela volte com o bloco novo em vez de
   * reaproveitar o que já acabou.
   */
  function treinarMais() {
    if (!linkTreino) return;
    router.push(`${linkTreino}&bloco=${Date.now()}`);
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-8 text-center">
      <p className="jp text-4xl">お疲れさま！</p>

      <p className="mt-3 font-medium">
        {fezAlgo
          ? `${revisados} ${revisados === 1 ? "card revisado" : "cards revisados"}.`
          : treino
            ? "Nada para treinar ainda."
            : "Nada vencido por aqui."}
      </p>

      <p className="mt-1 text-sm text-muted">
        {treino
          ? fezAlgo
            ? "Treino não mexe no agendamento: as datas seguem como estavam."
            : "O treino repassa palavras que você já estudou — comece uma sessão normal primeiro."
          : fezAlgo
            ? "Os próximos voltam quando for a hora certa."
            : `${deckName ?? "Seus decks"} está em dia.`}
      </p>

      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {linkTreino &&
          (treino ? (
            <button
              type="button"
              onClick={treinarMais}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Treinar mais
            </button>
          ) : (
            <Link
              href={linkTreino}
              prefetch={false}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Treinar mesmo assim
            </Link>
          ))}
        <Link
          href="/"
          className="rounded-lg border border-border px-4 py-2 text-sm font-semibold transition-colors hover:border-accent"
        >
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}
