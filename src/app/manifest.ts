import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NihongoHub — estude japonês",
    short_name: "NihongoHub",
    description:
      "Flashcards de kanji e vocabulário com repetição espaçada. Funciona offline.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#faf8f5",
    theme_color: "#b23a48",
    lang: "pt-BR",
    categories: ["education"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        // O Android recorta este em círculo; por isso ele tem margem extra.
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Revisar agora",
        short_name: "Revisar",
        url: "/study",
        description: "Vai direto para a fila de cards vencidos",
      },
    ],
  };
}
