"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  carregarCardParaEdicao,
  excluirCard,
  limparImagem,
} from "@/app/cards/actions";
import type { CardSalvo } from "@/lib/card-form";
import type { CardParaEditar, DeckSimples } from "@/lib/server/cards";
import { CardForm } from "./card-form";

/**
 * Editar um card sem sair de onde se está.
 *
 * Existe por causa da sessão de estudo: a fila vive na memória do navegador, e
 * navegar até a tela de edição a perderia — você voltaria para o começo depois
 * de consertar uma vírgula. Na lista de cards o ganho é menor, mas a tela é a
 * mesma, e duas telas de edição acabariam divergindo.
 *
 * Usa o `<dialog>` nativo em vez de uma `div` sobreposta: o Esc fecha, o foco
 * fica preso dentro e o resto da página vira inerte de graça. Recriar isso à
 * mão é onde nascem os modais que o leitor de tela atravessa.
 */

export function ModalEditarCard({
  cardId,
  aoFechar,
  aoSalvar,
  aoExcluir,
}: {
  /** `null` mantém o modal fechado. */
  cardId: string | null;
  aoFechar: () => void;
  /** O card gravado, para a tela de trás se atualizar sem recarregar. */
  aoSalvar?: (salvo: CardSalvo) => void;
  aoExcluir?: (id: string) => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);

  // Abrir e fechar é imperativo porque `showModal()` não tem equivalente
  // declarativo: só ele torna o resto da página inerte e prende o foco.
  useEffect(() => {
    const el = dialogo.current;
    if (!el) return;
    if (cardId && !el.open) el.showModal();
    if (!cardId && el.open) el.close();
  }, [cardId]);

  return (
    <dialog
      ref={dialogo}
      // `close` cobre o Esc e o clique no backdrop, que não passam por
      // nenhum botão nosso — sem isto o modal fecharia visualmente e quem o
      // abriu continuaria achando que está aberto.
      onClose={aoFechar}
      onClick={(e) => {
        // Clique no backdrop chega no próprio <dialog>; no conteúdo, não.
        if (e.target === dialogo.current) dialogo.current?.close();
      }}
      className="m-auto w-[min(34rem,92vw)] rounded-xl border border-border bg-surface p-0 text-foreground backdrop:bg-black/40"
    >
      {/* Montado só quando há card, e com `key`: trocar de card monta outro
          conteúdo, já vazio, em vez de zerar o estado do anterior por efeito.
          Zerar por efeito custa uma renderização a mais com o card errado na
          tela — e é o que a regra do React Compiler proíbe. */}
      {cardId && (
        <ConteudoDoModal
          key={cardId}
          cardId={cardId}
          aoFechar={() => dialogo.current?.close()}
          aoSalvar={(salvo) => {
            aoSalvar?.(salvo);
            dialogo.current?.close();
          }}
          aoExcluir={() => {
            aoExcluir?.(cardId);
            dialogo.current?.close();
          }}
        />
      )}
    </dialog>
  );
}

type Carga =
  | { estado: "carregando" }
  | { estado: "erro" }
  | { estado: "pronto"; card: CardParaEditar; decks: DeckSimples[] };

function ConteudoDoModal({
  cardId,
  aoFechar,
  aoSalvar,
  aoExcluir,
}: {
  cardId: string;
  aoFechar: () => void;
  aoSalvar: (salvo: CardSalvo) => void;
  aoExcluir: () => void;
}) {
  const [carga, setCarga] = useState<Carga>({ estado: "carregando" });

  // Buscar ao abrir, e não antes: a sessão de estudo não carrega exemplo,
  // etiquetas nem termo de imagem, e puxar isso de toda a fila para o caso de
  // alguém editar um card seria pagar adiantado por quase nada.
  useEffect(() => {
    let cancelado = false;
    carregarCardParaEdicao(cardId).then(
      (r) => {
        if (cancelado) return;
        setCarga(r ? { estado: "pronto", ...r } : { estado: "erro" });
      },
      () => {
        if (!cancelado) setCarga({ estado: "erro" });
      },
    );
    return () => {
      cancelado = true;
    };
  }, [cardId]);

  return (
    <div className="max-h-[85vh] overflow-y-auto p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 className="jp text-xl font-semibold">
          {carga.estado === "pronto" ? carga.card.front : "Editar card"}
        </h2>
        <button
          type="button"
          onClick={aoFechar}
          aria-label="Fechar"
          className="rounded px-2 text-xl leading-none text-muted hover:text-foreground"
        >
          ×
        </button>
      </div>

      {carga.estado === "carregando" && (
        <p className="text-sm text-muted">Carregando…</p>
      )}

      {carga.estado === "erro" && (
        <p role="alert" className="text-sm text-accent">
          Não consegui carregar este card. Talvez ele já tenha sido excluído.
        </p>
      )}

      {carga.estado === "pronto" && (
        <>
          <p className="mb-4 text-sm text-muted tabular-nums">
            {carga.card.revisoes === 0
              ? "Ainda não estudado."
              : `${carga.card.revisoes} ${carga.card.revisoes === 1 ? "revisão" : "revisões"} no histórico.`}
          </p>

          <CardForm
            decks={carga.decks}
            card={carga.card}
            aoSalvar={aoSalvar}
            aoCancelar={aoFechar}
          />

          {carga.card.imagePath && (
            <ImagemAtual
              card={carga.card}
              aoLimpar={() =>
                setCarga({ ...carga, card: { ...carga.card, imagePath: null } })
              }
            />
          )}

          <Excluir card={carga.card} aoExcluir={aoExcluir} />
        </>
      )}
    </div>
  );
}

function ImagemAtual({
  card,
  aoLimpar,
}: {
  card: CardParaEditar;
  aoLimpar: () => void;
}) {
  return (
    <section className="mt-5 border-t border-border pt-4">
      <h3 className="text-sm font-semibold">Imagem atual</h3>
      <div className="mt-2 flex items-center gap-3">
        <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-surface-muted">
          <Image
            src={card.imagePath!}
            alt={card.meaning}
            fill
            sizes="7rem"
            className="object-cover"
          />
        </div>
        <div className="min-w-0 text-sm">
          <p className="truncate text-muted">{card.imageCredit}</p>
          <form
            action={async (form) => {
              await limparImagem(form);
              aoLimpar();
            }}
            className="mt-1.5"
          >
            <input type="hidden" name="id" value={card.id} />
            <button
              type="submit"
              className="rounded-lg border border-border px-2.5 py-1 text-xs hover:border-accent"
            >
              Descartar imagem
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

function Excluir({
  card,
  aoExcluir,
}: {
  card: CardParaEditar;
  aoExcluir: () => void;
}) {
  const [confirmando, setConfirmando] = useState(false);

  return (
    <section className="mt-5 border-t border-border pt-4">
      {!confirmando ? (
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className="text-sm text-muted hover:text-accent"
        >
          Excluir card
        </button>
      ) : (
        <div className="rounded-lg border border-accent/30 bg-accent-soft p-3">
          <p className="text-sm">
            {card.revisoes === 0
              ? "Nunca estudado: não há histórico a perder."
              : `As ${card.revisoes} revisões dele são apagadas junto, e não dá para desfazer.`}
          </p>
          <div className="mt-2 flex items-center gap-3">
            <form
              action={async (form) => {
                await excluirCard(form);
                aoExcluir();
              }}
            >
              <input type="hidden" name="id" value={card.id} />
              <button
                type="submit"
                className="rounded-lg border border-accent px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent hover:text-white"
              >
                Excluir definitivamente
              </button>
            </form>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="text-sm text-muted hover:underline"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
