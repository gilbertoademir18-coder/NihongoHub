import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Cliente Prisma compartilhado.
 *
 * O Prisma 7 abandonou o query engine binário: a conexão passa por um driver
 * adapter em JavaScript, que precisa ser fornecido explicitamente.
 *
 * A instância vai para o escopo global em desenvolvimento porque o Next
 * recarrega os módulos a cada alteração — sem isso, cada recarga abriria um
 * novo pool e o Postgres esgotaria os slots em poucos minutos de trabalho.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function criarCliente(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL não está definida. Confira o arquivo .env na raiz do projeto.",
    );
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? criarCliente();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
