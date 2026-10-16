import { InstallHint } from '@/components/salu/install-hint';
import { INSTALL_HINT_STORAGE_KEY } from '@/lib/pwa/platform';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';

function setDevice({ userAgent, standalone = false }: { userAgent: string; standalone?: boolean }) {
  Object.defineProperty(window.navigator, 'userAgent', { value: userAgent, configurable: true });
  Object.defineProperty(window.navigator, 'maxTouchPoints', { value: 5, configurable: true });
  Object.defineProperty(window.navigator, 'standalone', { value: standalone, configurable: true });
}

function fireBeforeInstallPrompt(outcome: 'accepted' | 'dismissed') {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  const prompt = vi.fn(async () => undefined);
  Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome }) });
  act(() => {
    window.dispatchEvent(event);
  });
  return { event, prompt };
}

/** localStorage en memoria: en Node 25+ el global nativo tapa al de happy-dom. */
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => {
      data.delete(key);
    },
    setItem: (key, value) => {
      data.set(key, String(value));
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('localStorage', memoryStorage());
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('InstallHint', () => {
  it('en iPhone sin instalar muestra los pasos de Compartir → Agregar a inicio', () => {
    setDevice({ userAgent: IPHONE });
    render(<InstallHint />);
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(screen.getByText('Instalá Salu en tu iPhone')).toBeInTheDocument();
    expect(screen.getByText('Agregar a inicio')).toBeInTheDocument();
    expect(screen.getByText(/te llegan los avisos/)).toBeInTheDocument();
  });

  it('no aparece si Salu ya está instalada', () => {
    setDevice({ userAgent: IPHONE, standalone: true });
    render(<InstallHint />);
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.queryByRole('region', { name: 'Instalar Salu' })).not.toBeInTheDocument();
  });

  it('no insiste si la descartaron hace poco', () => {
    setDevice({ userAgent: IPHONE });
    window.localStorage.setItem(INSTALL_HINT_STORAGE_KEY, String(Date.now() - 60_000));
    render(<InstallHint />);
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.queryByRole('region', { name: 'Instalar Salu' })).not.toBeInTheDocument();
  });

  it('cerrar guarda el descarte', () => {
    setDevice({ userAgent: IPHONE });
    render(<InstallHint />);
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sugerencia' }));

    expect(screen.queryByRole('region', { name: 'Instalar Salu' })).not.toBeInTheDocument();
    expect(window.localStorage.getItem(INSTALL_HINT_STORAGE_KEY)).not.toBeNull();
  });

  it('en Android usa el prompt nativo del navegador', async () => {
    setDevice({ userAgent: ANDROID });
    render(<InstallHint />);
    const { event, prompt } = fireBeforeInstallPrompt('accepted');

    expect(event.defaultPrevented).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Instalar' }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(prompt).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('region', { name: 'Instalar Salu' })).not.toBeInTheDocument();
  });

  it('si rechazan el diálogo nativo, cuenta como descarte', async () => {
    setDevice({ userAgent: ANDROID });
    render(<InstallHint />);
    fireBeforeInstallPrompt('dismissed');
    fireEvent.click(screen.getByRole('button', { name: 'Instalar' }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(window.localStorage.getItem(INSTALL_HINT_STORAGE_KEY)).not.toBeNull();
  });

  it('si ya la descartaron, no secuestra el prompt del navegador', () => {
    setDevice({ userAgent: ANDROID });
    window.localStorage.setItem(INSTALL_HINT_STORAGE_KEY, String(Date.now()));
    render(<InstallHint />);
    const { event } = fireBeforeInstallPrompt('accepted');

    expect(event.defaultPrevented).toBe(false);
    expect(screen.queryByRole('button', { name: 'Instalar' })).not.toBeInTheDocument();
  });
});
