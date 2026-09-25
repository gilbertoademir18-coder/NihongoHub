/**
 * Confere se as imagens que o banco promete existem nesta máquina.
 *
 * Faz sentido desde que o banco passou a morar num lugar e o app em outro: o
 * `image_path` é um caminho de arquivo, não a imagem. Quem envia uma imagem no
 * trabalho grava o arquivo no disco de lá, e o banco — compartilhado — passa a
 * apontar para um arquivo que a máquina de casa não tem. A tela não quebra,
 * mas o card fica sem imagem, e nada avisa.
 *
 * Como as imagens são versionadas junto do código, o conserto quase sempre é
 * um `git pull` (ou um `git add public/cards` do lado que enviou).
 *
 *   npm run imagens:conferir
 */

import { access, readdir } from "node:fs/promises";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const RAIZ = path.resolve(import.meta.dirname, "..");
const PASTA = path.join(RAIZ, "public", "cards");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function existe(arquivo: string) {
  try {
    await access(arquivo);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const cards = await prisma.card.findMany({
    where: { imagePath: { not: null } },
    select: { id: true, front: true, meaning: true, imagePath: true, imageCredit: true },
    orderBy: { front: "asc" },
  });

  const noDisco = new Set(
    await readdir(PASTA).catch(() => [] as string[]),
  );

  const faltando: typeof cards = [];
  const usados = new Set<string>();

  for (const card of cards) {
    const nome = path.posix.basename(card.imagePath!);
    usados.add(nome);
    if (!(await existe(path.join(PASTA, nome)))) faltando.push(card);
  }

  const orfaos = [...noDisco].filter((n) => !usados.has(n) && !n.startsWith("."));

  console.log(
    `${cards.length} cards com imagem · ${noDisco.size} arquivos em public/cards\n`,
  );

  if (faltando.length > 0) {
    console.log(`${faltando.length} apontam para arquivo que não está aqui:`);
    for (const c of faltando) {
      console.log(`  ${c.front}\t${c.meaning}\t→ ${c.imagePath}`);
    }
    console.log(
      "\nProvavelmente foram enviadas na outra máquina. Lá: git add public/cards && git commit && git push",
    );
    console.log("Aqui: git pull");
  } else {
    console.log("Todas as imagens que o banco aponta estão no disco.");
  }

  if (orfaos.length > 0) {
    console.log(`\n${orfaos.length} arquivos que nenhum card usa:`);
    for (const nome of orfaos.slice(0, 20)) console.log(`  ${nome}`);
    if (orfaos.length > 20) console.log(`  ... e mais ${orfaos.length - 20}`);
    console.log(
      "\nSobra de imagem trocada ou de card excluído noutra máquina. Dá para apagar.",
    );
  }

  // Código de saída só para o que é problema de verdade: arquivo faltando
  // deixa o card sem imagem, enquanto órfão só ocupa disco.
  if (faltando.length > 0) process.exitCode = 1;
}

main()
  .catch((erro) => {
    console.error("falha:", erro);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
