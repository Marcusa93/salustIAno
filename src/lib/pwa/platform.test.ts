import { describe, expect, it } from 'vitest';
import {
  type DeviceInfo,
  INSTALL_HINT_DISMISS_TTL_MS,
  detectPlatform,
  getInstallHintKind,
  getIosVersion,
  iosSupportsWebPush,
  isInstallHintDismissed,
} from './platform';

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0.6367.111 Mobile/15E148 Safari/604.1';
const IPHONE_OLD =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.3 Mobile/15E148 Safari/604.1';
const IPAD_DESKTOP_MODE =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const MAC_CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const NOW = Date.UTC(2026, 9, 16, 12);

function device(overrides: Partial<DeviceInfo> = {}): DeviceInfo {
  return { platform: 'other', iosVersion: null, standalone: false, ...overrides };
}

describe('detectPlatform', () => {
  it('reconoce iPhone en Safari y en Chrome', () => {
    expect(detectPlatform(IPHONE_SAFARI, 5)).toBe('ios');
    expect(detectPlatform(IPHONE_CHROME, 5)).toBe('ios');
  });

  it('reconoce el iPad que se presenta como Mac por la pantalla táctil', () => {
    expect(detectPlatform(IPAD_DESKTOP_MODE, 5)).toBe('ios');
    expect(detectPlatform(IPAD_DESKTOP_MODE, 0)).toBe('other');
  });

  it('reconoce Android y deja el resto como other', () => {
    expect(detectPlatform(ANDROID_CHROME, 5)).toBe('android');
    expect(detectPlatform(MAC_CHROME, 0)).toBe('other');
  });
});

describe('getIosVersion', () => {
  it('lee la versión del sistema en iPhone', () => {
    expect(getIosVersion(IPHONE_SAFARI)).toEqual({ major: 18, minor: 5 });
    expect(getIosVersion(IPHONE_CHROME)).toEqual({ major: 17, minor: 4 });
    expect(getIosVersion(IPHONE_OLD)).toEqual({ major: 16, minor: 3 });
  });

  it('en iPad con UA de Mac usa la versión de Safari', () => {
    expect(getIosVersion(IPAD_DESKTOP_MODE)).toEqual({ major: 17, minor: 4 });
  });

  it('devuelve null si no encuentra versión', () => {
    expect(getIosVersion('Mozilla/5.0 (Linux; Android 14)')).toBeNull();
  });
});

describe('iosSupportsWebPush', () => {
  it('pide iOS 16.4 o más nuevo', () => {
    expect(iosSupportsWebPush({ major: 16, minor: 3 })).toBe(false);
    expect(iosSupportsWebPush({ major: 16, minor: 4 })).toBe(true);
    expect(iosSupportsWebPush({ major: 17, minor: 0 })).toBe(true);
    expect(iosSupportsWebPush({ major: 15, minor: 8 })).toBe(false);
  });
});

describe('isInstallHintDismissed', () => {
  it('respeta la ventana de 30 días', () => {
    expect(isInstallHintDismissed(null, NOW)).toBe(false);
    expect(isInstallHintDismissed(String(NOW - 1000), NOW)).toBe(true);
    expect(isInstallHintDismissed(String(NOW - INSTALL_HINT_DISMISS_TTL_MS - 1), NOW)).toBe(false);
  });

  it('ignora valores rotos', () => {
    expect(isInstallHintDismissed('no-es-numero', NOW)).toBe(false);
  });
});

describe('getInstallHintKind', () => {
  const base = { canPrompt: false, dismissedAt: null, now: NOW };

  it('no sugiere nada si ya está instalada', () => {
    expect(
      getInstallHintKind({ ...base, device: device({ platform: 'ios', standalone: true }) }),
    ).toBeNull();
    expect(
      getInstallHintKind({ ...base, canPrompt: true, device: device({ standalone: true }) }),
    ).toBeNull();
  });

  it('en iPhone sin instalar muestra los pasos', () => {
    expect(getInstallHintKind({ ...base, device: device({ platform: 'ios' }) })).toBe('ios');
  });

  it('con prompt del navegador ofrece el botón Instalar', () => {
    expect(
      getInstallHintKind({ ...base, canPrompt: true, device: device({ platform: 'android' }) }),
    ).toBe('prompt');
  });

  it('en Android sin prompt no muestra nada', () => {
    expect(getInstallHintKind({ ...base, device: device({ platform: 'android' }) })).toBeNull();
  });

  it('si la descartaron hace poco no insiste', () => {
    expect(
      getInstallHintKind({
        ...base,
        dismissedAt: String(NOW - 60_000),
        device: device({ platform: 'ios' }),
      }),
    ).toBeNull();
  });
});
