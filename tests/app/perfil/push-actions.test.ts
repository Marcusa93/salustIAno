import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase } from '../../stubs/supabase-fake';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }));
vi.mock('@/lib/web-push', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/web-push')>()),
  ensurePushConfigured: vi.fn(() => true),
  sendPush: vi.fn(),
}));

import { sendTestPushAction, subscribeUserToPushAction } from '@/app/(app)/perfil/push-actions';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { sendPush } from '@/lib/web-push';

const ENDPOINT = 'https://web.push.apple.com/QGx1Y2tpbmc';
const SUBSCRIPTION = {
  endpoint: ENDPOINT,
  keys: { p256dh: 'BOr2', auth: 'k8J' },
  userAgent: 'Mozilla/5.0 (iPhone)',
};

type Fake = ReturnType<typeof createFakeSupabase>;

function useClients(user: Fake, admin: Fake = createFakeSupabase()) {
  vi.mocked(createClient).mockResolvedValue(user as never);
  vi.mocked(createAdminClient).mockReturnValue(admin as never);
  return { user, admin };
}

const membership = { select: () => ({ data: { family_group_id: 'family-1' }, error: null }) };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('subscribeUserToPushAction', () => {
  it('rechaza input que no es una suscripción', async () => {
    const { user } = useClients(createFakeSupabase());
    const result = await subscribeUserToPushAction({ endpoint: 'http://x', keys: {} });
    expect(result).toEqual({ ok: false, error: 'Suscripción inválida.' });
    expect(user.calls).toHaveLength(0);
  });

  it('reemplaza en vez de hacer upsert: borra la fila propia e inserta', async () => {
    const { user } = useClients(createFakeSupabase({ family_memberships: membership }));

    expect(await subscribeUserToPushAction(SUBSCRIPTION)).toEqual({ ok: true });

    const [del] = user.callsTo('push_subscriptions', 'delete');
    expect(del?.query.filters).toContainEqual(['eq', 'endpoint', ENDPOINT]);
    const [insert] = user.callsTo('push_subscriptions', 'insert');
    expect(insert?.payload).toEqual({
      user_id: 'user-1',
      family_group_id: 'family-1',
      endpoint: ENDPOINT,
      keys: SUBSCRIPTION.keys,
      user_agent: SUBSCRIPTION.userAgent,
    });
    // El borrado tiene que ir antes que el insert.
    expect(user.calls.indexOf(del as never)).toBeLessThan(user.calls.indexOf(insert as never));
  });

  it('si el endpoint es de otra cuenta, lo libera con el admin y reintenta', async () => {
    const inserts = [{ error: { code: '23505' } }, { error: null }];
    const { user, admin } = useClients(
      createFakeSupabase({
        family_memberships: membership,
        push_subscriptions: { insert: () => inserts.shift() ?? { error: null } },
      }),
    );

    expect(await subscribeUserToPushAction(SUBSCRIPTION)).toEqual({ ok: true });
    expect(user.callsTo('push_subscriptions', 'insert')).toHaveLength(2);
    const [adminDelete] = admin.callsTo('push_subscriptions', 'delete');
    expect(adminDelete?.query.filters).toContainEqual(['eq', 'endpoint', ENDPOINT]);
  });

  it('sin sesión no toca la tabla', async () => {
    const { user } = useClients(createFakeSupabase({}, null));
    expect(await subscribeUserToPushAction(SUBSCRIPTION)).toEqual({
      ok: false,
      error: 'Sesión expirada.',
    });
    expect(user.callsTo('push_subscriptions')).toHaveLength(0);
  });
});

describe('sendTestPushAction', () => {
  const ownSubscription = {
    select: () => ({
      data: [{ id: 'sub-1', endpoint: ENDPOINT, keys: SUBSCRIPTION.keys }],
      error: null,
    }),
  };

  it('manda solo al dispositivo pedido, con urgencia alta', async () => {
    const { user } = useClients(createFakeSupabase({ push_subscriptions: ownSubscription }));
    vi.mocked(sendPush).mockResolvedValue({ ok: true });

    expect(await sendTestPushAction(ENDPOINT)).toEqual({ ok: true, sent: 1 });

    const [select] = user.callsTo('push_subscriptions', 'select');
    expect(select?.query.filters).toContainEqual(['eq', 'endpoint', ENDPOINT]);
    expect(sendPush).toHaveBeenCalledWith(
      { endpoint: ENDPOINT, keys: SUBSCRIPTION.keys },
      expect.objectContaining({ title: 'Salu', tag: 'salu-test' }),
      { ttlSeconds: 300, urgency: 'high' },
    );
  });

  it('si la suscripción ya no existe (410), la borra y pide reactivar', async () => {
    const { user } = useClients(createFakeSupabase({ push_subscriptions: ownSubscription }));
    vi.mocked(sendPush).mockResolvedValue({ ok: false, gone: true, status: 410, error: 'Gone' });

    const result = await sendTestPushAction(ENDPOINT);

    expect(result).toEqual({
      ok: false,
      error: expect.stringContaining('ya no está suscripto'),
      resubscribe: true,
    });
    const [del] = user.callsTo('push_subscriptions', 'delete');
    expect(del?.query.filters).toContainEqual(['eq', 'id', 'sub-1']);
  });

  it('si el dispositivo no está registrado, pide reactivar', async () => {
    useClients(createFakeSupabase({ push_subscriptions: { select: () => ({ data: [] }) } }));
    const result = await sendTestPushAction(ENDPOINT);
    expect(result).toMatchObject({ ok: false, resubscribe: true });
    expect(sendPush).not.toHaveBeenCalled();
  });

  it('rechaza endpoints inválidos sin consultar la base', async () => {
    const { user } = useClients(createFakeSupabase());
    expect(await sendTestPushAction('javascript:alert(1)')).toMatchObject({ ok: false });
    expect(user.calls).toHaveLength(0);
  });
});
