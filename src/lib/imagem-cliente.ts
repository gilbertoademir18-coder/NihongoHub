import {
  BYTES_SEM_REPROCESSAR,
  LADO_MAXIMO,
  MAX_BYTES_IMAGEM,
  TIPOS_ACEITOS,
} from "./imagem";

/**
 * Prepara a imagem escolhida antes de ela sair do navegador.
 *
 * Existe por um motivo prático: foto de celular tem de 3 a 8MB, e Server
 * Action recusa corpo acima do limite configurado — o envio falharia com um
 * erro do framework, sem campo nem explicação. Encolher aqui evita isso e,
 * de quebra, não guarda no disco um arquivo dez vezes maior do que a tela
 * jamais vai mostrar.
 *
 * O redimensionamento é no cliente, e não no servidor, porque o servidor não
 * tem biblioteca de imagem instalada — e porque assim os megabytes nem chegam
 * a subir pela rede.
 */

/** Qualidade da recompressão. 0,85 é o ponto em que o artefato some do olho. */
const QUALIDADE = 0.85;
/** Segunda tentativa, se a primeira ainda ficar acima do limite de envio. */
const QUALIDADE_APERTADA = 0.6;

export class ImagemRecusada extends Error {}

function extensaoDoTipo(tipo: string) {
  return tipo === "image/png" ? "png" : tipo === "image/webp" ? "webp" : "jpg";
}

async function codificar(
  tela: HTMLCanvasElement,
  tipo: string,
  qualidade: number,
): Promise<Blob> {
  const blob = await new Promise<Blob | null>((ok) => tela.toBlob(ok, tipo, qualidade));
  if (!blob) throw new ImagemRecusada("Não consegui processar esta imagem.");
  return blob;
}

export async function prepararImagem(arquivo: File): Promise<File> {
  if (!TIPOS_ACEITOS.split(",").includes(arquivo.type)) {
    throw new ImagemRecusada(
      arquivo.type === "image/gif"
        ? "GIF não entra: a imagem é redimensionada ao enviar, e a animação ficaria parada."
        : "Escolha um arquivo JPEG, PNG ou WebP.",
    );
  }

  let imagem: ImageBitmap;
  try {
    imagem = await createImageBitmap(arquivo);
  } catch {
    throw new ImagemRecusada("Este arquivo não abriu como imagem.");
  }

  const maiorLado = Math.max(imagem.width, imagem.height);
  const escala = Math.min(1, LADO_MAXIMO / maiorLado);

  // Já pequena e leve: passa intacta. Recomprimir de graça só perderia
  // qualidade — e um PNG de desenho com poucas cores fica *maior* em JPEG.
  if (escala === 1 && arquivo.size <= BYTES_SEM_REPROCESSAR) {
    imagem.close();
    return arquivo;
  }

  const tela = document.createElement("canvas");
  tela.width = Math.round(imagem.width * escala);
  tela.height = Math.round(imagem.height * escala);

  const pincel = tela.getContext("2d");
  if (!pincel) throw new ImagemRecusada("Não consegui processar esta imagem.");
  pincel.drawImage(imagem, 0, 0, tela.width, tela.height);
  imagem.close();

  // WebP sempre: comprime melhor que JPEG e, ao contrário dele, preserva
  // transparência — recorte de objeto em PNG é caso comum aqui.
  let blob = await codificar(tela, "image/webp", QUALIDADE);
  if (blob.size > MAX_BYTES_IMAGEM) {
    blob = await codificar(tela, "image/webp", QUALIDADE_APERTADA);
  }
  if (blob.size > MAX_BYTES_IMAGEM) {
    throw new ImagemRecusada("Esta imagem é pesada demais mesmo depois de reduzida.");
  }

  const base = arquivo.name.replace(/\.[^.]+$/, "") || "imagem";
  return new File([blob], `${base}.${extensaoDoTipo(blob.type)}`, { type: blob.type });
}
