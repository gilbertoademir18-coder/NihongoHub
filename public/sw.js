/**
 * Service worker do NihongoHub.
 *
 * Responsabilidade única: fazer o app *abrir* sem rede. Os dados de estudo já
 * vivem no IndexedDB, então não há nada de API para sincronizar aqui — o que
 * falta offline é só a casca (HTML, JS, CSS, fontes).
 *
 * Escrito à mão, sem plugin de build: são poucas regras, e assim dá para ler
 * o arquivo inteiro e saber exatamente o que está em cache.
 */

// Suba a versão para invalidar tudo que ficou para trás.
const VERSION = "v1";
const SHELL_CACHE = `nihongohub-shell-${VERSION}`;
const ASSET_CACHE = `nihongohub-assets-${VERSION}`;

/** Rotas que precisam estar em cache para o app abrir offline. */
const SHELL_ROUTES = ["/", "/study", "/offline"];

/** Quanto esperar a rede numa navegação antes de servir o cache. */
const NETWORK_TIMEOUT_MS = 3000;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // `reload` evita pegar uma versão velha do cache HTTP do navegador.
      await cache.addAll(
        SHELL_ROUTES.map((route) => new Request(route, { cache: "reload" })),
      );
      // Ativa a versão nova sem esperar as abas antigas fecharem.
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("nihongohub-") && !key.endsWith(VERSION))
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Mutações nunca são cacheadas; e nada de outras origens entra aqui.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  // Build assets do Next carregam hash no nome: são imutáveis por definição.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }

  if (isStaticAsset(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, ASSET_CACHE));
  }
});

function isStaticAsset(pathname) {
  return /\.(?:png|jpe?g|svg|webp|ico|woff2?|css|js|webmanifest)$/.test(pathname);
}

/**
 * Navegação: tenta a rede primeiro para não servir HTML velho, mas desiste
 * rápido. Sem rede, serve a mesma rota do cache; se nem isso, a página de
 * offline explica o que houve.
 */
async function handleNavigation(request) {
  const cache = await caches.open(SHELL_CACHE);

  try {
    const response = await withTimeout(fetch(request), NETWORK_TIMEOUT_MS);
    if (response && response.ok) {
      cache.put(request, response.clone());
      return response;
    }
    if (response) return response;
  } catch {
    // Rede indisponível ou lenta demais — cai para o cache abaixo.
  }

  const cached = (await cache.match(request)) ?? (await cache.match("/"));
  if (cached) return cached;

  const offline = await cache.match("/offline");
  if (offline) return offline;

  return new Response("Você está offline.", {
    status: 503,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

/** Serve o cache na hora e atualiza em segundo plano para a próxima visita. */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  const response = cached ?? (await network);
  return response ?? Response.error();
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("timeout de rede")), ms),
    ),
  ]);
}
