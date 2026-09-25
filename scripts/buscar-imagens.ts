/**
 * Baixa uma imagem ilustrativa para cada card que tenha termo de busca.
 *
 * A fonte é o Openverse, catálogo de imagens com licença aberta: não pede
 * chave de API e devolve autor e licença junto do resultado, que é o que
 * permite creditar direito. Um banco de imagens comum devolveria fotos mais
 * bonitas e nenhuma permissão para usá-las.
 *
 * Roda quantas vezes for preciso: só busca card sem imagem, então uma
 * execução interrompida continua de onde parou, e refazer um card é apagar o
 * `imagePath` dele.
 *
 *   npx tsx --env-file=.env scripts/buscar-imagens.ts
 *   npx tsx --env-file=.env scripts/buscar-imagens.ts --limite 20
 *   npx tsx --env-file=.env scripts/buscar-imagens.ts --listar
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const RAIZ = path.resolve(import.meta.dirname, "..");
const PASTA = path.join(RAIZ, "public", "cards");

/** Identifica o projeto para o Openverse, como as boas maneiras pedem. */
const AGENTE = "NihongoHub/0.1 (app de estudo pessoal)";

/**
 * Pausa entre buscas.
 *
 * O Openverse anônimo tem limite de requisições, e um laço sem freio sobre
 * 150 cards é exatamente o que dispara um 429. Meio segundo custa pouco mais
 * de um minuto no total e mantém o script bem-comportado.
 */
const PAUSA_MS = 500;

/**
 * Quantos candidatos pedir por palavra.
 *
 * Mais de um porque o primeiro nem sempre serve: há resultados sem
 * miniatura, ou pequenos demais para ilustrar qualquer coisa.
 */
const CANDIDATOS = 8;

/** Abaixo disto a imagem não ilustra nada — é ícone, selo ou avatar. */
const LARGURA_MINIMA = 300;

interface ResultadoOpenverse {
  id: string;
  title?: string;
  creator?: string;
  license?: string;
  license_version?: string;
  foreign_landing_url?: string;
  thumbnail?: string;
  url?: string;
  width?: number;
  height?: number;
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

function dormir(ms: number) {
  return new Promise((ok) => setTimeout(ok, ms));
}

/**
 * Busca candidatos, insistindo quando o servidor pede calma.
 *
 * Um 429 não é erro: é o serviço dizendo "devagar". Desistir na primeira
 * recusa deixaria metade do baralho sem imagem por um problema temporário.
 */
async function buscar(termo: string, tentativa = 0): Promise<ResultadoOpenverse[]> {
  const url =
    "https://api.openverse.org/v1/images/" +
    `?q=${encodeURIComponent(termo)}&page_size=${CANDIDATOS}`;

  const resposta = await fetch(url, { headers: { "User-Agent": AGENTE } });

  if (resposta.status === 429 && tentativa < 4) {
    const espera = 5000 * 2 ** tentativa;
    console.log(`    (429 — esperando ${espera / 1000}s)`);
    await dormir(espera);
    return buscar(termo, tentativa + 1);
  }
  if (!resposta.ok) throw new Error(`busca falhou: HTTP ${resposta.status}`);

  const corpo = (await resposta.json()) as { results?: ResultadoOpenverse[] };
  return corpo.results ?? [];
}

/**
 * Quantos termos da busca o título realmente contém.
 *
 * Casar por substring é o erro clássico aqui, e ele custa caro: procurando
 * "person" o primeiro resultado foi um "Sharp X68000 **Person**al Computer",
 * e procurando `たたみ` veio um "折り**たたみ**自転車" (bicicleta dobrável).
 * Em alfabeto latino, exigir palavra inteira derruba os dois casos.
 *
 * Japonês não tem separação de palavras, então ali substring é o melhor que
 * dá — e é por isso que os termos japoneses da curadoria são sempre longos o
 * bastante para não se esconderem dentro de outra palavra.
 */
function pontuar(titulo: string, termo: string): number {
  const alvo = titulo.toLowerCase();
  let pontos = 0;
  for (const parte of termo.toLowerCase().split(/\s+/).filter(Boolean)) {
    const latino = /^[a-z0-9]+$/.test(parte);
    const casou = latino
      ? new RegExp(`\\b${parte}\\b`).test(alvo)
      : alvo.includes(parte);
    if (casou) pontos += 1;
  }
  return pontos;
}

/**
 * Os candidatos utilizáveis, do melhor para o pior.
 *
 * Utilizável exige miniatura e tamanho: resultados minúsculos são ícone, selo
 * ou avatar, e não ilustram nada. Vem lista, e não um só, porque a miniatura
 * escolhida pode estar morta — cinco palavras levaram `HTTP 424` do
 * redimensionador do Openverse, e desistir na primeira as deixaria sem imagem
 * tendo outros sete candidatos bons na mão.
 */
function ordenar(candidatos: ResultadoOpenverse[], termo: string) {
  return candidatos
    .filter((c) => c.thumbnail && !(c.width && c.width < LARGURA_MINIMA))
    .map((c, ordem) => ({ c, pontos: pontuar(c.title ?? "", termo), ordem }))
    // Empate fica com a ordem do Openverse, que já vem por relevância; sem o
    // desempate explícito, um sort instável embaralharia iguais.
    .sort((a, b) => b.pontos - a.pontos || a.ordem - b.ordem)
    .map(({ c, pontos }) => ({ escolhido: c, casou: pontos > 0 }));
}

/**
 * Baixa a miniatura, e não a imagem original.
 *
 * O card mostra a imagem com algumas centenas de pixels; puxar o original de
 * vários megabytes gastaria banda alheia para jogar fora na hora de exibir.
 */
async function baixar(escolhido: ResultadoOpenverse, cardId: string) {
  const resposta = await fetch(escolhido.thumbnail!, { headers: { "User-Agent": AGENTE } });
  if (!resposta.ok) throw new Error(`download falhou: HTTP ${resposta.status}`);

  const tipo = resposta.headers.get("content-type") ?? "";
  if (!tipo.startsWith("image/")) throw new Error(`não é imagem: ${tipo || "sem tipo"}`);

  const extensao = tipo.includes("png") ? "png" : tipo.includes("webp") ? "webp" : "jpg";
  const arquivo = `${cardId}.${extensao}`;
  const bytes = Buffer.from(await resposta.arrayBuffer());
  await writeFile(path.join(PASTA, arquivo), bytes);

  return { caminho: `/cards/${arquivo}`, bytes: bytes.length };
}

/** Crédito curto: autor e licença, que é o que as licenças CC exigem. */
function credito(c: ResultadoOpenverse) {
  const autor = c.creator?.trim() || "autor não identificado";
  const licenca = [c.license?.toUpperCase(), c.license_version].filter(Boolean).join(" ");
  return licenca ? `${autor} · ${licenca}` : autor;
}

async function main() {
  const args = process.argv.slice(2);
  const soListar = args.includes("--listar");
  const posLimite = args.indexOf("--limite");
  const limite = posLimite >= 0 ? Number(args[posLimite + 1]) : undefined;

  await mkdir(PASTA, { recursive: true });

  const pendentes = await prisma.card.findMany({
    where: { imageQuery: { not: null }, imagePath: null },
    select: { id: true, front: true, meaning: true, imageQuery: true },
    orderBy: { createdAt: "asc" },
    take: limite,
  });

  const semTermo = await prisma.card.count({ where: { imageQuery: null } });
  const prontos = await prisma.card.count({ where: { imagePath: { not: null } } });

  console.log(`${prontos} com imagem · ${pendentes.length} a buscar · ${semTermo} sem imagem por decisão\n`);

  if (soListar) {
    for (const c of pendentes) console.log(`${c.front}\t${c.meaning}\t→ ${c.imageQuery}`);
    return;
  }

  let ok = 0;
  const falhas: string[] = [];
  // Baixadas, mas sem o termo no título: valem um olhar humano.
  const duvidosos: string[] = [];

  for (const card of pendentes) {
    const termo = card.imageQuery!;
    process.stdout.write(`${card.front} (${card.meaning}) → "${termo}" `);
    try {
      const fila = ordenar(await buscar(termo), termo);
      if (fila.length === 0) {
        console.log("— nenhum candidato utilizável");
        falhas.push(`${card.front}: sem candidato para "${termo}"`);
        await dormir(PAUSA_MS);
        continue;
      }

      let baixado = null;
      let ultimoErro = "";
      for (const tentativa of fila) {
        try {
          baixado = { ...tentativa, ...(await baixar(tentativa.escolhido, card.id)) };
          break;
        } catch (erro) {
          ultimoErro = erro instanceof Error ? erro.message : String(erro);
        }
      }
      if (!baixado) throw new Error(`todos os candidatos falharam (${ultimoErro})`);
      const { escolhido, casou, caminho, bytes } = baixado;
      await prisma.card.update({
        where: { id: card.id },
        data: {
          imagePath: caminho,
          imageCredit: credito(escolhido),
          imageSource: escolhido.foreign_landing_url ?? null,
        },
      });

      ok += 1;
      const marca = casou ? "✓" : "?";
      console.log(`${marca} ${Math.round(bytes / 1024)}KB — "${(escolhido.title ?? "").slice(0, 45)}"`);
      if (!casou) duvidosos.push(`${card.front} (${card.meaning}) ← "${escolhido.title ?? "sem título"}"`);
    } catch (erro) {
      const motivo = erro instanceof Error ? erro.message : String(erro);
      console.log(`✗ ${motivo}`);
      falhas.push(`${card.front}: ${motivo}`);
    }
    await dormir(PAUSA_MS);
  }

  console.log(`\n${ok} baixadas, ${falhas.length} falharam`);
  for (const f of falhas) console.log(`  · ${f}`);
}

main()
  .catch((erro) => {
    console.error("falha:", erro);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
