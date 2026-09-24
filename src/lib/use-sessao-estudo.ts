"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type DetalhesRevisao, revisarCard } from "@/app/actions";
import { HORIZONTE_SESSAO_MS } from "./lote";
import type { CardEstudo } from "./server/study";
import type { Rating } from "./srs";

/**
 * O que os dois modos de estudo têm em comum.
 *
 * Fila, cronômetro de resposta, reinserção do card em aprendizado, proteção
 * contra toque duplo e tratamento de erro são iguais quer a pessoa clique num
 * botão, quer digite a resposta. O que muda — o que aparece na tela e como a
 * nota é decidida — fica nos componentes.
 */

/** Quantos cards entram na frente de um card que voltou para a fila. */
const DISTANCIA_REINSERCAO = 3;

export interface SessaoEstudo {
  atual: CardEstudo | null;
  fila: CardEstudo[];
  revisados: number;
  salvando: boolean;
  erro: string | null;
  /** Devolve `true` quando a revisão foi gravada. */
  responder: (rating: Rating, detalhes?: DetalhesRevisao) => Promise<boolean>;
}

export function useSessaoEstudo(filaInicial: CardEstudo[]): SessaoEstudo {
  const [fila, setFila] = useState(filaInicial);
  const [revisados, setRevisados] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  /** Quando o card atual apareceu — vira o tempo de resposta no histórico. */
  const exibidoEm = useRef(0);
  /** Impede que dois toques rápidos avaliem o mesmo card duas vezes. */
  const ocupado = useRef(false);

  const atual = fila[0] ?? null;

  // O cronômetro reinicia a cada card exibido. `revisados` entra como
  // dependência porque um card pode voltar logo em seguida a si mesmo (fila
  // curta em aprendizado), e aí o id sozinho não mudaria.
  useEffect(() => {
    exibidoEm.current = Date.now();
  }, [atual?.id, revisados]);

  const responder = useCallback(
    async (rating: Rating, detalhes: DetalhesRevisao = {}): Promise<boolean> => {
      if (!atual || ocupado.current) return false;
      ocupado.current = true;
      setSalvando(true);
      setErro(null);

      const duracao = Date.now() - exibidoEm.current;

      try {
        // O agendamento é calculado e gravado no servidor; aqui só usamos o
        // card que volta de lá para decidir se ele reaparece nesta sessão.
        const atualizado = await revisarCard(atual.id, rating, duracao, detalhes);

        setFila((anterior) => {
          const resto = anterior.slice(1);
          if (atualizado.srs.dueAt <= Date.now() + HORIZONTE_SESSAO_MS) {
            const posicao = Math.min(DISTANCIA_REINSERCAO, resto.length);
            return [...resto.slice(0, posicao), atualizado, ...resto.slice(posicao)];
          }
          return resto;
        });

        setRevisados((n) => n + 1);
        return true;
      } catch {
        // Sem o servidor não há como registrar a revisão. Mantemos o card na
        // tela para a pessoa tentar de novo, em vez de seguir adiante e perder
        // a resposta silenciosamente.
        setErro("Não foi possível salvar. Verifique a conexão e tente de novo.");
        return false;
      } finally {
        ocupado.current = false;
        setSalvando(false);
      }
    },
    [atual],
  );

  return { atual, fila, revisados, salvando, erro, responder };
}
