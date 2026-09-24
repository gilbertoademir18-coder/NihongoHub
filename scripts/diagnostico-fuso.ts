import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Confere se um instante gravado pelo driver volta do banco como o mesmo
 * instante. Se a diferença não for ~0, os timestamps estão sendo escritos
 * num fuso e lidos em outro.
 */

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL não definida");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
const agoraNode = new Date();
console.log("instante do Node (UTC):", agoraNode.toISOString());

// O que o Postgres acha que é "agora"?
const [{ agora_pg }] = await prisma.$queryRaw<{ agora_pg: Date }[]>`
  SELECT now() AS agora_pg
`;
console.log("instante do Postgres:   ", agora_pg.toISOString());
console.log(
  "diferença Node vs Postgres:",
  Math.round((agora_pg.getTime() - agoraNode.getTime()) / 1000),
  "segundos (esperado: ~0)",
);

console.log("\n--- ida e volta de um valor gravado pelo driver ---");

const deck = await prisma.deck.findFirst();
if (!deck) throw new Error("nenhum deck — rode o seed antes");

// Grava um card com dueAt conhecido e lê de volta.
const marcador = new Date();
const card = await prisma.card.create({
  data: {
    deckId: deck.id,
    front: "__teste_fuso__",
    reading: "",
    meaning: "",
    dueAt: marcador,
  },
});

console.log("gravado (Node):", marcador.toISOString());
console.log("lido de volta :", card.dueAt.toISOString());
console.log(
  "erro na ida e volta:",
  Math.round((card.dueAt.getTime() - marcador.getTime()) / 1000),
  "segundos (esperado: 0)",
);

// E como o Postgres enxerga esse mesmo valor comparado ao próprio relógio?
const [comparacao] = await prisma.$queryRaw<{ diferenca_minutos: number }[]>`
  SELECT round(EXTRACT(EPOCH FROM (due_at - now())) / 60)::int AS diferenca_minutos
  FROM cards WHERE id = ${card.id}
`;
console.log(
  "\nvisto pelo Postgres, o valor está a",
  comparacao.diferenca_minutos,
  "minutos de now() (esperado: ~0)",
);

await prisma.card.delete({ where: { id: card.id } });
console.log("\n(card de teste removido)");

await prisma.$disconnect();
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
