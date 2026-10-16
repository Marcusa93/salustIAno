import { type HeartbeatSynth, SILENT_HEARTBEAT, createHeartbeatSynth } from './heartbeat-synth';

/**
 * Banda sonora de una carta: cada capítulo tiene su canción y al pasar de
 * uno a otro se funden (crossfade) entre dos <audio>.
 *
 * El volumen se maneja con Web Audio (GainNode) porque iOS ignora
 * `audio.volume`. Dos restricciones de iOS mandan acá:
 *   - Un <audio> solo puede sonar más tarde si su primer play() ocurrió
 *     dentro de un gesto del usuario → `unlock()` se llama en el tap de
 *     "abrir la carta" y "ceba" los dos decks.
 *   - Web Audio respeta el switch de silencio salvo que la sesión de audio
 *     sea de tipo "playback" (Safari 17+).
 */

export interface SoundtrackSong {
  id: string;
  src: string;
}

export interface SoundtrackDeps {
  createAudio: () => HTMLAudioElement;
  createContext: () => AudioContext | null;
}

interface Deck {
  el: HTMLAudioElement;
  gain: GainNode | null;
  songId: string | null;
  loadedSrc: string | null;
}

export const CROSSFADE_SECONDS = 2.5;
export const DUCK_LEVEL = 0.12;

const noop = () => {};

const defaultDeps: SoundtrackDeps = {
  createAudio: () => new Audio(),
  createContext: () => {
    const Ctor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    return Ctor ? new Ctor() : null;
  },
};

function preferPlaybackAudioSession() {
  const nav = navigator as Navigator & { audioSession?: { type: string } };
  if (nav.audioSession) nav.audioSession.type = 'playback';
}

export class Soundtrack {
  private readonly songs: Map<string, string>;
  private readonly deps: SoundtrackDeps;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private decks: [Deck, Deck] | null = null;
  private active: 0 | 1 = 0;
  private started = false;
  private muted = false;
  private ducked = false;
  private resumeOnVisible = false;
  private timers = new Set<number>();

  constructor(songs: readonly SoundtrackSong[], deps: Partial<SoundtrackDeps> = {}) {
    this.songs = new Map(songs.map((song) => [song.id, song.src]));
    this.deps = { ...defaultDeps, ...deps };
  }

  get unlocked(): boolean {
    return this.decks !== null;
  }

  /** Llamar SIEMPRE dentro de un gesto (click/tap). Idempotente. */
  unlock(): void {
    if (this.decks) {
      void this.ctx?.resume();
      return;
    }
    preferPlaybackAudioSession();

    const ctx = this.deps.createContext();
    if (ctx) {
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.connect(ctx.destination);
    }

    const firstSrc = this.songs.values().next().value ?? null;
    const createDeck = (): Deck => {
      const el = this.deps.createAudio();
      el.crossOrigin = 'anonymous';
      el.preload = 'auto';
      el.loop = true;
      if (firstSrc) el.src = firstSrc;

      let gain: GainNode | null = null;
      if (ctx && this.master) {
        gain = ctx.createGain();
        gain.gain.value = 0;
        ctx.createMediaElementSource(el).connect(gain).connect(this.master);
      } else {
        el.volume = 0;
      }

      return { el, gain, songId: null, loadedSrc: firstSrc };
    };
    const decks: [Deck, Deck] = [createDeck(), createDeck()];
    this.decks = decks;
    for (const deck of decks) {
      deck.el
        .play()
        .then(() => {
          if (!(this.started && this.decks?.[this.active] === deck)) deck.el.pause();
        })
        .catch(noop);
    }
    void this.ctx?.resume();
    this.applyMaster(0);
  }

  /** Fundido hacia la canción del capítulo. No hace nada antes de `unlock()`. */
  play(songId: string): void {
    const src = this.songs.get(songId);
    const decks = this.decks;
    if (!src || !decks) return;

    const current = decks[this.active];
    if (this.started && current.songId === songId) {
      if (current.el.paused && !this.resumeOnVisible) current.el.play().catch(noop);
      return;
    }

    const targetIndex = this.started ? (this.active === 0 ? 1 : 0) : 0;
    const target = decks[targetIndex];
    const previous = this.started ? current : null;

    if (target.loadedSrc !== src) {
      target.el.src = src;
      target.loadedSrc = src;
    } else {
      target.el.currentTime = 0;
    }
    target.songId = songId;
    this.active = targetIndex;
    this.started = true;

    this.rampDeck(target, 0, 0);
    target.el.play().catch(noop);
    this.rampDeck(target, 1, CROSSFADE_SECONDS);

    if (previous) {
      this.rampDeck(previous, 0, CROSSFADE_SECONDS);
      this.later(CROSSFADE_SECONDS * 1000 + 100, () => {
        if (this.decks?.[this.active] !== previous) previous.el.pause();
      });
    }
  }

  /** Baja la música (sin cortarla) mientras suena otra cosa, como un video. */
  setDucked(ducked: boolean): void {
    this.ducked = ducked;
    this.applyMaster();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyMaster();
  }

  /** Latido que pasa por el mismo master: respeta el mute. */
  heartbeat(onBeat?: () => void): HeartbeatSynth {
    if (!this.ctx || !this.master) return SILENT_HEARTBEAT;
    return createHeartbeatSynth(this.ctx, this.master, onBeat);
  }

  /** Pausa todo si la app pasa a segundo plano y lo retoma al volver. */
  setHidden(hidden: boolean): void {
    if (!this.decks) return;
    const current = this.decks[this.active];
    if (hidden) {
      this.resumeOnVisible = this.started && !current.el.paused;
      for (const deck of this.decks) deck.el.pause();
      return;
    }
    void this.ctx?.resume();
    if (this.resumeOnVisible) current.el.play().catch(noop);
    this.resumeOnVisible = false;
  }

  dispose(): void {
    for (const timer of this.timers) window.clearTimeout(timer);
    this.timers.clear();
    for (const deck of this.decks ?? []) {
      deck.el.pause();
      deck.el.removeAttribute('src');
    }
    this.decks = null;
    this.started = false;
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
  }

  private applyMaster(seconds = 0.6): void {
    const level = this.muted ? 0 : this.ducked ? DUCK_LEVEL : 1;
    if (this.ctx && this.master) {
      rampParam(this.ctx, this.master.gain, level, seconds);
      return;
    }
    for (const deck of this.decks ?? []) deck.el.muted = level === 0;
  }

  private rampDeck(deck: Deck, level: number, seconds: number): void {
    if (this.ctx && deck.gain) {
      rampParam(this.ctx, deck.gain.gain, level, seconds);
      return;
    }
    // Sin Web Audio (navegadores viejos): saltamos de una al volumen final.
    deck.el.volume = level;
  }

  private later(ms: number, fn: () => void): void {
    const id = window.setTimeout(() => {
      this.timers.delete(id);
      fn();
    }, ms);
    this.timers.add(id);
  }
}

function rampParam(ctx: AudioContext, param: AudioParam, level: number, seconds: number) {
  const now = ctx.currentTime;
  param.cancelScheduledValues(now);
  if (seconds <= 0) {
    param.setValueAtTime(level, now);
    return;
  }
  param.setValueAtTime(param.value, now);
  param.linearRampToValueAtTime(level, now + seconds);
}
