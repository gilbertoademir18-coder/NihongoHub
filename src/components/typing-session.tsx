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
import { ImagemDoCard } from "./imagem-do-card";
import { SessionDone } from "./session-done";

/**
 * Modo digitação: a palavra aparece em japonês e a pessoa escreve o romaji.
 *
 * A sessão inteira se faz com o teclado. A resposta é conferida a cada tecla —
 * assim que o que foi escrito fecha a palavra, ou deixa de poder fechá-la, o
 * resultado aparece. Ele fica na tela até o enter, que traz a próxima palavra:
 * o ritmo é seu.
 *
 * Errando, ou pedindo a resposta, a palavra certa aparece e é **preciso
 * escrevê-la** para seguir. Essa digitação não gera outra revisão — a nota já
 * foi dada — e existe para fixar a escrita no momento em que ela falhou, que é
 * quando isso vale alguma coisa.
 *
 * Não há botão de confirmar nem de avaliar: acertar de primeira vale "Bom",
 * errar ou pedir a resposta vale "De novo".
 */

/**
 * `digitando` é a tentativa; `corrigindo` é a cópia depois do erro; `pronto`
 * é o estado em que o enter leva à próxima palavra.
 */
type Fase = "digitando" | "corrigindo" | "pronto";

export function TypingSession({
  filaInicial,
  deckName,
  treino = false,
  linkTreino,
}: {
  filaInicial: CardEstudo[];
  deckName?: string;
  /** Treino livre: registra, mas não reagenda nada. */
  treino?: boolean;
  /** Para onde ir ao terminar, se houver o que treinar. */
  linkTreino?: string;
}) {
  const { atual, fila, revisados, salvando, erro, responder } = useSessaoEstudo(
    filaInicial,
    { treino },
  );

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
    return (
      <SessionDone
        revisados={revisados}
        deckName={deckName}
        treino={treino}
        linkTreino={linkTreino}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-muted tabular-nums">
        <span className="flex items-center gap-2">
          {deckName ?? "Todos os decks"}
          {treino && (
            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-medium not-tabular-nums">
              treino livre
            </span>
          )}
        </span>
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
  const [fase, setFase] = useState<Fase>("digitando");
  /** Como foi a tentativa — o que decide a nota e a cor do resultado. */
  const [acertou, setAcertou] = useState(false);

  const campo = useRef<HTMLInputElement>(null);

  // A primeira alternativa é a que aparece como resposta esperada; qualquer
  // uma delas é aceita na conferência.
  const leituraPrincipal = card.reading.split(SEPARADOR_LEITURAS)[0];
  const romajiEsperado = kanaParaRomaji(leituraPrincipal);

  /** Registra a tentativa. Só acontece uma vez por palavra. */
  async function registrar(certo: boolean, digitado: string) {
    setAcertou(certo);
    setFase(certo ? "pronto" : "corrigindo");
    if (!certo) setTexto("");

    const gravou = await aoResponder(certo ? "good" : "again", {
      modo: "digitacao",
      // Só guardamos o que foi digitado quando saiu errado: é esse dado que
      // depois mostra quais confusões se repetem.
      resposta: certo ? undefined : digitado,
    });

    // Falhou ao gravar: volta a digitar, em vez de mostrar um resultado que
    // não chegou ao banco.
    if (!gravou) setFase("digitando");
  }

  function aoDigitar(valor: string) {
    if (fase === "pronto") return;
    setTexto(valor);

    const estado = avaliarDigitacao(valor, card.reading);

    // Copiando a resposta depois do erro: acertar aqui apenas libera o avanço.
    // A nota já foi dada, e digitar certo agora não a melhora.
    if (fase === "corrigindo") {
      if (estado === "acertou") setFase("pronto");
      else if (estado === "errou") setTexto("");
      return;
    }

    // Tentativa: a palavra fechou, ou deixou de poder fechar.
    if (estado === "acertou") void registrar(true, valor);
    else if (estado === "errou") void registrar(false, valor);
  }

  async function revelar() {
    if (fase !== "digitando" || salvando) return;

    // Ver a resposta sem tentar conta como não saber — e ainda assim é preciso
    // escrevê-la para seguir.
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

    if (fase === "pronto") {
      aoAvancar();
      return;
    }

    // Em correção o enter não adianta: a palavra certa precisa ser escrita.
    if (fase === "corrigindo") return;

    // Enter com a palavra ainda pela metade: vale como desistir da tentativa,
    // para quem prefere confirmar em vez de continuar digitando.
    if (texto.trim().length > 0) {
      void registrar(verificarResposta(texto, card.reading).acertou, texto);
    }
  }

  const mostrandoResposta = fase !== "digitando";

  return (
    <>
      <article className="rounded-xl border border-border bg-surface">
        <div className="flex min-h-40 flex-col items-center justify-center gap-2 p-8 text-center">
          <p className="jp text-6xl font-medium leading-tight">{card.front}</p>
        </div>

        {mostrandoResposta && (
          <div
            className={`border-t p-4 text-center ${
              acertou ? "border-success/40 bg-success/10" : "border-accent/30 bg-accent-soft"
            }`}
          >
            {/* A imagem entra aqui, e não junto da palavra: ver a foto antes
                de responder entregaria o significado, e o exercício deixaria
                de ser ler o kana para virar reconhecer o desenho. Depois da
                resposta ela só reforça o que já foi decidido. */}
            {card.imagePath && (
              <ImagemDoCard
                src={card.imagePath}
                alt={card.meaning}
                credito={card.imageCredit}
              />
            )}
            {/* Sem rótulo: a cor do bloco já diz se acertou ou errou, e o
                campo de digitação fica vazio depois do erro — não há o que
                confundir com a resposta certa. */}
            <p className="jp text-2xl">{card.reading}</p>
            <p className="mt-0.5 text-sm text-muted">{romajiEsperado}</p>
            <p
              className={`mt-1 font-medium ${
                acertou ? "text-success" : "text-foreground"
              }`}
            >
              {card.meaning}
            </p>
            {fase === "corrigindo" && (
              <p className="mt-2 text-xs text-muted">
                Escreva a palavra para continuar
              </p>
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
          // Só trava quando não há mais nada a fazer além de avançar. Na
          // correção o campo segue vivo — é nele que a palavra é fixada.
          readOnly={fase === "pronto"}
          placeholder={fase === "corrigindo" ? "escreva a resposta" : "digite em romaji"}
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
            fase === "digitando"
              ? "border-border focus:border-accent"
              : acertou
                ? "border-success"
                : "border-accent"
          }`}
        />

        {/* Eco do kana enquanto digita: é aqui que se aprende que "sha" é uma
            sílaba só, e não três letras. Continua na correção, que é quando
            copiar a palavra tem mais a ensinar. */}
        <p className="jp mt-2 h-6 text-center text-lg text-muted">
          {fase === "pronto" ? "" : kanaParcial(texto)}
        </p>
      </div>

      {fase === "digitando" ? (
        <button
          type="button"
          onClick={() => void revelar()}
          disabled={salvando}
          className="w-full rounded-lg border border-border bg-surface-muted px-4 py-3 text-sm font-semibold transition-colors hover:border-accent disabled:opacity-40"
        >
          Não sei — exibir resposta
        </button>
      ) : (
        <button
          type="button"
          onClick={aoAvancar}
          // Em correção o avanço fica visível mas travado: é a palavra escrita
          // que o destrava, não o clique.
          disabled={fase === "corrigindo"}
          className="w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Próxima
          <span className="ml-2 text-xs font-normal opacity-70">enter</span>
        </button>
      )}
    </>
  );
}
