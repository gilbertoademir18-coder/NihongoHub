import "server-only";

import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { nomeDoArquivo } from "../imagem";

/**
 * A imagem do card no disco.
 *
 * Os arquivos vão para `public/cards/`, junto das baixadas por
 * `npm run imagens` — mesma pasta de propósito: para quem lê o card, imagem
 * enviada e imagem baixada são a mesma coisa, e separá-las obrigaria toda
 * tela a saber de onde veio.
 *
 * Gravar em `public/` em tempo de execução funciona porque o Next lê a pasta
 * a cada requisição. É uma escolha consciente de app local: numa hospedagem
 * sem disco persistente, isto teria que virar armazenamento externo.
 */

const PASTA_WEB = "/cards";
const PASTA = path.join(process.cwd(), "public", "cards");

/** Grava e devolve o caminho web, pronto para o `imagePath` do card. */
export async function gravarImagem(
  cardId: string,
  bytes: Uint8Array,
  extensao: string,
): Promise<string> {
  await mkdir(PASTA, { recursive: true });
  const nome = nomeDoArquivo(cardId, extensao);
  await writeFile(path.join(PASTA, nome), bytes);
  return `${PASTA_WEB}/${nome}`;
}

/**
 * Apaga o arquivo de uma imagem que saiu de cena.
 *
 * Silencioso quando o arquivo já não existe: o resultado pedido é o que já
 * vale, e estourar aqui faria uma exclusão de card falhar pela metade —
 * card apagado do banco, erro na tela.
 *
 * Só mexe no que está em `public/cards/`. O caminho vem do banco, mas o banco
 * não é um lugar mais confiável que outro qualquer para sair chamando
 * `unlink` com o que estiver escrito lá.
 */
export async function apagarImagem(imagePath: string | null): Promise<void> {
  if (!imagePath) return;

  const nome = path.posix.basename(imagePath);
  if (imagePath !== `${PASTA_WEB}/${nome}` || !nome || nome.startsWith(".")) return;

  try {
    await unlink(path.join(PASTA, nome));
  } catch (erro) {
    if ((erro as NodeJS.ErrnoException)?.code !== "ENOENT") throw erro;
  }
}
