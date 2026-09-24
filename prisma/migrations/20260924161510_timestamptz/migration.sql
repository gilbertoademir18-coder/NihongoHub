-- Passa as colunas de data para TIMESTAMPTZ.
--
-- O driver do Prisma sempre gravou estes valores em UTC, mas a coluna era
-- `timestamp without time zone`: o Postgres guardava o instante sem saber a
-- que fuso ele pertencia. Isso funciona enquanto tudo passa pelo Prisma e
-- erra em silêncio em qualquer SQL escrito à mão — `WHERE due_at <= now()`
-- comparava um valor UTC com a hora local do servidor, três horas adiante.
--
-- O `USING ... AT TIME ZONE 'UTC'` é o que torna esta migração segura: sem
-- ele o Postgres assumiria que os valores existentes estão no fuso do
-- servidor (America/Sao_Paulo) e deslocaria todo o histórico em 3 horas.

-- AlterTable
ALTER TABLE "cards"
  ALTER COLUMN "due_at" SET DATA TYPE TIMESTAMPTZ(3) USING "due_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "decks"
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "reviews"
  ALTER COLUMN "reviewed_at" SET DATA TYPE TIMESTAMPTZ(3) USING "reviewed_at" AT TIME ZONE 'UTC';
