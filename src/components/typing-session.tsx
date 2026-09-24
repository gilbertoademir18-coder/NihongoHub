"use client";

import { useRef, useState } from "react";
import type { DetalhesRevisao } from "@/app/actions";
import { SEPARADOR_LEITURAS } from "@/lib/kana";
import {
  avaliarDigitacao,
  kanaParaRomaji,
  kanaParcial,
  verificarResposta,
} from "@/lib/romaji";
import type { CardEstudo } from "@/lib/server/study";
import type { Rating } from "@/lib/srs";
import { useSessaoEstudo } from "@/lib/use-sessao-estudo";
import { SessionDone } from "./session-done";

/**
 * Modo digitação: a palavra aparece em japonês e a pessoa escreve o romaji.
 *
 * A sessão inteira se faz com o teclado. A resposta é conferida a cada tecla —
 * assim que o que foi escrito fecha a palavra, ou deixa de poder fechá-la, o
 * resultado aparece. Ele fica na tela até você apertar enter, que é o que
 * traz a próxima palavra: o ritmo é seu, e dá tempo de olhar a resposta certa
 * quando o erro foi por pouco.
 *
 * Não há botão de confirmar nem de avaliar: acertar de primeira vale "Bom",
 * errar ou pedir a resposta vale "De novo".
 */

type Resultado = "acertou" | "errou" | "revelado";

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
          efeito: avançar desmonta este formulário e monta outro, limpo — com
          o foco já no campo. */}
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
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const campo = useRef<HTMLInputElement>(null);

  // A primeira alternativa é a que aparece como resposta esperada; qualquer
  // uma delas é aceita na conferência.
  const leituraPrincipal = card.reading.split(SEPARADOR_LEITURAS)[0];
  const romajiEsperado = kanaParaRomaji(leituraPrincipal);

  async function registrar(acertou: boolean, digitado: string) {
    setResultado(acertou ? "acertou" : "errou");

    const gravou = await aoResponder(acertou ? "good" : "again", {
      modo: "digitacao",
      // Só guardamos o que foi digitado quando saiu errado: é esse dado que
      // depois mostra quais confusões se repetem.
      resposta: acertou ? undefined : digitado,
    });

    // Falhou ao gravar: volta ao estado de digitação para a pessoa tentar de
    // novo, em vez de mostrar um resultado que não chegou ao banco.
    if (!gravou) setResultado(null);
  }

  function aoDigitar(valor: string) {
    if (resultado !== null) return;
    setTexto(valor);

    // Confere a cada tecla: a palavra fechou, ou deixou de poder fechar.
    const estado = avaliarDigitacao(valor, card.reading);
    if (estado === "acertou") void registrar(true, valor);
    else if (estado === "errou") void registrar(false, valor);
  }

  async function revelar() {
    if (resultado !== null || salvando) return;

    setResultado("revelado");
    await aoResponder("again", { modo: "digitacao" });
    // O foco volta ao campo para que o enter seguinte já avance, sem precisar
    // clicar de novo depois de usar o botão.
    campo.current?.focus();
  }

  function aoTeclar(evento: React.KeyboardEvent<HTMLInputElement>) {
    // Enquanto o IME compõe, Enter confirma a conversão do próprio IME e não
    // deve ser lido como "enviar resposta".
    if (evento.nativeEvent.isComposing) return;
    if (evento.key !== "Enter") return;
    evento.preventDefault();

    // Com o resultado na tela, enter é o que traz a próxima palavra.
    if (resultado !== null) {
      aoAvancar();
      return;
    }

    // Enter com a palavra ainda pela metade: vale como desistir da tentativa,
    // para quem prefere confirmar em vez de continuar digitando.
    if (texto.trim().length > 0) {
      void registrar(verificarResposta(texto, card.reading).acertou, texto);
    }
  }

  const acertou = resultado === "acertou";
  const mostrandoResposta = resultado !== null;

  return (
    <>
      <article className="rounded-xl border border-border bg-surface">
        <div className="flex min-h-40 flex-col items-center justify-center gap-2 p-8 text-center">
          <p className="jp text-6xl font-medium leading-tight">{card.front}</p>
          {mostrandoResposta && (
            <p className="mt-2 text-base font-medium">{card.meaning}</p>
          )}
        </div>

        {mostrandoResposta && (
          <div
            className={`border-t p-4 text-center ${
              acertou ? "border-success/40 bg-success/10" : "border-accent/30 bg-accent-soft"
            }`}
          >
            <p
              className={`text-xs font-semibold uppercase tracking-wide ${
                acertou ? "text-success" : "text-accent"
              }`}
            >
              {acertou ? "Certo" : "A resposta era"}
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
          onChange={(e) => aoDigitar(e.target.value)}
          onKeyDown={aoTeclar}
          // `readOnly` em vez de `disabled`: o campo para de aceitar texto mas
          // mantém o foco, e a próxima palavra já entra pronta para digitar.
          readOnly={mostrandoResposta}
          placeholder="digite em romaji"
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
          className={`w-full rounded-lg border bg-surface px-4 py-3 text-center text-lg outline-none transition-colors ${
            resultado === null
              ? "border-border focus:border-accent"
              : acertou
                ? "border-success"
                : "border-accent"
          }`}
        />

        {/* Eco do kana enquanto digita: é aqui que se aprende que "sha" é uma
            sílaba só, e não três letras. */}
        <p className="jp mt-2 h-6 text-center text-lg text-muted">
          {mostrandoResposta ? "" : kanaParcial(texto)}
        </p>
      </div>

      {mostrandoResposta ? (
        <button
          type="button"
          onClick={aoAvancar}
          className="w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Próxima
          <span className="ml-2 text-xs font-normal opacity-70">enter</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void revelar()}
          disabled={mostrandoResposta || salvando}
          className="w-full rounded-lg border border-border bg-surface-muted px-4 py-3 text-sm font-semibold transition-colors hover:border-accent disabled:opacity-40"
        >
          Não sei — exibir resposta
        </button>
      )}
    </>
  );
}
