import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/app/(app)/perfil/push-actions', () => ({
  sendTestPushAction: vi.fn(),
  subscribeUserToPushAction: vi.fn(),
  unsubscribeUserFromPushAction: vi.fn(),
}));
vi.mock('@/lib/pwa/service-worker', () => ({
  registerServiceWorker: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { PushToggle } from '@/app/(app)/perfil/_components/push-toggle';
import {
  sendTestPushAction,
  subscribeUserToPushAction,
  unsubscribeUserFromPushAction,
} from '@/app/(app)/perfil/push-actions';
import { urlBase64ToUint8Array } from '@/lib/pwa/push-support';
import { registerServiceWorker } from '@/lib/pwa/service-worker';
import { toast } from 'sonner';

const PUBLIC_KEY = 'BAQIDw';
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';

function fakeSubscription(endpoint = 'https://fcm.googleapis.com/fcm/send/abc') {
  return {
    endpoint,
    options: { applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY).buffer },
    toJSON: () => ({ endpoint, keys: { p256dh: 'p256', auth: 'auth' } }),
    unsubscribe: vi.fn(async () => true),
  };
}

type FakeSubscription = ReturnType<typeof fakeSubscription>;

interface BrowserSetup {
  userAgent?: string;
  standalone?: boolean;
  permission?: NotificationPermission;
  requestPermissionResult?: NotificationPermission;
  existing?: FakeSubscription | null;
  pushApis?: boolean;
}

function setupBrowser({
  userAgent = ANDROID,
  standalone = false,
  permission = 'default',
  requestPermissionResult = 'granted',
  existing = null,
  pushApis = true,
}: BrowserSetup = {}) {
  let current = existing;
  const created = fakeSubscription('https://fcm.googleapis.com/fcm/send/nueva');
  const pushManager = {
    getSubscription: vi.fn(async () => current),
    subscribe: vi.fn(async () => {
      current = created;
      return created;
    }),
  };
  const registration = { pushManager };
  const requestPermission = vi.fn(async () => requestPermissionResult);

  Object.defineProperty(window.navigator, 'userAgent', { value: userAgent, configurable: true });
  Object.defineProperty(window.navigator, 'maxTouchPoints', { value: 5, configurable: true });
  Object.defineProperty(window.navigator, 'standalone', { value: standalone, configurable: true });
  if (pushApis) {
    Object.defineProperty(window.navigator, 'serviceWorker', {
      value: { ready: Promise.resolve(registration) },
      configurable: true,
    });
    Object.defineProperty(window, 'PushManager', { value: class {}, configurable: true });
    Object.defineProperty(window, 'Notification', {
      value: { permission, requestPermission },
      configurable: true,
    });
  }
  vi.mocked(registerServiceWorker).mockResolvedValue(registration as never);

  return { pushManager, requestPermission, created };
}

function removePushApis() {
  for (const target of [window.navigator, window] as object[]) {
    for (const key of ['serviceWorker', 'PushManager', 'Notification']) {
      if (Object.getOwnPropertyDescriptor(target, key)?.configurable) {
        Reflect.deleteProperty(target, key);
      }
    }
  }
}

beforeEach(() => {
  vi.mocked(subscribeUserToPushAction).mockResolvedValue({ ok: true });
  vi.mocked(unsubscribeUserFromPushAction).mockResolvedValue({ ok: true });
  vi.mocked(sendTestPushAction).mockResolvedValue({ ok: true, sent: 1 });
});

afterEach(() => {
  vi.clearAllMocks();
  removePushApis();
});

describe('PushToggle', () => {
  it('en iPhone sin instalar explica que hay que instalar Salu primero', async () => {
    setupBrowser({ userAgent: IPHONE, pushApis: false });
    render(<PushToggle publicKey={PUBLIC_KEY} serverConfigured />);

    expect(await screen.findByText('Falta instalar')).toBeInTheDocument();
    expect(screen.getByText('Agregar a inicio')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Activar avisos/ })).not.toBeInTheDocument();
  });

  it('avisa si el server no tiene las claves VAPID', async () => {
    setupBrowser();
    render(<PushToggle publicKey={null} serverConfigured={false} />);
    expect(await screen.findByText(/claves de notificaciones/)).toBeInTheDocument();
  });

  it('activa: pide permiso, se suscribe con la VAPID key y guarda en el server', async () => {
    const { pushManager, requestPermission, created } = setupBrowser();
    render(<PushToggle publicKey={PUBLIC_KEY} serverConfigured />);

    fireEvent.click(await screen.findByRole('button', { name: /Activar avisos/ }));

    expect(requestPermission).toHaveBeenCalledTimes(1);
    await screen.findByRole('button', { name: /Mandarme una de prueba/ });
    expect(pushManager.subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY),
    });
    expect(subscribeUserToPushAction).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: created.endpoint,
        keys: { p256dh: 'p256', auth: 'auth' },
      }),
    );
    expect(screen.getByText('Activadas')).toBeInTheDocument();
  });

  it('si la persona no da permiso, queda apagado y no se suscribe', async () => {
    const { pushManager } = setupBrowser({ requestPermissionResult: 'denied' });
    render(<PushToggle publicKey={PUBLIC_KEY} serverConfigured />);

    fireEvent.click(await screen.findByRole('button', { name: /Activar avisos/ }));

    expect(await screen.findByText('Bloqueadas')).toBeInTheDocument();
    expect(pushManager.subscribe).not.toHaveBeenCalled();
  });

  it('con avisos activos re-sincroniza y manda la prueba solo a este dispositivo', async () => {
    const existing = fakeSubscription();
    setupBrowser({ permission: 'granted', existing });
    render(<PushToggle publicKey={PUBLIC_KEY} serverConfigured />);

    fireEvent.click(await screen.findByRole('button', { name: /Mandarme una de prueba/ }));

    await waitFor(() => expect(sendTestPushAction).toHaveBeenCalledWith(existing.endpoint));
    expect(subscribeUserToPushAction).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: existing.endpoint }),
    );
    expect(await screen.findByText(/No llegó/)).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalled();
  });

  it('si la prueba dice que la suscripción murió, vuelve a ofrecer activar', async () => {
    const existing = fakeSubscription();
    setupBrowser({ permission: 'granted', existing });
    vi.mocked(sendTestPushAction).mockResolvedValue({
      ok: false,
      error: 'Este dispositivo ya no está suscripto.',
      resubscribe: true,
    });
    render(<PushToggle publicKey={PUBLIC_KEY} serverConfigured />);

    fireEvent.click(await screen.findByRole('button', { name: /Mandarme una de prueba/ }));

    expect(await screen.findByRole('button', { name: /Activar avisos/ })).toBeInTheDocument();
    expect(existing.unsubscribe).toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Este dispositivo ya no está suscripto.');
  });

  it('descarta suscripciones hechas con otra VAPID key', async () => {
    const stale = fakeSubscription();
    stale.options.applicationServerKey = urlBase64ToUint8Array('AAAA').buffer;
    setupBrowser({ permission: 'granted', existing: stale });
    render(<PushToggle publicKey={PUBLIC_KEY} serverConfigured />);

    expect(await screen.findByRole('button', { name: /Activar avisos/ })).toBeInTheDocument();
    expect(stale.unsubscribe).toHaveBeenCalled();
    expect(unsubscribeUserFromPushAction).toHaveBeenCalledWith(stale.endpoint);
  });

  it('bloqueadas: explica cómo habilitarlas en Android', async () => {
    setupBrowser({ permission: 'denied' });
    render(<PushToggle publicKey={PUBLIC_KEY} serverConfigured />);

    expect(await screen.findByText('Bloqueadas')).toBeInTheDocument();
    expect(screen.getByText(/Información de la app/)).toBeInTheDocument();
  });

  it('desactivar borra la suscripción del navegador y del server', async () => {
    const existing = fakeSubscription();
    setupBrowser({ permission: 'granted', existing });
    render(<PushToggle publicKey={PUBLIC_KEY} serverConfigured />);

    fireEvent.click(await screen.findByRole('button', { name: /Desactivar/ }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(await screen.findByRole('button', { name: /Activar avisos/ })).toBeInTheDocument();
    expect(existing.unsubscribe).toHaveBeenCalled();
    expect(unsubscribeUserFromPushAction).toHaveBeenCalledWith(existing.endpoint);
  });
});
