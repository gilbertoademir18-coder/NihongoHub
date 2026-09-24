"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("offline", onChange);
  window.addEventListener("online", onChange);
  return () => {
    window.removeEventListener("offline", onChange);
    window.removeEventListener("online", onChange);
  };
}

const getSnapshot = () => !navigator.onLine;
/** No servidor não há rede para consultar; assume online e corrige ao montar. */
const getServerSnapshot = () => false;

/**
 * Selo discreto no cabeçalho quando a conexão cai.
 *
 * A mensagem é tranquilizadora de propósito: aqui o offline não quebra nada,
 * e o usuário precisa saber disso para continuar estudando sem receio.
 */
export function OfflineBadge() {
  const isOffline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (!isOffline) return null;

  return (
    <span
      className="rounded-full border border-border bg-surface-muted px-2.5 py-1 text-xs font-medium text-muted"
      role="status"
    >
      Offline — seu progresso está salvo
    </span>
  );
}
