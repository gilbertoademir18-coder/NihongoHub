"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CardDaLista } from "@/lib/server/cards";
import { ModalEditarCard } from "./modal-editar-card";

/**
 * A lista de cards de um deck, com a edição em modal.
 *
 * Cada item é um `<button>`, e não um link: ele não leva a lugar nenhum — abre
 * uma camada sobre a lista. Marcar como link faria o navegador prometer uma
 * navegação (abrir em nova aba, copiar endereço) que não existe.
 *
 * Depois de salvar, `router.refresh()` recarrega os Server Components: é o
 * servidor que sabe a ordem e a contagem, e refazer isso no cliente seria
 * manter duas verdades.
 */
export function ListaDeCards({ cards }: { cards: CardDaLista[] }) {
  const router = useRouter();
  const [editando, setEditando] = useState<string | null>(null);

  return (
    <>
      <ul className="space-y-2">
        {cards.map((card) => (
          <li key={card.id}>
            <button
              type="button"
              onClick={() => setEditando(card.id)}
              className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface p-3 text-left transition-colors hover:border-accent"
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
            </button>
          </li>
        ))}
      </ul>

      <ModalEditarCard
        cardId={editando}
        aoFechar={() => setEditando(null)}
        aoSalvar={() => router.refresh()}
        aoExcluir={() => router.refresh()}
      />
    </>
  );
}
