// NEXUS Service Worker - PWA Safe Install & Lifecycle Handler
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      // Limpa qualquer cache corrompido ou antigo
      return Promise.all(keys.map((k) => caches.delete(k)));
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", () => {
  // Pass-through padrão pela rede — evita qualquer interceptação ou sequestro
  // de rotas de API, assets dinâmicos do Vite ou conexões do navegador.
});
