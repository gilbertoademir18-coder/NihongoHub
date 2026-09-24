/**
 * Gera os ícones PNG do PWA a partir de uma única definição.
 *
 * Rode com `npm run icons` sempre que mudar a marca. Os arquivos vão para
 * `public/`, com nomes fixos, porque o manifest precisa de URLs estáveis —
 * as rotas de ícone do Next carregam hash e não servem para isso.
 */
import { writeFile, mkdir } from "node:fs/promises";
import { ImageResponse } from "next/og.js";

const OUT_DIR = new URL("../public/", import.meta.url);

/** O tamanho de cada ícone e quanta margem de segurança ele precisa. */
const TARGETS = [
  { file: "icon-192.png", size: 192, padding: 0 },
  { file: "icon-512.png", size: 512, padding: 0 },
  // Ícones "maskable" são recortados pelo Android: o conteúdo precisa caber
  // no círculo interno, ~80% do quadrado.
  { file: "icon-maskable-512.png", size: 512, padding: 0.1 },
  { file: "apple-icon-180.png", size: 180, padding: 0.06 },
];

function Icon({ size, padding }) {
  const inset = size * padding;
  const glyphSize = (size - inset * 2) * 0.62;

  return {
    type: "div",
    props: {
      style: {
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(145deg, #b23a48 0%, #8c2b38 100%)",
      },
      children: {
        type: "div",
        props: {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: glyphSize,
            color: "#faf8f5",
            fontWeight: 700,
            // O 語 de 日本語: o traço que identifica o app de cara.
            lineHeight: 1,
          },
          children: "語",
        },
      },
    },
  };
}

const fontData = await fetch(
  "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-jp@latest/japanese-700-normal.woff",
).then((res) => {
  if (!res.ok) throw new Error(`Falha ao baixar a fonte: ${res.status}`);
  return res.arrayBuffer();
});

await mkdir(OUT_DIR, { recursive: true });

for (const target of TARGETS) {
  const response = new ImageResponse(Icon(target), {
    width: target.size,
    height: target.size,
    fonts: [{ name: "Noto Sans JP", data: fontData, weight: 700, style: "normal" }],
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(new URL(target.file, OUT_DIR), buffer);
  console.log(`✓ ${target.file} (${target.size}×${target.size}, ${buffer.length} bytes)`);
}
