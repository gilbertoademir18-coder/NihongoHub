import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O app roda em `next dev` (veja `scripts/tray.ps1`) e é publicado no
  // tailnet por `tailscale serve` (veja `scripts/publicar-no-tailnet.ps1`).
  // Sem isto, o dev server recusa os próprios assets quando a página é aberta
  // por `<máquina>.<tailnet>.ts.net` em vez de localhost.
  allowedDevOrigins: ["*.*.ts.net"],

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
