"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { revisarCard } from "@/app/actions";
import type { CardEstudo } from "@/lib/server/study";
import { type Rating, formatDelay, previewIntervals } from "@/lib/srs";

/**
 * Cards reagendados para daqui a menos que isto voltam ainda nesta sessão,
 * em vez de sumirem até o próximo acesso. É o que faz os passos de
 * aprendizado de 1 e 10 minutos realmente acontecerem.
 */
const SESSION_HORIZON_MS = 20 * 60_000;

/** Quantos cards entram na frente de um card que voltou para a fila. */
const REINSERT_GAP = 3;

const RATINGS: { rating: Rating; label: string; key: string; className: string }[] = [
  {
    rating: "again",
    label: "De novo",
    key: "1",
    className: "border-accent/30 bg-accent-soft text-accent hover:border-accent",
  },
  {
    rating: "hard",
    label: "Difícil",
    key: "2",
    className: "border-border bg-surface-muted hover:border-warning",
  },
  {
    rating: "good",
    label: "Bom",
    key: "3",
    className: "border-border bg-surface-muted hover:border-success",
  },
  {
    rating: "easy",
    label: "Fácil",
    key: "4",
    className: "border-border bg-surface-muted hover:border-indigo",
  },
];

export function StudySession({
  filaInicial,
  deckName,
}: {
  filaInicial: CardEstudo[];
  deckName?: string;
}) {
  const [queue, setQueue] = useState(filaInicial);
  const [revealed, setRevealed] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  /** Quando o card atual apareceu — vira o tempo de resposta no histórico. */
  const shownAt = useRef(0);
  /** Evita que dois toques rápidos avaliem o mesmo card duas vezes. */
  const busy = useRef(false);

  const current = queue[0] ?? null;

  // O cronômetro reinicia a cada card exibido. `reviewed` entra como
  // dependência porque um card pode voltar logo em seguida a si mesmo
  // (fila curta em aprendizado), e aí o id sozinho não mudaria.
  useEffect(() => {
    shownAt.current = Date.now();
  }, [current?.id, reviewed]);

  const answer = useCallback(
    async (rating: Rating) => {
      if (!current || busy.current) return;
      busy.current = true;
      setSalvando(true);
      setErro(null);

      const duration = Date.now() - shownAt.current;

      try {
        // O agendamento é calculado e gravado no servidor; aqui só usamos o
        // card que volta de lá para decidir se ele reaparece nesta sessão.
        const atualizado = await revisarCard(current.id, rating, duration);

        setQueue((prev) => {
          const rest = prev.slice(1);
          if (atualizado.srs.dueAt <= Date.now() + SESSION_HORIZON_MS) {
            const at = Math.min(REINSERT_GAP, rest.length);
            return [...rest.slice(0, at), atualizado, ...rest.slice(at)];
          }
          return rest;
        });

        setReviewed((n) => n + 1);
        setRevealed(false);
      } catch {
        // Sem o servidor não há como registrar a revisão. Mantemos o card na
        // tela para a pessoa tentar de novo, em vez de seguir adiante e
        // perder a resposta silenciosamente.
        setErro("Não foi possível salvar. Verifique a conexão e tente de novo.");
      } finally {
        busy.current = false;
        setSalvando(false);
      }
    },
    [current],
  );

  // Atalhos de teclado: espaço revela, 1–4 avaliam. Estudar com as mãos no
  // teclado é bem mais rápido do que mirar em botões.
  useEffect(() => {
    if (!current) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (busy.current) return;

      if (!revealed) {
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          setRevealed(true);
        }
        return;
      }

      const match = RATINGS.find((r) => r.key === event.key);
      if (match) {
        event.preventDefault();
        void answer(match.rating);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [current, revealed, answer]);

  if (!current) {
    return <SessionDone reviewed={reviewed} deckName={deckName} />;
  }

  const preview = previewIntervals(current.srs);
  const showReading = current.reading && current.reading !== current.front;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-muted tabular-nums">
        <span>{deckName ?? "Todos os decks"}</span>
        <span>
          {queue.length} na fila · {reviewed} revisados
        </span>
      </div>

      <article className="rounded-xl border border-border bg-surface">
        {/* Frente: só o japonês, sem nada que entregue a resposta. */}
        <div className="flex min-h-48 flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="jp text-6xl font-medium leading-tight">{current.front}</p>
          {revealed && showReading && (
            <p className="jp text-xl text-accent">{current.reading}</p>
          )}
        </div>

        {revealed && (
          <div className="space-y-3 border-t border-border p-5 text-center">
            <p className="text-lg font-medium">{current.meaning}</p>
            {current.example && (
              <div className="rounded-lg bg-surface-muted p-3">
                <p className="jp text-base">{current.example}</p>
                {current.exampleMeaning && (
                  <p className="mt-1 text-sm text-muted">{current.exampleMeaning}</p>
                )}
              </div>
            )}
          </div>
        )}
      </article>

      {erro && (
        <p
          role="alert"
          className="rounded-lg border border-accent/40 bg-accent-soft px-3 py-2 text-sm text-accent"
        >
          {erro}
        </p>
      )}

      {revealed ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {RATINGS.map(({ rating, label, key, className }) => (
            <button
              key={rating}
              type="button"
              disabled={salvando}
              onClick={() => void answer(rating)}
              className={`flex flex-col items-center gap-0.5 rounded-lg border px-3 py-3 text-sm font-semibold transition-colors disabled:opacity-50 ${className}`}
            >
              <span>{label}</span>
              <span className="text-xs font-normal opacity-70 tabular-nums">
                {formatDelay(preview[rating])}
              </span>
              <kbd className="mt-0.5 hidden text-[10px] font-normal opacity-50 sm:block">
                {key}
              </kbd>
            </button>
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="w-full rounded-lg bg-accent px-4 py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Mostrar resposta
          <span className="ml-2 hidden text-xs font-normal opacity-70 sm:inline">
            espaço
          </span>
        </button>
      )}
    </div>
  );
}

function SessionDone({ reviewed, deckName }: { reviewed: number; deckName?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-8 text-center">
      <p className="jp text-4xl">お疲れさま！</p>
      <p className="mt-3 font-medium">
        {reviewed > 0
          ? `${reviewed} ${reviewed === 1 ? "card revisado" : "cards revisados"}.`
          : "Nada vencido por aqui."}
      </p>
      <p className="mt-1 text-sm text-muted">
        {reviewed > 0
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
