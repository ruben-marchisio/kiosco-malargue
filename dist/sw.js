const CACHE = 'kiosco-v5'; // <-- Incrementado para forzar limpieza
const STATIC = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/config.js',
  '/js/app.js',
  '/manifest.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(STATIC)));
  // Fuerza a que la nueva versión se instale y tome el control INMEDIATAMENTE
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  // Toma el control de las ventanas abiertas al instante sin necesidad de recargar la página manualmente
  self.clients.claim();
});

// Network First (Primero Red, luego Caché)
// Esto asegura que siempre se cargue la versión más reciente si hay internet
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // No cachear llamadas a Supabase ni a la API de Cloudflare Workers
  if (e.request.url.includes('supabase') || e.request.url.includes('/api/')) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const resToCache = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, resToCache));
        }
        return res;
      })
      .catch(() => {
        // Si no hay red (offline), intenta sacar del caché
        return caches.match(e.request);
      })
  );
});
