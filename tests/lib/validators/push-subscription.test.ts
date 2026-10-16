import { pushEndpointSchema, pushSubscriptionSchema } from '@/lib/validators/push-subscription';
import { describe, expect, it } from 'vitest';

const VALID = {
  endpoint: 'https://web.push.apple.com/QGx1Y2tpbmc',
  keys: { p256dh: 'BOr2', auth: 'k8J' },
  userAgent: 'Mozilla/5.0 (iPhone)',
};

describe('pushSubscriptionSchema', () => {
  it('acepta una suscripción serializada', () => {
    expect(pushSubscriptionSchema.safeParse(VALID).success).toBe(true);
  });

  it('el user agent es opcional', () => {
    const { userAgent: _ua, ...rest } = VALID;
    expect(pushSubscriptionSchema.safeParse(rest).success).toBe(true);
  });

  it('rechaza keys vacías', () => {
    expect(
      pushSubscriptionSchema.safeParse({ ...VALID, keys: { p256dh: '', auth: 'x' } }).success,
    ).toBe(false);
  });

  it('rechaza endpoints que no son https', () => {
    expect(pushEndpointSchema.safeParse('http://fcm.googleapis.com/x').success).toBe(false);
    expect(pushEndpointSchema.safeParse('javascript:alert(1)').success).toBe(false);
    expect(pushEndpointSchema.safeParse('no es url').success).toBe(false);
    expect(pushEndpointSchema.safeParse(42).success).toBe(false);
  });
});
