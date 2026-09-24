-- Marca as revisões feitas em treino livre.
--
-- Treino é prática fora da hora marcada: conta para as estatísticas, mas não
-- altera o agendamento do card. Sem esta coluna o histórico misturaria as duas
-- coisas e nenhuma das duas seria legível depois.
--
-- O histórico existente é todo de revisões na hora certa, que é o default.

-- AlterTable
ALTER TABLE "reviews" ADD COLUMN "treino" BOOLEAN NOT NULL DEFAULT false;
