// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests de `public/sw.js`. El archivo es un script clásico (no módulo), así
 * que lo corremos en un contexto `vm` con un `self` falso, CacheStorage en
 * memoria y `fetch` mockeado, y le disparamos eventos como haría el navegador.
 */

const SW_SOURCE = readFileSync(resolve(__dirname, '../../public/sw.js'), 'utf8');
const ORIGIN = 'https://salu.test';

type RequestLike = string | { url: string };

function keyOf(request: RequestLike): string {
  return typeof request === 'string' ? new URL(request, ORIGIN).href : request.url;
}

class MemoryCache {
  readonly store = new Map<string, Response>();
  async match(request: RequestLike) {
    return this.store.get(keyOf(request))?.clone();
  }
  async put(request: RequestLike, response: Response) {
    this.store.set(keyOf(request), response);
  }
  async keys() {
    return [...this.store.keys()].map((url) => ({ url }));
  }
  async delete(request: RequestLike) {
    return this.store.delete(keyOf(request));
  }
}

class MemoryCacheStorage {
  readonly caches = new Map<string, MemoryCache>();
  async open(name: string) {
    let cache = this.caches.get(name);
    if (!cache) {
      cache = new MemoryCache();
      this.caches.set(name, cache);
    }
    return cache;
  }
  async keys() {
    return [...this.caches.keys()];
  }
  async delete(name: string) {
    return this.caches.delete(name);
  }
  async match(request: RequestLike) {
    for (const cache of this.caches.values()) {
      const hit = await cache.match(request);
      if (hit) return hit;
    }
    return undefined;
  }
  /** Todas las URLs guardadas, en cualquier caché. */
  allUrls(): string[] {
    return [...this.caches.values()].flatMap((cache) => [...cache.store.keys()]);
  }
}

/** Respuesta same-origin como las que ve un SW real (`type: 'basic'`). */
function basic(body: string, init: ResponseInit & { redirected?: boolean } = {}): Response {
  const response = new Response(body, init);
  Object.defineProperty(response, 'type', { value: 'basic' });
  if (init.redirected) Object.defineProperty(response, 'redirected', { value: true });
  return response;
}

type FetchImpl = (input: RequestLike, init?: RequestInit) => Promise<Response>;
type Listener = (event: unknown) => void;

interface WindowClientStub {
  url: string;
  focus: ReturnType<typeof vi.fn>;
  navigate: ReturnType<typeof vi.fn>;
}

function loadServiceWorker(options: { scriptUrl?: string; fetch: FetchImpl }) {
  const listeners = new Map<string, Listener>();
  const caches = new MemoryCacheStorage();
  const windows: WindowClientStub[] = [];
  const registration = {
    showNotification: vi.fn(async () => undefined),
    navigationPreload: {
      enable: vi.fn(async () => undefined),
      disable: vi.fn(async () => undefined),
    },
  };
  const clients = {
    matchAll: vi.fn(async () => windows),
    openWindow: vi.fn(async () => null),
    claim: vi.fn(async () => undefined),
  };
  const fetchMock = vi.fn(options.fetch);
  const self = {
    location: new URL(options.scriptUrl ?? `${ORIGIN}/sw.js`),
    registration,
    clients,
    skipWaiting: vi.fn(async () => undefined),
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
  };
  const context = vm.createContext({
    self,
    caches,
    clients,
    fetch: fetchMock,
    URL,
    Headers,
    Response,
    Request,
    Promise,
  });
  vm.runInContext(SW_SOURCE, context);

  return {
    context: context as unknown as {
      classifyRequest: (request: unknown, origin: string) => string;
      extractStaticAssetUrls: (html: string) => string[];
    },
    caches,
    windows,
    registration,
    clients,
    fetchMock,
    self,
    dispatch(type: string, event: unknown) {
      const listener = listeners.get(type);
      if (!listener) throw new Error(`sin listener para ${type}`);
      listener(event);
    },
  };
}

type Sw = ReturnType<typeof loadServiceWorker>;

/** Evento con waitUntil/respondWith que junta las promesas para esperarlas. */
function extendableEvent<T extends object>(fields: T) {
  const pending: Promise<unknown>[] = [];
  let response: Promise<Response> | undefined;
  return {
    ...fields,
    waitUntil(promise: Promise<unknown>) {
      pending.push(promise);
    },
    respondWith(value: Promise<Response> | Response) {
      response = Promise.resolve(value);
    },
    get response() {
      return response;
    },
    async settled() {
      const result = response ? await response : undefined;
      // waitUntil puede sumar promesas mientras se resuelven otras.
      for (let i = 0; i < pending.length; i++) await pending[i];
      return result;
    },
  };
}

function request(
  path: string,
  init: { mode?: string; method?: string; headers?: HeadersInit } = {},
) {
  return {
    url: new URL(path, ORIGIN).href,
    method: init.method ?? 'GET',
    mode: init.mode ?? 'cors',
    headers: new Headers(init.headers),
  };
}

const OFFLINE_HTML =
  '<html><head><link rel="stylesheet" href="/_next/static/css/app.css?dpl=dpl_1"></head>' +
  '<body><script src="/_next/static/chunks/main.js" async></script>' +
  '<script>self.__next_f.push([1,"\\"/_next/static/chunks/main.js\\""])</script></body></html>';

function siteFetch(overrides: Record<string, () => Promise<Response>> = {}): FetchImpl {
  return async (input) => {
    const url = new URL(keyOf(input));
    const override = overrides[url.pathname];
    if (override) return override();
    if (url.pathname === '/offline')
      return basic(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html' } });
    return basic(`contenido de ${url.pathname}`);
  };
}

async function install(sw: Sw) {
  const event = extendableEvent({});
  sw.dispatch('install', event);
  await event.settled();
}

describe('classifyRequest', () => {
  let sw: Sw;
  beforeEach(() => {
    sw = loadServiceWorker({ fetch: siteFetch() });
  });

  const classify = (req: ReturnType<typeof request>) => sw.context.classifyRequest(req, ORIGIN);

  it('las navegaciones van por la estrategia de páginas', () => {
    expect(classify(request('/cuidar', { mode: 'navigate' }))).toBe('navigate');
  });

  it('los chunks de Next y las fuentes son estáticos', () => {
    expect(classify(request('/_next/static/chunks/app.js'))).toBe('static');
    expect(classify(request('/_next/static/media/geist.woff2'))).toBe('static');
  });

  it('íconos, manifest y atajos son assets', () => {
    expect(classify(request('/manifest.webmanifest'))).toBe('asset');
    expect(classify(request('/icon-192.png'))).toBe('asset');
    expect(classify(request('/apple-icon?abc123'))).toBe('asset');
    expect(classify(request('/shortcut-icons/toma.png'))).toBe('asset');
  });

  it('no toca nada autenticado ni de otros orígenes', () => {
    expect(classify(request('https://abc.supabase.co/rest/v1/feeding_events'))).toBe('passthrough');
    expect(classify(request('/api/cron/reminder'))).toBe('passthrough');
    expect(classify(request('/home', { headers: { RSC: '1' } }))).toBe('passthrough');
    expect(classify(request('/home?_rsc=abc'))).toBe('passthrough');
    expect(classify(request('/home', { method: 'POST' }))).toBe('passthrough');
    expect(classify(request('/_next/image?url=foto.jpg'))).toBe('passthrough');
    expect(classify(request('/audio/cancion.mp3', { headers: { Range: 'bytes=0-' } }))).toBe(
      'passthrough',
    );
  });
});

describe('extractStaticAssetUrls', () => {
  it('saca CSS, JS y chunks escapados del payload RSC sin repetir', () => {
    const sw = loadServiceWorker({ fetch: siteFetch() });
    expect(sw.context.extractStaticAssetUrls(OFFLINE_HTML)).toEqual([
      '/_next/static/css/app.css?dpl=dpl_1',
      '/_next/static/chunks/main.js',
    ]);
  });
});

describe('install y activate', () => {
  it('guarda /offline (sin cookies) con su CSS y JS', async () => {
    const sw = loadServiceWorker({ fetch: siteFetch() });
    await install(sw);

    const offlineCall = sw.fetchMock.mock.calls.find(([input]) =>
      keyOf(input).endsWith('/offline'),
    );
    expect(offlineCall?.[1]).toMatchObject({ credentials: 'omit' });
    expect(sw.caches.allUrls()).toEqual(
      expect.arrayContaining([
        `${ORIGIN}/offline`,
        `${ORIGIN}/_next/static/css/app.css?dpl=dpl_1`,
        `${ORIGIN}/_next/static/chunks/main.js`,
        `${ORIGIN}/icon-192.png`,
      ]),
    );
    expect(sw.self.skipWaiting).toHaveBeenCalled();
  });

  it('guarda /offline sin los headers de compresión de la respuesta original', async () => {
    const sw = loadServiceWorker({
      fetch: siteFetch({
        '/offline': async () =>
          basic(OFFLINE_HTML, {
            headers: {
              'Content-Type': 'text/html',
              'Content-Encoding': 'gzip',
              'Content-Length': '10',
            },
          }),
      }),
    });
    await install(sw);

    const cached = await (await sw.caches.open('salu-offline-v2')).match('/offline');
    expect(cached?.headers.get('content-encoding')).toBeNull();
    expect(cached?.headers.get('content-type')).toBe('text/html');
    expect(cached?.headers.get('x-salu-cached-at')).toMatch(/^\d+$/);
  });

  it('si /offline redirige (proxy sin sesión), no guarda el login', async () => {
    const sw = loadServiceWorker({
      fetch: siteFetch({
        '/offline': async () => basic('<html>login</html>', { redirected: true }),
      }),
    });
    await install(sw);
    expect(sw.caches.allUrls()).not.toContain(`${ORIGIN}/offline`);
    expect(sw.self.skipWaiting).toHaveBeenCalled();
  });

  it('activate borra cachés viejos de Salu y deja los ajenos', async () => {
    const sw = loadServiceWorker({ fetch: siteFetch() });
    await sw.caches.open('salu-static-v1');
    await sw.caches.open('otra-cosa');
    await install(sw);

    const event = extendableEvent({});
    sw.dispatch('activate', event);
    await event.settled();

    const names = await sw.caches.keys();
    expect(names).not.toContain('salu-static-v1');
    expect(names).toContain('otra-cosa');
    expect(names).toContain('salu-offline-v2');
    expect(sw.registration.navigationPreload.enable).toHaveBeenCalled();
    expect(sw.clients.claim).toHaveBeenCalled();
  });
});

describe('fetch', () => {
  it('navegación con red: devuelve la página y no la guarda', async () => {
    const sw = loadServiceWorker({
      fetch: siteFetch({ '/cuidar': async () => basic('<html>datos privados</html>') }),
    });
    await install(sw);

    const event = extendableEvent({
      request: request('/cuidar', { mode: 'navigate' }),
      preloadResponse: Promise.resolve(undefined),
    });
    sw.dispatch('fetch', event);
    const response = await event.settled();

    expect(await response?.text()).toBe('<html>datos privados</html>');
    expect(sw.caches.allUrls()).not.toContain(`${ORIGIN}/cuidar`);
  });

  it('usa la respuesta de navigation preload si está', async () => {
    const sw = loadServiceWorker({ fetch: siteFetch() });
    await install(sw);
    sw.fetchMock.mockClear();

    const event = extendableEvent({
      request: request('/home', { mode: 'navigate' }),
      preloadResponse: Promise.resolve(basic('<html>preload</html>')),
    });
    sw.dispatch('fetch', event);

    expect(await (await event.settled())?.text()).toBe('<html>preload</html>');
    expect(sw.fetchMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ url: `${ORIGIN}/home` }),
    );
  });

  it('navegación sin red: devuelve la página offline guardada', async () => {
    let online = true;
    const base = siteFetch();
    const sw = loadServiceWorker({
      fetch: (input, init) =>
        online ? base(input, init) : Promise.reject(new TypeError('offline')),
    });
    await install(sw);
    online = false;

    const event = extendableEvent({
      request: request('/timeline', { mode: 'navigate' }),
      preloadResponse: Promise.resolve(undefined),
    });
    sw.dispatch('fetch', event);

    expect(await (await event.settled())?.text()).toBe(OFFLINE_HTML);
  });

  it('sin red y sin página guardada: HTML mínimo de respaldo', async () => {
    const sw = loadServiceWorker({ fetch: () => Promise.reject(new TypeError('offline')) });
    const event = extendableEvent({
      request: request('/home', { mode: 'navigate' }),
      preloadResponse: Promise.resolve(undefined),
    });
    sw.dispatch('fetch', event);
    const response = await event.settled();

    expect(response?.status).toBe(503);
    expect(await response?.text()).toContain('Sin señal');
  });

  it('chunks estáticos: la segunda vez salen del caché', async () => {
    const sw = loadServiceWorker({ fetch: siteFetch() });
    const chunk = () => request('/_next/static/chunks/page-abc123.js');

    const first = extendableEvent({ request: chunk() });
    sw.dispatch('fetch', first);
    expect(await (await first.settled())?.text()).toBe(
      'contenido de /_next/static/chunks/page-abc123.js',
    );

    sw.fetchMock.mockClear();
    const second = extendableEvent({ request: chunk() });
    sw.dispatch('fetch', second);
    expect(await (await second.settled())?.text()).toBe(
      'contenido de /_next/static/chunks/page-abc123.js',
    );
    expect(sw.fetchMock).not.toHaveBeenCalled();
  });

  it('no guarda respuestas con error', async () => {
    const sw = loadServiceWorker({
      fetch: siteFetch({
        '/_next/static/chunks/roto.js': async () => basic('nope', { status: 404 }),
      }),
    });
    const event = extendableEvent({ request: request('/_next/static/chunks/roto.js') });
    sw.dispatch('fetch', event);
    await event.settled();
    expect(sw.caches.allUrls()).not.toContain(`${ORIGIN}/_next/static/chunks/roto.js`);
  });

  it('requests a Supabase o /api ni siquiera pasan por respondWith', () => {
    const sw = loadServiceWorker({ fetch: siteFetch() });
    for (const path of ['https://abc.supabase.co/auth/v1/user', '/api/alexa']) {
      const event = extendableEvent({ request: request(path) });
      sw.dispatch('fetch', event);
      expect(event.response).toBeUndefined();
    }
  });

  it('en modo desarrollo no intercepta nada', () => {
    const sw = loadServiceWorker({ scriptUrl: `${ORIGIN}/sw.js?dev=1`, fetch: siteFetch() });
    const event = extendableEvent({ request: request('/_next/static/chunks/app.js') });
    sw.dispatch('fetch', event);
    expect(event.response).toBeUndefined();
  });
});

describe('push', () => {
  function pushData(value: unknown) {
    return {
      json: () => (typeof value === 'string' ? JSON.parse(value) : value),
      text: () => (typeof value === 'string' ? value : JSON.stringify(value)),
    };
  }

  it('sin datos igual muestra una notificación (iOS lo exige)', async () => {
    const sw = loadServiceWorker({ fetch: siteFetch() });
    const event = extendableEvent({ data: null });
    sw.dispatch('push', event);
    await event.settled();

    expect(sw.registration.showNotification).toHaveBeenCalledWith(
      'Salu',
      expect.objectContaining({ body: 'Hay novedades.', data: { url: '/home' } }),
    );
  });

  it('usa título, cuerpo, tag y url del payload', async () => {
    const sw = loadServiceWorker({ fetch: siteFetch() });
    const event = extendableEvent({
      data: pushData({
        title: 'Abril: Salu se durmió',
        body: 'Empieza la siesta.',
        url: '/home',
        tag: 'sleep-1',
      }),
    });
    sw.dispatch('push', event);
    await event.settled();

    expect(sw.registration.showNotification).toHaveBeenCalledWith(
      'Abril: Salu se durmió',
      expect.objectContaining({
        body: 'Empieza la siesta.',
        tag: 'sleep-1',
        renotify: true,
        badge: '/icon-badge.png',
        data: { url: '/home' },
      }),
    );
  });

  it('texto plano va como cuerpo', async () => {
    const sw = loadServiceWorker({ fetch: siteFetch() });
    const event = extendableEvent({ data: pushData('hola, esto no es JSON') });
    sw.dispatch('push', event);
    await event.settled();
    expect(sw.registration.showNotification).toHaveBeenCalledWith(
      'Salu',
      expect.objectContaining({ body: 'hola, esto no es JSON' }),
    );
  });

  it('una url externa en el payload se reemplaza por /home', async () => {
    const sw = loadServiceWorker({ fetch: siteFetch() });
    const event = extendableEvent({
      data: pushData({ title: 'x', body: 'y', url: 'https://malo.com' }),
    });
    sw.dispatch('push', event);
    await event.settled();
    expect(sw.registration.showNotification).toHaveBeenCalledWith(
      'x',
      expect.objectContaining({ data: { url: '/home' } }),
    );
  });
});

describe('notificationclick', () => {
  function clickEvent(url: unknown) {
    return extendableEvent({ notification: { close: vi.fn(), data: { url } } });
  }

  it('sin ventanas abiertas abre una nueva en la url', async () => {
    const sw = loadServiceWorker({ fetch: siteFetch() });
    const event = clickEvent('/perfil');
    sw.dispatch('notificationclick', event);
    await event.settled();

    expect(event.notification.close).toHaveBeenCalled();
    expect(sw.clients.openWindow).toHaveBeenCalledWith(`${ORIGIN}/perfil`);
  });

  it('con Salu abierta la trae al frente y navega', async () => {
    const sw = loadServiceWorker({ fetch: siteFetch() });
    const client: WindowClientStub = {
      url: `${ORIGIN}/timeline`,
      focus: vi.fn(async () => client),
      navigate: vi.fn(async () => client),
    };
    sw.windows.push(client);

    const event = clickEvent('/home');
    sw.dispatch('notificationclick', event);
    await event.settled();

    expect(client.focus).toHaveBeenCalled();
    expect(client.navigate).toHaveBeenCalledWith(`${ORIGIN}/home`);
    expect(sw.clients.openWindow).not.toHaveBeenCalled();
  });

  it('nunca abre urls de otros sitios', async () => {
    const sw = loadServiceWorker({ fetch: siteFetch() });
    const event = clickEvent('//malo.com/phishing');
    sw.dispatch('notificationclick', event);
    await event.settled();
    expect(sw.clients.openWindow).toHaveBeenCalledWith(`${ORIGIN}/home`);
  });
});
