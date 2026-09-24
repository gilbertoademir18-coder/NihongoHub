"use client";

import { useEffect } from "react";

/**
 * Registra o service worker depois que a página carrega.
 *
 * Fica no layout raiz para que qualquer rota de entrada já deixe o app
 * disponível offline na próxima abertura.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Em dev o service worker atrapalha mais do que ajuda: ele serve build
    // antigo e esconde as mudanças que você acabou de fazer.
    if (process.env.NODE_ENV !== "production") return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.error("Falha ao registrar o service worker:", error);
      });
    };

    // Registrar durante o load compete por banda com o próprio app.
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
