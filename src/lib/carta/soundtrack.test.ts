import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CROSSFADE_SECONDS, DUCK_LEVEL, Soundtrack } from './soundtrack';

// Fakes mínimos de Web Audio: cada AudioParam recuerda a qué valor va.
class FakeParam {
  target = 1;
  private current = 1;
  get value() {
    return this.current;
  }
  set value(value: number) {
    this.current = value;
    this.target = value;
  }
  cancelScheduledValues() {}
  setValueAtTime(value: number) {
    this.value = value;
    this.target = value;
  }
  linearRampToValueAtTime(value: number) {
    this.target = value;
  }
}

class FakeNode {
  gain = new FakeParam();
  connect<T>(node: T): T {
    return node;
  }
}

class FakeBufferSource {
  buffer: unknown = null;
  connectedTo: unknown = null;
  onended: (() => void) | null = null;
  start = vi.fn();
  connect<T>(node: T): T {
    this.connectedTo = node;
    return node;
  }
}

class FakeContext {
  currentTime = 0;
  destination = new FakeNode();
  sources: FakeBufferSource[] = [];
  createGain() {
    return new FakeNode();
  }
  createMediaElementSource() {
    return new FakeNode();
  }
  createBufferSource() {
    const source = new FakeBufferSource();
    this.sources.push(source);
    return source;
  }
  decodeAudioData = vi.fn(async () => ({ duration: 2.4 }));
  resume = vi.fn(async () => {});
  close = vi.fn(async () => {});
}

class FakeAudio {
  src = '';
  crossOrigin: string | null = null;
  preload = '';
  loop = false;
  muted = false;
  volume = 1;
  currentTime = 0;
  paused = true;
  play = vi.fn(() => {
    this.paused = false;
    return Promise.resolve();
  });
  pause = vi.fn(() => {
    this.paused = true;
  });
  removeAttribute() {}
}

function nth<T>(items: T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`No hay elemento ${index}.`);
  return item;
}

function setup(effects: { id: string; src: string }[] = []) {
  const audios: FakeAudio[] = [];
  const contexts: FakeContext[] = [];
  const gains: FakeNode[] = [];
  const soundtrack = new Soundtrack(
    [
      { id: 'piano', src: '/audio/piano.mp3' },
      { id: 'nuestra', src: 'https://storage.test/nuestra.mp3' },
    ],
    {
      createAudio: () => {
        const audio = new FakeAudio();
        audios.push(audio);
        return audio as unknown as HTMLAudioElement;
      },
      createContext: () => {
        const ctx = new FakeContext();
        const createGain = ctx.createGain.bind(ctx);
        ctx.createGain = () => {
          const node = createGain();
          gains.push(node);
          return node;
        };
        contexts.push(ctx);
        return ctx as unknown as AudioContext;
      },
      fetchAudio: vi.fn(async () => new ArrayBuffer(8)),
    },
    effects,
  );
  // nth(gains, 0): master (mute). nth(gains, 1): música (se baja). 2 y 3: los decks.
  return { soundtrack, audios, contexts, gains };
}

describe('Soundtrack', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('no hace nada hasta que se desbloquea con un gesto', () => {
    const { soundtrack, audios } = setup();
    soundtrack.play('piano');
    expect(audios).toHaveLength(0);
    expect(soundtrack.unlocked).toBe(false);
  });

  it('al desbloquear arma dos decks en silencio y los ceba con play()', () => {
    const { soundtrack, audios, gains } = setup();
    soundtrack.unlock();
    expect(audios).toHaveLength(2);
    for (const audio of audios) {
      expect(audio.play).toHaveBeenCalledTimes(1);
      expect(audio.crossOrigin).toBe('anonymous');
      expect(audio.loop).toBe(true);
    }
    expect(nth(gains, 2).gain.target).toBe(0);
    expect(nth(gains, 3).gain.target).toBe(0);
    expect(nth(gains, 0).gain.target).toBe(1);
  });

  it('la primera canción sube en el primer deck', () => {
    const { soundtrack, audios, gains } = setup();
    soundtrack.unlock();
    soundtrack.play('piano');
    expect(nth(audios, 0).src).toBe('/audio/piano.mp3');
    expect(nth(gains, 2).gain.target).toBe(1);
  });

  it('cambiar de canción funde entre decks y pausa el viejo al terminar el fundido', () => {
    const { soundtrack, audios, gains } = setup();
    soundtrack.unlock();
    soundtrack.play('piano');
    soundtrack.play('nuestra');

    expect(nth(audios, 1).src).toBe('https://storage.test/nuestra.mp3');
    expect(nth(gains, 3).gain.target).toBe(1);
    expect(nth(gains, 2).gain.target).toBe(0);

    nth(audios, 0).pause.mockClear();
    vi.advanceTimersByTime(CROSSFADE_SECONDS * 1000 + 150);
    expect(nth(audios, 0).pause).toHaveBeenCalled();
    expect(nth(audios, 1).paused).toBe(false);
  });

  it('pedir la canción que ya suena no reinicia nada', () => {
    const { soundtrack, audios, gains } = setup();
    soundtrack.unlock();
    soundtrack.play('piano');
    nth(audios, 1).src = 'sin-tocar';
    soundtrack.play('piano');
    expect(nth(audios, 1).src).toBe('sin-tocar');
    expect(nth(gains, 3).gain.target).toBe(0);
  });

  it('ignora canciones que no existen', () => {
    const { soundtrack, gains } = setup();
    soundtrack.unlock();
    soundtrack.play('no-existe');
    expect(nth(gains, 2).gain.target).toBe(0);
    expect(nth(gains, 3).gain.target).toBe(0);
  });

  it('baja solo la música (no el master, por donde pasa el latido) y silencia todo con mute', () => {
    const { soundtrack, gains } = setup();
    soundtrack.unlock();
    soundtrack.setDucked(true);
    expect(nth(gains, 1).gain.target).toBe(DUCK_LEVEL);
    expect(nth(gains, 0).gain.target).toBe(1);
    soundtrack.setMuted(true);
    expect(nth(gains, 0).gain.target).toBe(0);
    soundtrack.setMuted(false);
    soundtrack.setDucked(false);
    expect(nth(gains, 0).gain.target).toBe(1);
    expect(nth(gains, 1).gain.target).toBe(1);
  });

  it('un efecto suena por el master y baja la música mientras dura', async () => {
    const { soundtrack, gains, contexts } = setup([
      { id: 'risa', src: 'https://storage.test/risa.mp3' },
    ]);
    soundtrack.unlock();
    await soundtrack.playEffect('risa');

    const ctx = nth(contexts, 0);
    const source = nth(ctx.sources, 0);
    expect(source.start).toHaveBeenCalled();
    expect(source.connectedTo).toBe(nth(gains, 0));
    expect(nth(gains, 1).gain.target).toBe(DUCK_LEVEL);

    source.onended?.();
    expect(nth(gains, 1).gain.target).toBe(1);
  });

  it('decodifica cada efecto una sola vez', async () => {
    const { soundtrack, contexts } = setup([{ id: 'risa', src: 'https://storage.test/risa.mp3' }]);
    soundtrack.unlock();
    await soundtrack.playEffect('risa');
    await soundtrack.playEffect('risa');
    expect(nth(contexts, 0).decodeAudioData).toHaveBeenCalledTimes(1);
    expect(nth(contexts, 0).sources).toHaveLength(2);
  });

  it('ignora efectos desconocidos o antes de desbloquear', async () => {
    const { soundtrack, contexts } = setup([{ id: 'risa', src: 'https://storage.test/risa.mp3' }]);
    await soundtrack.playEffect('risa');
    expect(contexts).toHaveLength(0);
    soundtrack.unlock();
    await soundtrack.playEffect('no-existe');
    expect(nth(contexts, 0).sources).toHaveLength(0);
  });

  it('pausa en segundo plano y retoma al volver', () => {
    const { soundtrack, audios } = setup();
    soundtrack.unlock();
    soundtrack.play('piano');
    soundtrack.setHidden(true);
    expect(nth(audios, 0).paused).toBe(true);
    soundtrack.setHidden(false);
    expect(nth(audios, 0).paused).toBe(false);
  });
});
