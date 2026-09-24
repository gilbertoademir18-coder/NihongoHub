"use client";

import { useEffect } from "react";

/**
 * Remove o service worker das versões anteriores do app.
 *
 * Enquanto os dados viviam no navegador, um service worker guardava a casca
 * para o app abrir sem rede. Agora o estudo vem do servidor, e essa casca em
 * cache serviria uma tela que não consegue carregar nada — pior do que não
 * abrir. Apagar o arquivo do servidor não basta: o service worker já
 * instalado continua ativo no navegador de quem usou o app antes.
 *
 * Este componente pode ser removido quando não houver mais instalações
 * antigas em circulação.
 */
export function ServiceWorkerCleanup() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .getRegistrations()
      .then((registros) => Promise.all(registros.map((r) => r.unregister())))
      .then(async (removidos) => {
        if (!removidos.some(Boolean)) return;

        // Os caches nomeados sobrevivem ao unregister e continuariam ocupando
        // espaço no disco de quem usou a versão anterior.
        if ("caches" in window) {
          const chaves = await caches.keys();
          await Promise.all(
            chaves
              .filter((chave) => chave.startsWith("nihongohub-"))
              .map((chave) => caches.delete(chave)),
          );
        }
      })
      .catch(() => {
        // Limpeza é oportunista: falhar aqui não pode atrapalhar o estudo.
      });
  }, []);

  return null;
}
