"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { salvarCard } from "@/app/cards/actions";
import {
  type CardSalvo,
  ESTADO_INICIAL,
  type EstadoDoForm,
  scriptDoCard,
} from "@/lib/card-form";
import { TIPOS_ACEITOS } from "@/lib/imagem";
import { ImagemRecusada, prepararImagem } from "@/lib/imagem-cliente";
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

/**
 * Busca de imagens no Google, pelo termo que for.
 *
 * São dois links, e não um, porque nenhum dos dois ganha sempre. Em japonês o
 * resultado é culturalmente certo — `ごはん` devolve a tigela de arroz
 * japonesa, onde "arroz" devolveria um saco de grãos. Mas kana curto é escrita
 * fonética e colide com nome próprio: `あい` (amor) devolve só gente famosa
 * chamada Ai, e aí é a tradução que salva.
 *
 * Qual serve depende da palavra, e descobrir isso de olho custa um clique.
 * Escolher por você custaria a imagem errada.
 *
 * `udm=2` é a aba de imagens — o antigo `tbm=isch` ainda funciona, mas é
 * reescrito no caminho.
 */
function buscaNoGoogle(termo: string) {
  return `https://www.google.com/search?udm=2&q=${encodeURIComponent(termo.trim())}`;
}

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
      // A imagem encolhe aqui, antes de virar requisição: foto de celular tem
      // megabytes, e Server Action recusa corpo grande com um erro do
      // framework — sem campo, sem explicação e sem culpa aparente.
      const escolhido = form.get("imagem");
      if (escolhido instanceof File && escolhido.size > 0) {
        try {
          form.set("imagem", await prepararImagem(escolhido));
        } catch (erro) {
          const motivo =
            erro instanceof ImagemRecusada
              ? erro.message
              : "Não consegui preparar esta imagem.";
          return { ...anterior, erros: { imagem: motivo } };
        }
      }

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
  // Em estado só para alimentar o link de busca pela tradução.
  const [meaning, setMeaning] = useState(card?.meaning ?? "");

  // A imagem escolhida ainda não subiu: é só o arquivo local, para ver o que
  // vai ser enviado antes de enviar.
  const [previa, setPrevia] = useState<{ url: string; nome: string } | null>(null);
  const [removida, setRemovida] = useState(false);
  const urlDaPrevia = useRef<string | null>(null);
  const campoArquivo = useRef<HTMLInputElement>(null);

  // `createObjectURL` prende o arquivo na memória até alguém devolvê-lo.
  function trocarPrevia(arquivo: File | null) {
    if (urlDaPrevia.current) URL.revokeObjectURL(urlDaPrevia.current);
    urlDaPrevia.current = arquivo ? URL.createObjectURL(arquivo) : null;
    setPrevia(arquivo && urlDaPrevia.current ? { url: urlDaPrevia.current, nome: arquivo.name } : null);
  }

  useEffect(() => {
    return () => {
      if (urlDaPrevia.current) URL.revokeObjectURL(urlDaPrevia.current);
    };
  }, []);

  const script = scriptDoCard(front);
  const imagemAtual = removida ? null : (card?.imagePath ?? null);
  const mostrada = previa?.url ?? imagemAtual;
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
          value={meaning}
          onChange={(e) => setMeaning(e.target.value)}
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

      <section className="space-y-3 rounded-lg border border-border p-3">
        <h3 className="text-sm font-medium">Imagem</h3>
        {/* Marca a remoção em vez de executá-la na hora: assim tudo o que o
            formulário muda acontece no mesmo "Salvar", e fechar sem salvar
            desfaz tudo — inclusive isto. */}
        {removida && <input type="hidden" name="removerImagem" value="1" />}

        <div className="flex items-start gap-3">
          <div className="h-20 w-28 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-muted">
            {mostrada ? (
              // <img> puro: a prévia é um `blob:` do arquivo local, que o
              // otimizador do next/image não tem como buscar.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mostrada} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="grid h-full place-items-center text-xs text-muted">
                sem imagem
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <input
              ref={campoArquivo}
              id="imagem"
              name="imagem"
              type="file"
              accept={TIPOS_ACEITOS}
              onChange={(e) => {
                const arquivo = e.target.files?.[0] ?? null;
                trocarPrevia(arquivo);
                if (arquivo) setRemovida(false);
              }}
              className="w-full text-sm file:mr-3 file:rounded-lg file:border file:border-border file:bg-surface file:px-3 file:py-1.5 file:text-sm file:text-foreground hover:file:border-accent"
            />

            <p className="mt-1.5 text-xs text-muted">
              {previa ? (
                <>
                  <span className="font-medium text-foreground">{previa.nome}</span>{" "}
                  {imagemAtual ? "substitui a atual ao salvar." : "vai ser enviada ao salvar."}{" "}
                  <BotaoTexto
                    onClick={() => {
                      trocarPrevia(null);
                      if (campoArquivo.current) campoArquivo.current.value = "";
                    }}
                  >
                    cancelar
                  </BotaoTexto>
                </>
              ) : removida ? (
                <>
                  A imagem sai ao salvar.{" "}
                  <BotaoTexto onClick={() => setRemovida(false)}>manter</BotaoTexto>
                </>
              ) : imagemAtual ? (
                <>
                  {card?.imageCredit ?? "Imagem atual"}.{" "}
                  <BotaoTexto onClick={() => setRemovida(true)}>remover</BotaoTexto>
                </>
              ) : (
                "JPEG, PNG ou WebP. É reduzida no envio, então foto de celular serve."
              )}
            </p>

            {(front.trim() || meaning.trim()) && (
              <p className="mt-1 text-xs text-muted">
                Procurar no Google Imagens:{" "}
                {front.trim() && (
                  <LinkDeBusca termo={front} className="jp" />
                )}
                {front.trim() && meaning.trim() && " · "}
                {meaning.trim() && <LinkDeBusca termo={meaning} />}
              </p>
            )}

            {estado.erros.imagem && (
              <p role="alert" className="mt-1 text-xs text-accent">
                {estado.erros.imagem}
              </p>
            )}
          </div>
        </div>

        <Campo
          rotulo="Termo de busca automática"
          erro={estado.erros.imageQuery}
          para="imageQuery"
          dica="Só vale para card sem imagem: npm run imagens procura por este termo. Em branco, o card fica sem imagem de propósito."
        >
          <input
            id="imageQuery"
            name="imageQuery"
            defaultValue={card?.imageQuery ?? ""}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            autoComplete="off"
          />
        </Campo>
      </section>

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

/** Um dos termos de busca, já apontando para a aba de imagens. */
function LinkDeBusca({ termo, className }: { termo: string; className?: string }) {
  return (
    <a
      href={buscaNoGoogle(termo)}
      target="_blank"
      rel="noreferrer noopener"
      className={`text-accent hover:underline ${className ?? ""}`}
    >
      {termo.trim()} ↗
    </a>
  );
}

/** Ação secundária no meio de uma frase — "cancelar", "remover", "manter". */
function BotaoTexto({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} className="text-accent hover:underline">
      {children}
    </button>
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
