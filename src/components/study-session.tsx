"use client";

import { useEffect, useState } from "react";
import type { CardEstudo } from "@/lib/server/study";
import { type Rating, formatDelay, previewIntervals } from "@/lib/srs";
import { useSessaoEstudo } from "@/lib/use-sessao-estudo";
import { SessionDone } from "./session-done";

/**
 * Modo flashcard: revela a resposta e a pessoa se auto-avalia.
 *
 * A mecânica da sessão (fila, cronômetro, reinserção) vive em
 * `useSessaoEstudo`. Aqui fica só o que é próprio deste modo.
 */

const AVALIACOES: {
  rating: Rating;
  label: string;
  tecla: string;
  className: string;
}[] = [
  {
    rating: "again",
    label: "De novo",
    tecla: "1",
    className: "border-accent/30 bg-accent-soft text-accent hover:border-accent",
  },
  {
    rating: "hard",
    label: "Difícil",
    tecla: "2",
    className: "border-border bg-surface-muted hover:border-warning",
  },
  {
    rating: "good",
    label: "Bom",
    tecla: "3",
    className: "border-border bg-surface-muted hover:border-success",
  },
  {
    rating: "easy",
    label: "Fácil",
    tecla: "4",
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
  const sessao = useSessaoEstudo(filaInicial);
  const [revelado, setRevelado] = useState(false);

  const { atual, fila, revisados, salvando, erro, responder } = sessao;

  async function avaliar(rating: Rating) {
    const gravou = await responder(rating, { modo: "flashcard" });
    if (gravou) setRevelado(false);
  }

  // Atalhos de teclado: espaço revela, 1–4 avaliam. Estudar com as mãos no
  // teclado é bem mais rápido do que mirar em botões.
  useEffect(() => {
    if (!atual) return;

    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.metaKey || evento.ctrlKey || evento.altKey) return;

      if (!revelado) {
        if (evento.key === " " || evento.key === "Enter") {
          evento.preventDefault();
          setRevelado(true);
        }
        return;
      }

      const escolhida = AVALIACOES.find((a) => a.tecla === evento.key);
      if (escolhida) {
        evento.preventDefault();
        void avaliar(escolhida.rating);
      }
    };

    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
    // `avaliar` fecha sobre `responder`, que já é estável por card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atual, revelado, responder]);

  if (!atual) {
    return <SessionDone revisados={revisados} deckName={deckName} />;
  }

  const previsao = previewIntervals(atual.srs);
  const mostrarLeitura = atual.reading && atual.reading !== atual.front;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-muted tabular-nums">
        <span>{deckName ?? "Todos os decks"}</span>
        <span>
          {fila.length} na fila · {revisados} revisados
        </span>
      </div>

      <article className="rounded-xl border border-border bg-surface">
        {/* Frente: só o japonês, sem nada que entregue a resposta. */}
        <div className="flex min-h-48 flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="jp text-6xl font-medium leading-tight">{atual.front}</p>
          {revelado && mostrarLeitura && (
            <p className="jp text-xl text-accent">{atual.reading}</p>
          )}
        </div>

        {revelado && (
          <div className="space-y-3 border-t border-border p-5 text-center">
            <p className="text-lg font-medium">{atual.meaning}</p>
            {atual.example && (
              <div className="rounded-lg bg-surface-muted p-3">
                <p className="jp text-base">{atual.example}</p>
                {atual.exampleMeaning && (
                  <p className="mt-1 text-sm text-muted">{atual.exampleMeaning}</p>
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

      {revelado ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {AVALIACOES.map(({ rating, label, tecla, className }) => (
            <button
              key={rating}
              type="button"
              disabled={salvando}
              onClick={() => void avaliar(rating)}
              className={`flex flex-col items-center gap-0.5 rounded-lg border px-3 py-3 text-sm font-semibold transition-colors disabled:opacity-50 ${className}`}
            >
              <span>{label}</span>
              <span className="text-xs font-normal opacity-70 tabular-nums">
                {formatDelay(previsao[rating])}
              </span>
              <kbd className="mt-0.5 hidden text-[10px] font-normal opacity-50 sm:block">
                {tecla}
              </kbd>
            </button>
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setRevelado(true)}
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
