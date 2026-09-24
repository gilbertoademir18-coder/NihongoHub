import { seedIfEmpty } from "./seed";

/**
 * Garante que o banco local esteja pronto antes da primeira consulta.
 *
 * A promise é memoizada: várias telas podem chamar isto ao montar, em
 * paralelo, e o seed roda uma vez só. Sem isso, duas queries simultâneas na
 * primeira visita disputariam a criação dos mesmos decks.
 */
let ready: Promise<void> | null = null;

export function ensureSeeded(): Promise<void> {
  ready ??= seedIfEmpty()
    .then(() => undefined)
    .catch((error) => {
      // Deixa o app abrir mesmo se o seed falhar — o usuário ainda pode criar
      // os próprios decks. Mas permite nova tentativa no próximo carregamento.
      console.error("Falha ao preparar o banco local:", error);
      ready = null;
    });

  return ready;
}
