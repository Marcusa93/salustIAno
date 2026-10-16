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

class FakeContext {
  currentTime = 0;
  destination = new FakeNode();
  createGain() {
    return new FakeNode();
  }
  createMediaElementSource() {
    return new FakeNode();
  }
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

function setup() {
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
    },
  );
  // nth(gains, 0) es el master; nth(gains, 1) y nth(gains, 2), los dos decks.
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
    expect(nth(gains, 1).gain.target).toBe(0);
    expect(nth(gains, 2).gain.target).toBe(0);
    expect(nth(gains, 0).gain.target).toBe(1);
  });

  it('la primera canción sube en el primer deck', () => {
    const { soundtrack, audios, gains } = setup();
    soundtrack.unlock();
    soundtrack.play('piano');
    expect(nth(audios, 0).src).toBe('/audio/piano.mp3');
    expect(nth(gains, 1).gain.target).toBe(1);
  });

  it('cambiar de canción funde entre decks y pausa el viejo al terminar el fundido', () => {
    const { soundtrack, audios, gains } = setup();
    soundtrack.unlock();
    soundtrack.play('piano');
    soundtrack.play('nuestra');

    expect(nth(audios, 1).src).toBe('https://storage.test/nuestra.mp3');
    expect(nth(gains, 2).gain.target).toBe(1);
    expect(nth(gains, 1).gain.target).toBe(0);

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
    expect(nth(gains, 2).gain.target).toBe(0);
  });

  it('ignora canciones que no existen', () => {
    const { soundtrack, gains } = setup();
    soundtrack.unlock();
    soundtrack.play('no-existe');
    expect(nth(gains, 1).gain.target).toBe(0);
    expect(nth(gains, 2).gain.target).toBe(0);
  });

  it('baja la música para el video y la silencia con mute', () => {
    const { soundtrack, gains } = setup();
    soundtrack.unlock();
    soundtrack.setDucked(true);
    expect(nth(gains, 0).gain.target).toBe(DUCK_LEVEL);
    soundtrack.setMuted(true);
    expect(nth(gains, 0).gain.target).toBe(0);
    soundtrack.setMuted(false);
    soundtrack.setDucked(false);
    expect(nth(gains, 0).gain.target).toBe(1);
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
