import { describe, expect, it } from 'vitest';
import { scheduleHeartbeat } from './heartbeat-synth';

// Fake mínimo de Web Audio: registra cada oscilador y cuándo arranca.
function fakeContext() {
  const starts: { at: number; from: number }[] = [];
  const param = () => ({
    value: 0,
    setValueAtTime(this: { value: number }, value: number) {
      this.value = value;
    },
    exponentialRampToValueAtTime() {},
  });
  const node = () => ({ connect: <T>(next: T) => next });
  const ctx = {
    createOscillator: () => {
      const frequency = param();
      return {
        ...node(),
        type: 'sine',
        frequency,
        start: (at: number) => starts.push({ at, from: frequency.value }),
        stop() {},
      };
    },
    createGain: () => ({ ...node(), gain: param() }),
  };
  return { ctx: ctx as unknown as BaseAudioContext, starts };
}

describe('scheduleHeartbeat', () => {
  const input = {} as AudioNode;

  it('arma un pum-pum: dos golpes, el segundo más agudo', () => {
    const { ctx, starts } = fakeContext();
    scheduleHeartbeat(ctx, input, 1, 140);
    expect(starts).toHaveLength(2);
    const [s1, s2] = starts;
    expect(s1?.at).toBe(1);
    expect(s2?.from).toBeGreaterThan(s1?.from ?? 0);
  });

  it('a más pulsaciones, los dos golpes van más pegados', () => {
    const fast = fakeContext();
    const slow = fakeContext();
    scheduleHeartbeat(fast.ctx, input, 0, 140);
    scheduleHeartbeat(slow.ctx, input, 0, 90);
    const gap = (starts: { at: number }[]) => (starts[1]?.at ?? 0) - (starts[0]?.at ?? 0);
    expect(gap(fast.starts)).toBeCloseTo((60 / 140) * 0.32);
    expect(gap(fast.starts)).toBeLessThan(gap(slow.starts));
  });

  it('nunca separa los golpes más de 0,2 s, aunque el pulso sea lento', () => {
    const { ctx, starts } = fakeContext();
    scheduleHeartbeat(ctx, input, 0, 40);
    expect((starts[1]?.at ?? 0) - (starts[0]?.at ?? 0)).toBeCloseTo(0.2);
  });
});
