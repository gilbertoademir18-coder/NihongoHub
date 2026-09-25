import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // O padrão é 1MB, e o corpo carrega a imagem do card junto do
      // formulário. O navegador já reduz a imagem antes de enviar (veja
      // `src/lib/imagem-cliente.ts`); esta folga existe para o envio falhar
      // com um erro nosso, no campo, em vez de um erro cru do framework.
      bodySizeLimit: "3mb",
    },
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
