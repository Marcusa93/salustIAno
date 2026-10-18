/**
 * Latido sintetizado con Web Audio, sin archivos: el "pum-pum" de los dos
 * ruidos del corazón (S1 fuerte, S2 más corto y agudo).
 *
 * Los parlantes de un celular casi no reproducen por debajo de ~150 Hz,
 * así que un seno grave puro se escucha "flojo" o directamente no se
 * escucha. Por eso cada golpe pasa por una saturación suave que le suma
 * armónicos (el oído reconstruye el grave a partir de ellos) y por un
 * compresor que lo empareja y le da presencia.
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

interface Thump {
  from: number;
  to: number;
  peak: number;
  seconds: number;
}

// S1 ("pum"): más grave, fuerte y largo. S2: más agudo, suave y corto.
const S1: Thump = { from: 120, to: 52, peak: 1, seconds: 0.17 };
const S2: Thump = { from: 140, to: 66, peak: 0.32, seconds: 0.12 };

function saturationCurve(drive: number): Float32Array<ArrayBuffer> {
  const size = 1024;
  const curve = new Float32Array(size);
  const norm = Math.tanh(drive);
  for (let i = 0; i < size; i++) {
    const x = (i / (size - 1)) * 2 - 1;
    curve[i] = Math.tanh(drive * x) / norm;
  }
  return curve;
}

/**
 * Cadena de salida del latido: saturación → filtro → compresor. Devuelve
 * el nodo de entrada donde se conectan los golpes.
 */
export function createHeartbeatChain(ctx: BaseAudioContext, destination: AudioNode): AudioNode {
  const drive = ctx.createWaveShaper();
  drive.curve = saturationCurve(3.5);
  drive.oversample = '4x';

  // Redondea la saturación: cuerpo sin zumbido.
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 1300;
  tone.Q.value = 0.6;

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -26;
  compressor.knee.value = 6;
  compressor.ratio.value = 8;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.15;

  const makeup = ctx.createGain();
  makeup.gain.value = 1.6;

  drive.connect(tone).connect(compressor).connect(makeup).connect(destination);
  return drive;
}

function thump(ctx: BaseAudioContext, input: AudioNode, at: number, shape: Thump) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(shape.from, at);
  osc.frequency.exponentialRampToValueAtTime(shape.to, at + shape.seconds);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(shape.peak, at + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + shape.seconds);

  osc.connect(gain).connect(input);
  osc.start(at);
  osc.stop(at + shape.seconds + 0.02);
}

/** Un latido completo (pum-pum) que arranca en `at`. */
export function scheduleHeartbeat(
  ctx: BaseAudioContext,
  input: AudioNode,
  at: number,
  bpm: number,
): void {
  // A más pulsaciones, más pegados los dos golpes (como en un corazón real).
  const gap = Math.min(0.2, (60 / bpm) * 0.32);
  thump(ctx, input, at, S1);
  thump(ctx, input, at + gap, S2);
}

export function createHeartbeatSynth(
  ctx: AudioContext,
  destination: AudioNode,
  onBeat?: () => void,
): HeartbeatSynth {
  const out = ctx.createGain();
  out.gain.value = 0;
  out.connect(destination);
  const input = createHeartbeatChain(ctx, out);

  let bpm = 140;
  let nextBeat = 0;
  let timer: number | null = null;
  let stopTimer: number | null = null;

  const schedule = () => {
    while (nextBeat < ctx.currentTime + LOOKAHEAD_SECONDS) {
      scheduleHeartbeat(ctx, input, nextBeat, bpm);
      if (onBeat) {
        const delayMs = Math.max(0, (nextBeat - ctx.currentTime) * 1000);
        window.setTimeout(onBeat, delayMs);
      }
      nextBeat += 60 / bpm;
    }
  };

  return {
    start(beatsPerMinute) {
      bpm = beatsPerMinute;
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
