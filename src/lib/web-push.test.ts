import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase } from '../../tests/stubs/supabase-fake';

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'test-public-key';
  process.env.VAPID_PRIVATE_KEY = 'test-private-key';
});

vi.mock('web-push', () => ({
  default: { setVapidDetails: vi.fn(), sendNotification: vi.fn() },
}));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }));

import { createAdminClient } from '@/lib/supabase/admin';
import webpush from 'web-push';
import { describePushFailure, isGoneStatus, sendPush, sendPushToFamily } from './web-push';

const SUB = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
  keys: { p256dh: 'p', auth: 'a' },
};
const PAYLOAD = { title: 'Salu', body: 'Hola' };

function httpError(statusCode: number) {
  return Object.assign(new Error(`HTTP ${statusCode}`), { statusCode });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sendPush', () => {
  it('pasa TTL y urgencia al servicio de push', async () => {
    vi.mocked(webpush.sendNotification).mockResolvedValue({} as never);
    const result = await sendPush(SUB, PAYLOAD, { ttlSeconds: 300, urgency: 'high' });

    expect(result).toEqual({ ok: true });
    expect(webpush.sendNotification).toHaveBeenCalledWith(SUB, JSON.stringify(PAYLOAD), {
      TTL: 300,
      urgency: 'high',
    });
  });

  it('410 y 404 significan que la suscripción murió', async () => {
    vi.mocked(webpush.sendNotification).mockRejectedValue(httpError(410));
    expect(await sendPush(SUB, PAYLOAD)).toMatchObject({ ok: false, gone: true, status: 410 });

    vi.mocked(webpush.sendNotification).mockRejectedValue(httpError(404));
    expect(await sendPush(SUB, PAYLOAD)).toMatchObject({ ok: false, gone: true, status: 404 });
  });

  it('403 (claves VAPID distintas) no marca la suscripción como muerta', async () => {
    vi.mocked(webpush.sendNotification).mockRejectedValue(httpError(403));
    expect(await sendPush(SUB, PAYLOAD)).toMatchObject({ ok: false, gone: false, status: 403 });
  });

  it('un error sin status (red) queda con status null', async () => {
    vi.mocked(webpush.sendNotification).mockRejectedValue(new Error('ECONNRESET'));
    expect(await sendPush(SUB, PAYLOAD)).toMatchObject({ ok: false, gone: false, status: null });
  });
});

describe('describePushFailure', () => {
  it('explica cada caso en criollo', () => {
    expect(describePushFailure(410)).toMatch(/Volvé a activar/);
    expect(describePushFailure(403)).toMatch(/claves/);
    expect(describePushFailure(429)).toMatch(/demasiadas/);
    expect(describePushFailure(503)).toMatch(/no respondió/);
    expect(describePushFailure(null)).toBe('No pudimos entregar la notificación.');
  });

  it('isGoneStatus', () => {
    expect(isGoneStatus(410)).toBe(true);
    expect(isGoneStatus(404)).toBe(true);
    expect(isGoneStatus(403)).toBe(false);
    expect(isGoneStatus(null)).toBe(false);
  });
});

describe('sendPushToFamily', () => {
  it('manda a la familia sin el autor y marca inválidas las que murieron', async () => {
    const admin = createFakeSupabase({
      push_subscriptions: {
        select: () => ({
          data: [
            { id: 'ok', ...SUB },
            { id: 'gone', ...SUB, endpoint: 'https://fcm.googleapis.com/fcm/send/vieja' },
          ],
        }),
      },
    });
    vi.mocked(createAdminClient).mockReturnValue(admin as never);
    vi.mocked(webpush.sendNotification)
      .mockResolvedValueOnce({} as never)
      .mockRejectedValueOnce(httpError(410));

    expect(await sendPushToFamily('family-1', PAYLOAD, 'author')).toEqual({ sent: 1, failed: 1 });

    const [select] = admin.callsTo('push_subscriptions', 'select');
    expect(select?.query.filters).toContainEqual(['eq', 'family_group_id', 'family-1']);
    expect(select?.query.filters).toContainEqual(['neq', 'user_id', 'author']);
    const [update] = admin.callsTo('push_subscriptions', 'update');
    expect(update?.query.filters).toContainEqual(['eq', 'id', 'gone']);
    expect(update?.payload).toEqual({ invalidated_at: expect.any(String) });
  });
});
