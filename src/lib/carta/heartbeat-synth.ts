/**
 * Latido sintetizado con Web Audio, sin archivos: un golpe grave más el
 * "chas-chas" de una ecografía doppler (ruido filtrado en dos tiempos).
 */
export interface HeartbeatSynth {
  start(bpm: number): void;
  stop(fadeSeconds?: number): void;
}

export const SILENT_HEARTBEAT: HeartbeatSynth = {
  start() {},
  stop() {},
};

const LOOKAHEAD_SECONDS = 0.12;
const SCHEDULER_INTERVAL_MS = 25;

export function createHeartbeatSynth(
  ctx: AudioContext,
  destination: AudioNode,
  onBeat?: () => void,
): HeartbeatSynth {
  const out = ctx.createGain();
  out.gain.value = 0;
  out.connect(destination);

  const noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.4), ctx.sampleRate);
  const samples = noise.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;

  let interval = 60 / 140;
  let nextBeat = 0;
  let timer: number | null = null;
  let stopTimer: number | null = null;

  const envelope = (at: number, peak: number, seconds: number) => {
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
    gain.connect(out);
    return gain;
  };

  const whoosh = (at: number, peak: number, seconds: number) => {
    const source = ctx.createBufferSource();
    source.buffer = noise;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 1.1;
    band.frequency.setValueAtTime(420, at);
    band.frequency.exponentialRampToValueAtTime(820, at + seconds);
    source.connect(band).connect(envelope(at, peak, seconds));
    source.start(at);
    source.stop(at + seconds + 0.05);
  };

  const thump = (at: number, peak: number) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(92, at);
    osc.frequency.exponentialRampToValueAtTime(44, at + 0.14);
    osc.connect(envelope(at, peak, 0.18));
    osc.start(at);
    osc.stop(at + 0.22);
  };

  const scheduleBeat = (at: number) => {
    thump(at, 0.85);
    whoosh(at, 0.45, 0.15);
    whoosh(at + 0.15, 0.28, 0.12);
    if (onBeat) {
      const delayMs = Math.max(0, (at - ctx.currentTime) * 1000);
      window.setTimeout(onBeat, delayMs);
    }
  };

  const schedule = () => {
    while (nextBeat < ctx.currentTime + LOOKAHEAD_SECONDS) {
      scheduleBeat(nextBeat);
      nextBeat += interval;
    }
  };

  return {
    start(bpm) {
      interval = 60 / bpm;
      if (stopTimer !== null) {
        window.clearTimeout(stopTimer);
        stopTimer = null;
      }
      const now = ctx.currentTime;
      out.gain.cancelScheduledValues(now);
      out.gain.setTargetAtTime(1, now, 0.06);
      if (timer !== null) return;
      nextBeat = now + 0.05;
      schedule();
      timer = window.setInterval(schedule, SCHEDULER_INTERVAL_MS);
    },
    stop(fadeSeconds = 0.35) {
      const now = ctx.currentTime;
      out.gain.cancelScheduledValues(now);
      out.gain.setValueAtTime(out.gain.value, now);
      out.gain.linearRampToValueAtTime(0, now + fadeSeconds);
      if (stopTimer !== null) window.clearTimeout(stopTimer);
      stopTimer = window.setTimeout(() => {
        if (timer !== null) window.clearInterval(timer);
        timer = null;
        stopTimer = null;
      }, fadeSeconds * 1000);
    },
  };
}
