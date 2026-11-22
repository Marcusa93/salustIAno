import { describe, expect, it } from 'vitest';
import type { DeviceInfo } from './platform';
import {
  type PushApis,
  describeSubscribeError,
  getPushAvailability,
  resolvePushStatus,
  subscriptionMatchesKey,
  urlBase64ToUint8Array,
} from './push-support';

const ALL_APIS: PushApis = { serviceWorker: true, pushManager: true, notification: true };
const NO_PUSH: PushApis = { serviceWorker: true, pushManager: false, notification: false };

function device(overrides: Partial<DeviceInfo> = {}): DeviceInfo {
  return { platform: 'other', iosVersion: null, standalone: false, ...overrides };
}

describe('getPushAvailability', () => {
  it('en iPhone sin instalar pide instalar aunque falten las APIs', () => {
    expect(
      getPushAvailability(
        device({ platform: 'ios', iosVersion: { major: 18, minor: 0 } }),
        NO_PUSH,
      ),
    ).toBe('ios-install-required');
  });

  it('en iOS anterior a 16.4 pide actualizar', () => {
    expect(
      getPushAvailability(
        device({ platform: 'ios', iosVersion: { major: 16, minor: 1 }, standalone: true }),
        NO_PUSH,
      ),
    ).toBe('ios-update-required');
  });

  it('en iPhone instalado con las APIs está disponible', () => {
    expect(
      getPushAvailability(
        device({ platform: 'ios', iosVersion: { major: 17, minor: 2 }, standalone: true }),
        ALL_APIS,
      ),
    ).toBe('available');
  });

  it('en Android depende solo de las APIs', () => {
    expect(getPushAvailability(device({ platform: 'android' }), ALL_APIS)).toBe('available');
    expect(getPushAvailability(device({ platform: 'android' }), NO_PUSH)).toBe('unsupported');
  });
});

describe('resolvePushStatus', () => {
  const base = {
    availability: 'available' as const,
    serverConfigured: true,
    permission: 'default' as NotificationPermission,
    subscribed: false,
  };

  it('propaga los casos donde el navegador no puede', () => {
    expect(resolvePushStatus({ ...base, availability: 'ios-install-required' })).toBe(
      'ios-install-required',
    );
    expect(resolvePushStatus({ ...base, availability: 'unsupported' })).toBe('unsupported');
  });

  it('avisa si el server no tiene VAPID', () => {
    expect(resolvePushStatus({ ...base, serverConfigured: false })).toBe('server-off');
  });

  it('distingue bloqueadas, apagadas y activadas', () => {
    expect(resolvePushStatus({ ...base, permission: 'denied' })).toBe('denied');
    expect(resolvePushStatus(base)).toBe('off');
    expect(resolvePushStatus({ ...base, permission: 'granted' })).toBe('off');
    expect(resolvePushStatus({ ...base, permission: 'granted', subscribed: true })).toBe('on');
  });

  it('sin permiso, una suscripción vieja no cuenta como activada', () => {
    expect(resolvePushStatus({ ...base, subscribed: true })).toBe('off');
  });
});

describe('urlBase64ToUint8Array', () => {
  it('decodifica base64url con y sin padding', () => {
    expect(Array.from(urlBase64ToUint8Array('AQID'))).toEqual([1, 2, 3]);
    expect(Array.from(urlBase64ToUint8Array('_-8'))).toEqual([255, 239]);
  });

  it('devuelve un Uint8Array sobre un ArrayBuffer común', () => {
    expect(urlBase64ToUint8Array('AQID').buffer).toBeInstanceOf(ArrayBuffer);
  });
});

describe('subscriptionMatchesKey', () => {
  it('compara la key de la suscripción con la del server', () => {
    const same = urlBase64ToUint8Array('AQID').buffer;
    expect(subscriptionMatchesKey(same, 'AQID')).toBe(true);
    expect(subscriptionMatchesKey(urlBase64ToUint8Array('AQIE').buffer, 'AQID')).toBe(false);
    expect(subscriptionMatchesKey(urlBase64ToUint8Array('AQ').buffer, 'AQID')).toBe(false);
  });

  it('si el navegador no expone la key, asume que coincide', () => {
    expect(subscriptionMatchesKey(null, 'AQID')).toBe(true);
    expect(subscriptionMatchesKey(undefined, 'AQID')).toBe(true);
  });
});

describe('describeSubscribeError', () => {
  it('traduce los errores conocidos del navegador', () => {
    expect(describeSubscribeError(new DOMException('x', 'NotAllowedError'))).toMatch(/permiso/);
    expect(describeSubscribeError(new DOMException('x', 'AbortError'))).toMatch(/no respondió/);
  });

  it('tiene un mensaje genérico para el resto', () => {
    expect(describeSubscribeError('raro')).toBe('No pudimos activar las notificaciones.');
  });
});
