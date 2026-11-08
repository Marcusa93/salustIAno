/* eslint-env serviceworker */
/* global self, caches, clients */

/**
 * Service worker de Salu.
 *
 * Responsabilidades:
 *   1. Caché de lo estático (chunks de `_next/static`, fuentes, íconos,
 *      manifest) para que la app abra rápido y aguante sin señal.
 *   2. Página `/offline` de respaldo cuando una navegación falla por red.
 *   3. Push: mostrar la notificación (siempre, aunque venga vacía — iOS
 *      revoca la suscripción si un push no termina en notificación) y abrir
 *      la app al tocarla.
 *
 * Qué NO hace, a propósito (ver decisions/0016-pwa-offline-y-push.md):
 *   - No cachea HTML de páginas, payloads RSC, `/api/*` ni Server Actions:
 *     son respuestas autenticadas con datos de la familia.
 *   - No toca requests a otros orígenes (Supabase, Spotify, YouTube).
 *   - No cachea `/_next/image` (fotos privadas con URLs firmadas que vencen).
 *
 * Se sirve con `Cache-Control: no-cache` (next.config.ts) para que los
 * cambios lleguen apenas se publican. Si cambia la estrategia de caché,
 * subir SW_VERSION: el `activate` borra los cachés de versiones viejas.
 *
 * En desarrollo se registra como `/sw.js?dev=1`: maneja push pero no cachea
 * nada, así no pisa el hot reload.
 */

const SW_VERSION = 'v2';
const DEV_MODE = new URL(self.location.href).searchParams.has('dev');

const STATIC_CACHE = `salu-static-${SW_VERSION}`;
const ASSET_CACHE = `salu-assets-${SW_VERSION}`;
const OFFLINE_CACHE = `salu-offline-${SW_VERSION}`;
const CURRENT_CACHES = [STATIC_CACHE, ASSET_CACHE, OFFLINE_CACHE];

const OFFLINE_URL = '/offline';
// Header propio para saber cuándo guardamos la página offline y refrescarla
// una vez por día (así sigue el diseño del último deploy).
const CACHED_AT_HEADER = 'x-salu-cached-at';
const OFFLINE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

// Los chunks de Next tienen hash en el nombre: cada deploy suma archivos
// nuevos. Recortamos los más viejos para no crecer sin límite.
const STATIC_CACHE_MAX_ENTRIES = 300;

// Íconos y manifest: se sirven del caché y se revalidan por detrás.
const ASSET_PATHS = new Set([
  '/manifest.webmanifest',
  '/favicon.ico',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable.png',
  '/icon-badge.png',
  '/apple-icon',
]);
const PRECACHE_ASSETS = ['/manifest.webmanifest', '/icon-192.png', '/icon-badge.png'];

const DEFAULT_NOTIFICATION_URL = '/home';

// Último recurso si la página offline no llegó a guardarse (por ejemplo, el
// SW se instaló sin señal). Usa colores de sistema para respetar modo oscuro.
const OFFLINE_FALLBACK_HTML = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sin conexión · Salu</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;background:Canvas;color:CanvasText;text-align:center;padding:24px}button{font:inherit;padding:10px 18px;border-radius:10px;border:1px solid GrayText;background:Canvas;color:CanvasText}</style>
</head><body><main><h1>Sin señal por ahora</h1><p>Salu necesita conexión para mostrarte lo último. Probá de nuevo en un ratito.</p><button type="button" onclick="location.reload()">Reintentar</button></main></body></html>`;

// ---------------------------------------------------------------------------
// Ciclo de vida
// ---------------------------------------------------------------------------

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      if (!DEV_MODE) {
        // Best-effort: si falla (sin señal), el SW se instala igual y el
        // próximo refresco diario lo vuelve a intentar.
        await Promise.allSettled([refreshOfflineCache(), precacheAssets()]);
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter(
            (name) => name.startsWith('salu-') && (DEV_MODE || !CURRENT_CACHES.includes(name)),
          )
          .map((name) => caches.delete(name)),
      );
      if (self.registration.navigationPreload) {
        try {
          if (DEV_MODE) await self.registration.navigationPreload.disable();
          else await self.registration.navigationPreload.enable();
        } catch {
          /* navigation preload no soportado */
        }
      }
      await self.clients.claim();
    })(),
  );
});

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

self.addEventListener('fetch', (event) => {
  if (DEV_MODE) return;
  const kind = classifyRequest(event.request, self.location.origin);
  if (kind === 'navigate') event.respondWith(handleNavigation(event));
  else if (kind === 'static') event.respondWith(cacheFirst(event));
  else if (kind === 'asset') event.respondWith(staleWhileRevalidate(event));
  // 'passthrough': no llamamos respondWith y el navegador va directo a la red.
});

/**
 * Decide la estrategia para un request.
 *
 * @param {{ url: string; method: string; mode: string; headers: { get(name: string): string | null } }} request
 * @param {string} origin Origen del SW (`self.location.origin`).
 * @returns {'navigate' | 'static' | 'asset' | 'passthrough'}
 */
function classifyRequest(request, origin) {
  if (request.method !== 'GET') return 'passthrough';
  const url = new URL(request.url);
  if (url.origin !== origin) return 'passthrough';
  // Audio y video piden rangos: los resuelve el navegador directo.
  if (request.headers.get('range')) return 'passthrough';
  if (request.mode === 'navigate') return 'navigate';
  // Navegación client-side de Next: payload RSC con datos de la familia.
  if (request.headers.get('rsc') || url.searchParams.has('_rsc')) return 'passthrough';
  if (url.pathname.startsWith('/_next/static/')) return 'static';
  if (ASSET_PATHS.has(url.pathname) || url.pathname.startsWith('/shortcut-icons/')) return 'asset';
  return 'passthrough';
}

/**
 * Network-first sin guardar nada: el HTML de cada página es privado. Si la
 * red falla, devolvemos la página offline (la URL del navegador no cambia,
 * así "Reintentar" recarga la página que la persona quería ver).
 *
 * @param {FetchEvent} event
 */
async function handleNavigation(event) {
  try {
    const preloaded = await event.preloadResponse;
    const response = preloaded || (await fetch(event.request));
    event.waitUntil(refreshOfflineCacheIfStale().catch(() => undefined));
    return response;
  } catch {
    const cached = await matchOfflinePage();
    if (cached) return cached;
    return new Response(OFFLINE_FALLBACK_HTML, {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}

/**
 * Cache-first para `_next/static`: los nombres llevan hash, así que un
 * archivo cacheado nunca queda viejo.
 *
 * @param {FetchEvent} event
 */
async function cacheFirst(event) {
  const cached = await caches.match(event.request);
  if (cached) return cached;
  const response = await fetch(event.request);
  if (isCacheable(response)) {
    const cache = await caches.open(STATIC_CACHE);
    await cache.put(event.request, response.clone());
    event.waitUntil(trimCache(STATIC_CACHE, STATIC_CACHE_MAX_ENTRIES).catch(() => undefined));
  }
  return response;
}

/**
 * Stale-while-revalidate para íconos y manifest.
 *
 * @param {FetchEvent} event
 */
async function staleWhileRevalidate(event) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(event.request);
  const network = fetch(event.request).then(async (response) => {
    if (isCacheable(response)) await cache.put(event.request, response.clone());
    return response;
  });
  if (cached) {
    event.waitUntil(network.catch(() => undefined));
    return cached;
  }
  return network;
}

/**
 * Solo guardamos respuestas propias, exitosas y sin redirect (si el proxy
 * mandó a /login, eso no es el ícono que pedimos).
 *
 * @param {Response} response
 */
function isCacheable(response) {
  return Boolean(response) && response.ok && response.type === 'basic' && !response.redirected;
}

/**
 * @param {string} cacheName
 * @param {number} maxEntries
 */
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  const excess = keys.length - maxEntries;
  // `keys()` respeta el orden de inserción: borramos los más viejos.
  for (let i = 0; i < excess; i++) await cache.delete(keys[i]);
}

// ---------------------------------------------------------------------------
// Página offline
// ---------------------------------------------------------------------------

/**
 * Saca del HTML las URLs de `/_next/static/...` (CSS, JS, fuentes) que la
 * página necesita para verse bien sin red.
 *
 * @param {string} html
 * @returns {string[]}
 */
function extractStaticAssetUrls(html) {
  const found = new Set();
  for (const match of html.matchAll(/\/_next\/static\/[^"'\s)\\<>]+/g)) {
    found.add(match[0].replace(/&amp;/g, '&'));
  }
  return [...found];
}

let offlineRefresh = null;

/** Guarda `/offline` y sus assets. Una sola corrida a la vez. */
function refreshOfflineCache() {
  if (!offlineRefresh) {
    offlineRefresh = buildOfflineCache().finally(() => {
      offlineRefresh = null;
    });
  }
  return offlineRefresh;
}

async function matchOfflinePage() {
  const cache = await caches.open(OFFLINE_CACHE);
  return cache.match(OFFLINE_URL);
}

async function refreshOfflineCacheIfStale() {
  const cached = await matchOfflinePage();
  const cachedAt = Number(cached?.headers.get(CACHED_AT_HEADER) ?? 0);
  if (Date.now() - cachedAt < OFFLINE_MAX_AGE_MS) return;
  await refreshOfflineCache();
}

async function buildOfflineCache() {
  // Sin cookies: la página offline es pública y no queremos guardar nada
  // atado a una sesión.
  const response = await fetch(OFFLINE_URL, { cache: 'no-store', credentials: 'omit' });
  if (!isCacheable(response)) throw new Error('La página offline no se pudo cachear.');
  const html = await response.text();

  // Bajamos todo antes de tocar el caché, así un corte a mitad de camino no
  // deja la página offline sin su CSS.
  const assets = await Promise.all(
    extractStaticAssetUrls(html).map(async (url) => {
      try {
        // Si ya lo tenemos (lo bajó alguna página), lo reusamos sin red.
        const existing = await caches.match(url);
        if (existing) return [url, existing];
        const fresh = await fetch(url, { credentials: 'omit' });
        return isCacheable(fresh) ? [url, fresh] : null;
      } catch {
        return null;
      }
    }),
  );

  await caches.delete(OFFLINE_CACHE);
  const cache = await caches.open(OFFLINE_CACHE);
  // Headers nuevos: los originales traen content-encoding/length del cuerpo
  // comprimido, que ya no corresponden al HTML decodificado.
  const headers = new Headers({
    'Content-Type': response.headers.get('Content-Type') ?? 'text/html; charset=utf-8',
    [CACHED_AT_HEADER]: String(Date.now()),
  });
  await cache.put(OFFLINE_URL, new Response(html, { status: 200, headers }));
  await Promise.all(assets.filter(Boolean).map(([url, asset]) => cache.put(url, asset)));
}

async function precacheAssets() {
  const cache = await caches.open(ASSET_CACHE);
  await Promise.all(
    PRECACHE_ASSETS.map(async (url) => {
      const response = await fetch(url, { credentials: 'omit' });
      if (isCacheable(response)) await cache.put(url, response);
    }),
  );
}

// ---------------------------------------------------------------------------
// Push
// ---------------------------------------------------------------------------

/**
 * Solo aceptamos rutas internas: un payload no puede mandarnos a otro sitio.
 *
 * @param {unknown} value
 * @returns {string}
 */
function safeNotificationUrl(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return DEFAULT_NOTIFICATION_URL;
  }
  return value;
}

/**
 * Arma título y opciones de la notificación a partir del payload del push.
 * Nunca tira: con datos vacíos o rotos muestra un aviso genérico.
 *
 * @param {{ json(): unknown; text(): string } | null | undefined} data
 * @returns {{ title: string; options: NotificationOptions }}
 */
function buildNotification(data) {
  /** @type {{ title?: unknown; body?: unknown; url?: unknown; icon?: unknown; tag?: unknown }} */
  let payload = {};
  if (data) {
    try {
      const parsed = data.json();
      if (parsed && typeof parsed === 'object') payload = parsed;
    } catch {
      try {
        payload = { body: data.text() };
      } catch {
        payload = {};
      }
    }
  }

  const title = typeof payload.title === 'string' && payload.title ? payload.title : 'Salu';
  const body = typeof payload.body === 'string' && payload.body ? payload.body : 'Hay novedades.';
  const tag = typeof payload.tag === 'string' && payload.tag ? payload.tag : undefined;
  const icon =
    typeof payload.icon === 'string' ? safeNotificationUrl(payload.icon) : '/icon-192.png';

  return {
    title,
    options: {
      body,
      icon,
      badge: '/icon-badge.png',
      lang: 'es-AR',
      tag,
      // Con el mismo tag, la nueva reemplaza a la anterior pero vuelve a sonar.
      renotify: Boolean(tag),
      timestamp: Date.now(),
      vibrate: [60, 30, 60],
      data: { url: safeNotificationUrl(payload.url) },
    },
  };
}

self.addEventListener('push', (event) => {
  const { title, options } = buildNotification(event.data);
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = safeNotificationUrl(event.notification.data?.url);
  event.waitUntil(focusOrOpen(new URL(path, self.location.origin).href));
});

/**
 * Si ya hay una ventana de Salu abierta, la traemos al frente y la llevamos
 * a la URL de la notificación. Si no, abrimos una nueva.
 *
 * @param {string} targetUrl
 */
async function focusOrOpen(targetUrl) {
  const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
  const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
  if (!existing) {
    await clients.openWindow(targetUrl);
    return;
  }
  // Primero el foco: hay que pedirlo mientras dura el gesto del click.
  const focused = await existing.focus().catch(() => existing);
  if (focused.url === targetUrl || !('navigate' in focused)) return;
  try {
    await focused.navigate(targetUrl);
  } catch {
    /* ventana no controlada por este SW: al menos quedó al frente */
  }
}
