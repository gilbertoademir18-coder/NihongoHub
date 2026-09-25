"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { salvarCard } from "@/app/cards/actions";
import {
  type CardSalvo,
  ESTADO_INICIAL,
  type EstadoDoForm,
  scriptDoCard,
} from "@/lib/card-form";
import { SEPARADOR_LEITURAS } from "@/lib/kana";
import { kanaParaRomaji } from "@/lib/romaji";
import type { CardParaEditar } from "@/lib/server/cards";
import type { DeckSimples } from "@/lib/server/cards";

/**
 * Formulário de card, usado tanto para cadastrar quanto para editar.
 *
 * Um componente só porque os dois pedem exatamente os mesmos campos: o que
 * muda é haver um `id` escondido, e é o servidor que decide criar ou atualizar
 * a partir dele. Dois formulários iguais acabariam divergindo no primeiro
 * campo novo.
 */

const NOMES: Record<string, string> = {
  hiragana: "hiragana",
  katakana: "katakana",
};

export function CardForm({
  decks,
  card,
  deckPadrao,
  aoSalvar,
  aoCancelar,
}: {
  decks: DeckSimples[];
  /** Ausente = cadastro novo. */
  card?: CardParaEditar;
  deckPadrao?: string;
  /**
   * Presente = o formulário está num modal.
   *
   * Sem isto, salvar termina em `redirect`. Num modal não há para onde ir: a
   * tela de trás continua lá, e pode ser uma sessão de estudo cuja fila vive
   * na memória — navegar a perderia.
   */
  aoSalvar?: (salvo: CardSalvo) => void;
  /** Fechar o modal sem gravar. Ignorado fora dele. */
  aoCancelar?: () => void;
}) {
  const emModal = Boolean(aoSalvar);

  // O aviso ao pai sai de dentro da própria ação, e não de um efeito que
  // observa o estado: efeito rodaria de novo a cada renderização com o mesmo
  // estado, e fechar o modal duas vezes é o tipo de bug que só aparece depois.
  const [estado, enviar, enviando] = useActionState<EstadoDoForm, FormData>(
    async (anterior, form) => {
      const resultado = await salvarCard(anterior, form);
      if (resultado.salvo) aoSalvar?.(resultado.salvo);
      return resultado;
    },
    ESTADO_INICIAL,
  );

  // A frente fica em estado só para alimentar a prévia abaixo — o valor que
  // conta é o do próprio campo, lido do FormData no servidor.
  const [front, setFront] = useState(card?.front ?? "");
  const [reading, setReading] = useState(card?.reading ?? "");

  const script = scriptDoCard(front);
  const voltarPara = `/cards${card ? `?deck=${card.deckId}` : deckPadrao ? `?deck=${deckPadrao}` : ""}`;

  return (
    <form action={enviar} className="space-y-5">
      {card && <input type="hidden" name="id" value={card.id} />}
      <input type="hidden" name="contexto" value={emModal ? "modal" : "pagina"} />

      {estado.mensagem && (
        <p
          role="alert"
          className="rounded-lg border border-accent/40 bg-accent-soft px-3 py-2 text-sm text-accent"
        >
          {estado.mensagem}
        </p>
      )}

      <Campo rotulo="Deck" erro={estado.erros.deckId} para="deckId">
        <select
          id="deckId"
          name="deckId"
          defaultValue={card?.deckId ?? deckPadrao ?? decks[0]?.id ?? ""}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        >
          {decks.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} ({d.total})
            </option>
          ))}
        </select>
      </Campo>

      <Campo
        rotulo="Frente"
        erro={estado.erros.front}
        para="front"
        dica="O que aparece na tela: um kanji, uma palavra em kana ou uma expressão."
      >
        <input
          id="front"
          name="front"
          value={front}
          onChange={(e) => setFront(e.target.value)}
          className="jp w-full rounded-lg border border-border bg-surface px-3 py-2 text-lg"
          autoComplete="off"
        />
      </Campo>

      <Campo
        rotulo="Leitura em kana"
        erro={estado.erros.reading}
        para="reading"
        dica={`Só kana. Para leituras alternativas, separe com ${SEPARADOR_LEITURAS} — por exemplo にち${SEPARADOR_LEITURAS}ひ.`}
      >
        <input
          id="reading"
          name="reading"
          value={reading}
          onChange={(e) => setReading(e.target.value)}
          className="jp w-full rounded-lg border border-border bg-surface px-3 py-2 text-lg"
          autoComplete="off"
        />
      </Campo>

      <Previa front={front} reading={reading} script={script} />

      <Campo rotulo="Significado" erro={estado.erros.meaning} para="meaning">
        <input
          id="meaning"
          name="meaning"
          defaultValue={card?.meaning ?? ""}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          autoComplete="off"
        />
      </Campo>

      <Campo
        rotulo="Frase de exemplo"
        erro={estado.erros.example}
        para="example"
        dica="Opcional. Contexto ensina mais que tradução solta."
      >
        <input
          id="example"
          name="example"
          defaultValue={card?.example ?? ""}
          className="jp w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          autoComplete="off"
        />
      </Campo>

      <Campo
        rotulo="Tradução da frase"
        erro={estado.erros.exampleMeaning}
        para="exampleMeaning"
      >
        <input
          id="exampleMeaning"
          name="exampleMeaning"
          defaultValue={card?.exampleMeaning ?? ""}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          autoComplete="off"
        />
      </Campo>

      <Campo
        rotulo="Etiquetas"
        erro={estado.erros.tags}
        para="tags"
        dica="Separadas por vírgula."
      >
        <input
          id="tags"
          name="tags"
          defaultValue={card?.tags.join(", ") ?? ""}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          autoComplete="off"
        />
      </Campo>

      <Campo
        rotulo="Termo de busca da imagem"
        erro={estado.erros.imageQuery}
        para="imageQuery"
        dica="Deixe em branco para o card não ter imagem. A busca em si é feita depois, por npm run imagens."
      >
        <input
          id="imageQuery"
          name="imageQuery"
          defaultValue={card?.imageQuery ?? ""}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          autoComplete="off"
        />
      </Campo>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={enviando}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {enviando ? "Salvando..." : card ? "Salvar alterações" : "Cadastrar card"}
        </button>
        {emModal ? (
          <button
            type="button"
            onClick={aoCancelar}
            className="text-sm text-muted hover:underline"
          >
            Cancelar
          </button>
        ) : (
          <Link href={voltarPara} className="text-sm text-muted hover:underline">
            Cancelar
          </Link>
        )}
      </div>
    </form>
  );
}

/**
 * Como o card vai aparecer na sessão.
 *
 * Mostra o romaji e o silabário detectado porque os dois são consequência do
 * que foi digitado, e não campos: é aqui que se percebe que a leitura tem um
 * kana errado, antes de o card entrar na fila.
 */
function Previa({
  front,
  reading,
  script,
}: {
  front: string;
  reading: string;
  script: "hiragana" | "katakana" | null;
}) {
  const primeira = reading.split(SEPARADOR_LEITURAS)[0]?.trim() ?? "";
  let romaji = "";
  try {
    romaji = primeira ? kanaParaRomaji(primeira) : "";
  } catch {
    romaji = "";
  }

  if (!front && !reading) return null;

  return (
    <div className="rounded-lg border border-dashed border-border bg-surface-muted p-3 text-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Prévia</p>
      <p className="jp mt-1.5 text-2xl">{front || "—"}</p>
      {romaji && <p className="mt-0.5 text-muted">{romaji}</p>}
      <p className="mt-1.5 text-xs text-muted">
        {script
          ? `Entra nas sessões de ${NOMES[script]}.`
          : "Sem silabário próprio — fica fora dos filtros de hiragana e katakana."}
      </p>
    </div>
  );
}

function Campo({
  rotulo,
  para,
  erro,
  dica,
  children,
}: {
  rotulo: string;
  para: string;
  erro?: string;
  dica?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={para} className="mb-1 block text-sm font-medium">
        {rotulo}
      </label>
      {children}
      {dica && !erro && <p className="mt-1 text-xs text-muted">{dica}</p>}
      {erro && (
        <p role="alert" className="mt-1 text-xs text-accent">
          {erro}
        </p>
      )}
    </div>
  );
}
