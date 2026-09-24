import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { ServiceWorkerCleanup } from "@/components/service-worker-cleanup";

const inter = Inter({
  variable: "--font-sans-latin",
  subsets: ["latin"],
});

/*
 * O japonês usa a fonte do sistema de propósito — veja a pilha em
 * `globals.css`. Empacotar a Noto Sans JP custaria 5,5 MB em 131 fatias,
 * baixadas sob demanda: exatamente o que um app offline não pode depender.
 * Todas as plataformas-alvo já trazem uma fonte japonesa de qualidade.
 */

export const metadata: Metadata = {
  title: "NihongoHub — estude japonês com repetição espaçada",
  description:
    "Flashcards de kanji e vocabulário com repetição espaçada. Funciona offline.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    // O iOS ignora os ícones do manifest: o ícone da tela inicial sai daqui.
    apple: [{ url: "/apple-icon-180.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "NihongoHub",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f5" },
    { media: "(prefers-color-scheme: dark)", color: "#14120f" },
  ],
  // O app é usado com o polegar, em pé no ônibus: impedir zoom acidental de
  // duplo toque ajuda mais do que atrapalha aqui.
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} h-full antialiased`}
      // Extensões de navegador injetam classes e atributos em <html> antes do
      // React hidratar, e cada uma gera um aviso de mismatch que não diz
      // respeito ao nosso código. A supressão vale só para este elemento —
      // mismatches dentro da árvore continuam sendo reportados.
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans">
        <ServiceWorkerCleanup />
        <header className="border-b border-border bg-surface/80 backdrop-blur sticky top-0 z-10">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-baseline gap-2">
              <span className="jp text-lg font-bold text-accent">日本語</span>
              <span className="text-base font-semibold tracking-tight">
                NihongoHub
              </span>
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
