/**
 * Regras da imagem que a pessoa envia — funções puras, sem disco nem DOM.
 *
 * Fica aqui, e não junto da Server Action, porque a mesma decisão é tomada
 * duas vezes: no navegador, para avisar antes de subir megabytes à toa, e de
 * novo no servidor, que é onde ela realmente vale. Arquivo chega pela rede e
 * é entrada externa como qualquer outra.
 */

/**
 * Maior lado da imagem depois de preparada, em pixels.
 *
 * O card mostra a imagem em algumas centenas de pixels — as baixadas do
 * Openverse são miniaturas e ficaram boas. 960 dá folga para tela retina sem
 * guardar foto de celular inteira no disco.
 */
export const LADO_MAXIMO = 960;

/**
 * Teto do arquivo já preparado.
 *
 * Server Action tem limite de corpo (1MB por padrão, elevado no
 * `next.config.ts`), então este número não é decoração: ultrapassá-lo faz o
 * envio falhar com um erro do framework, sem campo nem explicação.
 */
export const MAX_BYTES_IMAGEM = 1_200_000;

/** Acima disto vale reprocessar mesmo que a imagem já seja pequena na tela. */
export const BYTES_SEM_REPROCESSAR = 300_000;

export type FormatoDeImagem = "jpg" | "png" | "webp" | "gif";

/** Os tipos que o seletor de arquivo oferece. */
export const TIPOS_ACEITOS = "image/jpeg,image/png,image/webp";

function textoEm(bytes: Uint8Array, inicio: number, tamanho: number) {
  let texto = "";
  for (let i = inicio; i < inicio + tamanho && i < bytes.length; i += 1) {
    texto += String.fromCharCode(bytes[i]!);
  }
  return texto;
}

/**
 * O formato real, lido dos primeiros bytes.
 *
 * Pela assinatura, e não pela extensão nem pelo `Content-Type`: os dois são
 * texto que quem envia escolhe. Isso importa aqui mais que o normal porque o
 * arquivo vai parar em `public/`, servido na mesma origem do app — um `.html`
 * renomeado para `.jpg` seria script nosso aos olhos do navegador.
 */
export function formatoDaImagem(bytes: Uint8Array): FormatoDeImagem | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "png";
  }
  if (textoEm(bytes, 0, 4) === "RIFF" && textoEm(bytes, 8, 4) === "WEBP") return "webp";
  if (textoEm(bytes, 0, 4) === "GIF8") return "gif";
  return null;
}

export type Conferencia =
  | { ok: true; extensao: Exclude<FormatoDeImagem, "gif"> }
  | { ok: false; motivo: string };

/**
 * Se estes bytes podem virar a imagem de um card.
 *
 * GIF é recusado com recado próprio em vez de cair no "formato não
 * reconhecido": ele *é* imagem, e a pessoa merece saber por que não serve —
 * toda imagem enviada passa por um redimensionamento, e isso congelaria a
 * animação, entregando um GIF parado sem avisar.
 */
export function conferirImagem(bytes: Uint8Array): Conferencia {
  if (bytes.length === 0) return { ok: false, motivo: "O arquivo está vazio." };

  if (bytes.length > MAX_BYTES_IMAGEM) {
    const mb = (bytes.length / 1_000_000).toFixed(1);
    return { ok: false, motivo: `A imagem ficou com ${mb}MB, acima do limite de envio.` };
  }

  const formato = formatoDaImagem(bytes);
  if (formato === "gif") {
    return {
      ok: false,
      motivo: "GIF não entra: a imagem é redimensionada ao enviar, e a animação ficaria parada.",
    };
  }
  if (!formato) {
    return { ok: false, motivo: "Não parece uma imagem JPEG, PNG ou WebP." };
  }

  return { ok: true, extensao: formato };
}

/**
 * Nome do arquivo no disco, com um sufixo que muda a cada envio.
 *
 * O sufixo existe por causa do cache: trocar a imagem mantendo o nome
 * `<id>.jpg` deixaria o navegador — e o otimizador do next/image — servindo a
 * antiga, e a pessoa concluiria que o envio não funcionou.
 */
export function nomeDoArquivo(cardId: string, extensao: string, agora = Date.now()) {
  return `${cardId}-${agora.toString(36)}.${extensao}`;
}
