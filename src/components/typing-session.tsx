"use client";

import { useRef, useState } from "react";
import type { DetalhesRevisao } from "@/app/actions";
import { SEPARADOR_LEITURAS } from "@/lib/kana";
import { kanaParaRomaji, kanaParcial, verificarResposta } from "@/lib/romaji";
import type { CardEstudo } from "@/lib/server/study";
import type { Rating } from "@/lib/srs";
import { useSessaoEstudo } from "@/lib/use-sessao-estudo";
import { SessionDone } from "./session-done";

/**
 * Modo digitação: a palavra aparece em japonês e a pessoa escreve o romaji.
 *
 * Diferente do flashcard, aqui a nota é objetiva — ou a leitura está certa, ou
 * não está. Acertar de primeira vale "Bom"; errar ou pedir a resposta antes
 * vale "De novo". Não há botões de auto-avaliação: o teclado já respondeu.
 *
 * Mesmo depois de errar é preciso digitar a palavra certa para seguir. Esse
 * passo não gera outra revisão — ele existe para fixar a escrita, que é o
 * ponto do modo.
 */

type Fase = "digitando" | "corrigindo" | "conferido";

export function TypingSession({
  filaInicial,
  deckName,
}: {
  filaInicial: CardEstudo[];
  deckName?: string;
}) {
  const { atual, fila, revisados, salvando, erro, responder } =
    useSessaoEstudo(filaInicial);

  /**
   * O card congelado enquanto o resultado está na tela.
   *
   * Responder avança a fila na hora; sem este retrato a tela pularia para a
   * próxima palavra antes de mostrar se a resposta estava certa.
   */
  const [congelado, setCongelado] = useState<CardEstudo | null>(null);
  /** Cada avanço começa uma rodada nova — e é a chave que zera o formulário. */
  const [rodada, setRodada] = useState(0);

  const card = congelado ?? atual;

  if (!card) {
    return <SessionDone revisados={revisados} deckName={deckName} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-muted tabular-nums">
        <span>{deckName ?? "Todos os decks"}</span>
        <span>
          {fila.length} na fila · {revisados} revisados
        </span>
      </div>

      {/* A chave zera o estado da rodada sem precisar sincronizar nada por
          efeito: avançar desmonta este formulário e monta outro, limpo. */}
      <Rodada
        key={rodada}
        card={card}
        salvando={salvando}
        erro={erro}
        aoResponder={async (rating, detalhes) => {
          setCongelado(card);
          const gravou = await responder(rating, detalhes);
          if (!gravou) setCongelado(null);
          return gravou;
        }}
        aoAvancar={() => {
          setCongelado(null);
          setRodada((n) => n + 1);
        }}
      />
    </div>
  );
}

function Rodada({
  card,
  salvando,
  erro,
  aoResponder,
  aoAvancar,
}: {
  card: CardEstudo;
  salvando: boolean;
  erro: string | null;
  aoResponder: (rating: Rating, detalhes: DetalhesRevisao) => Promise<boolean>;
  aoAvancar: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [fase, setFase] = useState<Fase>("digitando");
  const [acertou, setAcertou] = useState(false);
  /** Pediu para ver a resposta antes de tentar: a nota já está decidida. */
  const [pediuAjuda, setPediuAjuda] = useState(false);

  const campo = useRef<HTMLInputElement>(null);

  // A primeira alternativa é a que aparece como resposta esperada; qualquer
  // uma delas é aceita na conferência.
  const romajiEsperado = kanaParaRomaji(card.reading.split(SEPARADOR_LEITURAS)[0]);

  async function conferir() {
    if (salvando) return;

    const veredito = verificarResposta(texto, card.reading);

    // Já respondeu por este card: daqui em diante é treino de escrita, sem
    // nova revisão. Acertando, libera o avanço.
    if (fase === "corrigindo") {
      if (veredito.acertou) setFase("conferido");
      else setTexto("");
      return;
    }

    const certo = veredito.acertou && !pediuAjuda;
    setAcertou(certo);

    const gravou = await aoResponder(certo ? "good" : "again", {
      modo: "digitacao",
      // Só guardamos o que foi digitado quando saiu errado: é esse dado que
      // depois mostra quais confusões se repetem.
      resposta: veredito.acertou ? undefined : texto,
    });
    if (!gravou) return;

    if (certo) {
      setFase("conferido");
    } else {
      // Errou: mostra a resposta e exige a digitação correta antes de seguir.
      setFase("corrigindo");
      setTexto("");
    }
  }

  async function revelar() {
    if (salvando) return;

    setPediuAjuda(true);
    setAcertou(false);
    setFase("corrigindo");
    setTexto("");

    await aoResponder("again", { modo: "digitacao" });
    campo.current?.focus();
  }

  function aoTeclar(evento: React.KeyboardEvent<HTMLInputElement>) {
    // Enquanto o IME compõe, Enter confirma a conversão do próprio IME e não
    // deve ser lido como "enviar resposta".
    if (evento.nativeEvent.isComposing) return;
    if (evento.key !== "Enter") return;

    evento.preventDefault();
    if (fase === "conferido") aoAvancar();
    else void conferir();
  }

  return (
    <>
      <article className="rounded-xl border border-border bg-surface">
        <div className="flex min-h-40 flex-col items-center justify-center gap-2 p-8 text-center">
          <p className="jp text-6xl font-medium leading-tight">{card.front}</p>
          {fase !== "digitando" && (
            <p className="mt-2 text-base font-medium">{card.meaning}</p>
          )}
        </div>

        {fase !== "digitando" && (
          <div
            className={`border-t p-4 text-center ${
              acertou ? "border-border" : "border-accent/30 bg-accent-soft"
            }`}
          >
            <p className="text-xs uppercase tracking-wide text-muted">
              {acertou ? "Você acertou" : "A resposta era"}
            </p>
            <p className="jp mt-1 text-2xl">{card.reading}</p>
            <p className="mt-0.5 text-sm text-muted">{romajiEsperado}</p>
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

      <div>
        <label htmlFor="resposta" className="sr-only">
          Digite a leitura em romaji
        </label>
        <input
          id="resposta"
          ref={campo}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={aoTeclar}
          disabled={fase === "conferido" || salvando}
          placeholder={fase === "corrigindo" ? "digite para fixar" : "digite em romaji"}
          // O teclado do celular sabota romaji: maiúscula automática no início
          // e autocorreção trocando "ka" por outra palavra.
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          inputMode="text"
          // O foco precisa voltar a cada palavra, senão o ritmo da sessão
          // quebra: sem isto seria preciso clicar no campo a cada card.
          autoFocus
          className={`w-full rounded-lg border bg-surface px-4 py-3 text-center text-lg outline-none transition-colors disabled:opacity-60 ${
            fase === "digitando"
              ? "border-border focus:border-accent"
              : acertou
                ? "border-success"
                : "border-accent"
          }`}
        />

        {/* Eco do kana enquanto digita: é aqui que se aprende que "sha" é uma
            sílaba só, e não três letras. */}
        <p className="jp mt-2 h-6 text-center text-lg text-muted">
          {fase === "conferido" ? "" : kanaParcial(texto)}
        </p>
      </div>

      {fase === "conferido" ? (
        <button
          type="button"
          onClick={aoAvancar}
          className="w-full rounded-lg bg-accent px-4 py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Próxima
          <span className="ml-2 hidden text-xs font-normal opacity-70 sm:inline">
            enter
          </span>
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => void revelar()}
            disabled={fase === "corrigindo" || salvando}
            className="rounded-lg border border-border bg-surface-muted px-4 py-3 text-sm font-semibold transition-colors hover:border-accent disabled:opacity-40"
          >
            Exibir resposta
          </button>
          <button
            type="button"
            onClick={() => void conferir()}
            disabled={texto.trim().length === 0 || salvando}
            className="rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {fase === "corrigindo" ? "Confirmar" : "Conferir"}
          </button>
        </div>
      )}
    </>
  );
}
