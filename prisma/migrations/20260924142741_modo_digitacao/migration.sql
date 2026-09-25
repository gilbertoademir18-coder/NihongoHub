-- Prepara o banco para o modo de digitação e para a rotação de lote fixo.
--
-- Escrita à mão de propósito. O diff automático do Prisma propunha
--   ALTER TABLE "decks" DROP COLUMN "new_per_day", ADD COLUMN "lote_ativo" ...
-- que descartaria os valores já gravados. É o mesmo campo, com nome melhor:
-- um RENAME preserva o conteúdo.

-- CreateEnum
CREATE TYPE "script" AS ENUM ('hiragana', 'katakana');

-- CreateEnum
CREATE TYPE "modo_estudo" AS ENUM ('flashcard', 'digitacao');

-- AlterTable: o sinal que faltava para distinguir "nunca visto" de
-- "em aprendizado" — nenhuma combinação dos campos de SRS dá isso.
ALTER TABLE "cards"
  ADD COLUMN "introduced_at" TIMESTAMPTZ(3),
  ADD COLUMN "script" "script";

-- AlterTable: renomeia, não recria. "novos por dia" descrevia outro conceito;
-- o que o app passa a aplicar é quantas palavras ficam em aprendizado ao mesmo
-- tempo.
ALTER TABLE "decks" RENAME COLUMN "new_per_day" TO "lote_ativo";

-- AlterTable: um "again" de botão e um "again" por erro de digitação são
-- eventos diferentes. O histórico anterior é todo do modo flashcard, que é
-- exatamente o default.
ALTER TABLE "reviews"
  ADD COLUMN "modo" "modo_estudo" NOT NULL DEFAULT 'flashcard',
  ADD COLUMN "resposta" TEXT;

-- CreateIndex
CREATE INDEX "cards_deck_id_introduced_at_idx" ON "cards"("deck_id", "introduced_at");

-- CreateIndex
CREATE INDEX "cards_deck_id_script_introduced_at_idx" ON "cards"("deck_id", "script", "introduced_at");
