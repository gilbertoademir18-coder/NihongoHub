"use client";

import { useSearchParams } from "next/navigation";
import { DeckStudy } from "./deck-study";
import { StudySession } from "./study-session";

/**
 * Decide, já no cliente, se a sessão é de um deck ou de todos.
 *
 * O deck vem por query string (`/study?deck=…`) em vez de segmento dinâmico
 * de propósito: assim `/study` é uma página estática, que o service worker
 * guarda uma vez e serve para qualquer deck — inclusive um que o usuário
 * nunca abriu online.
 */
export function StudyRoute() {
  const deckId = useSearchParams().get("deck");

  return deckId ? <DeckStudy deckId={deckId} /> : <StudySession />;
}
