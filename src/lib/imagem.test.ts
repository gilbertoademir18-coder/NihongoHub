import { describe, expect, it } from "vitest";
import {
  MAX_BYTES_IMAGEM,
  conferirImagem,
  formatoDaImagem,
  nomeDoArquivo,
} from "./imagem";

/** Cabeçalho seguido de enchimento, que é o bastante para a assinatura. */
function arquivo(cabecalho: number[], tamanho = 64) {
  const bytes = new Uint8Array(tamanho);
  bytes.set(cabecalho);
  return bytes;
}

const JPEG = arquivo([0xff, 0xd8, 0xff, 0xe0]);
const PNG = arquivo([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP = (() => {
  const bytes = arquivo([]);
  bytes.set([...Buffer.from("RIFF")], 0);
  bytes.set([...Buffer.from("WEBP")], 8);
  return bytes;
})();
const GIF = arquivo([...Buffer.from("GIF89a")]);

describe("formatoDaImagem", () => {
  it("reconhece JPEG, PNG, WebP e GIF pela assinatura", () => {
    expect(formatoDaImagem(JPEG)).toBe("jpg");
    expect(formatoDaImagem(PNG)).toBe("png");
    expect(formatoDaImagem(WEBP)).toBe("webp");
    expect(formatoDaImagem(GIF)).toBe("gif");
  });

  it("não se deixa enganar por HTML com cara de imagem", () => {
    // O arquivo vai para `public/`, servido na mesma origem do app. Confiar na
    // extensão ou no Content-Type seria deixar entrar script nosso.
    expect(formatoDaImagem(arquivo([...Buffer.from("<!doctype html><script>")]))).toBeNull();
    expect(formatoDaImagem(arquivo([...Buffer.from("<svg xmlns=")]))).toBeNull();
  });

  it("não estoura em arquivo curto demais para ter assinatura", () => {
    expect(formatoDaImagem(new Uint8Array([0xff, 0xd8]))).toBeNull();
  });
});

describe("conferirImagem", () => {
  it("aceita os três formatos e devolve a extensão", () => {
    expect(conferirImagem(JPEG)).toEqual({ ok: true, extensao: "jpg" });
    expect(conferirImagem(PNG)).toEqual({ ok: true, extensao: "png" });
    expect(conferirImagem(WEBP)).toEqual({ ok: true, extensao: "webp" });
  });

  it("recusa GIF dizendo o motivo, e não como formato desconhecido", () => {
    const resposta = conferirImagem(GIF);
    expect(resposta.ok).toBe(false);
    expect(resposta.ok === false && resposta.motivo).toMatch(/anima/i);
  });

  it("recusa arquivo vazio e arquivo grande demais", () => {
    expect(conferirImagem(new Uint8Array(0)).ok).toBe(false);

    const enorme = new Uint8Array(MAX_BYTES_IMAGEM + 1);
    enorme.set([0xff, 0xd8, 0xff, 0xe0]);
    expect(conferirImagem(enorme).ok).toBe(false);
  });
});

describe("nomeDoArquivo", () => {
  it("muda a cada envio, para o cache não servir a imagem antiga", () => {
    const antes = nomeDoArquivo("abc", "jpg", 1_700_000_000_000);
    const depois = nomeDoArquivo("abc", "jpg", 1_700_000_001_000);
    expect(antes).not.toBe(depois);
    expect(antes.startsWith("abc-")).toBe(true);
    expect(antes.endsWith(".jpg")).toBe(true);
  });
});
