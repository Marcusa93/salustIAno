import { type HeartbeatSynth, SILENT_HEARTBEAT, createHeartbeatSynth } from './heartbeat-synth';

/**
 * Banda sonora de una carta: cada capítulo tiene su canción y al pasar de
 * uno a otro se funden (crossfade) entre dos <audio>. Encima de la música
 * pueden sonar el latido y efectos cortos (ej. la risa de Salu).
 *
 * El volumen se maneja con Web Audio (GainNode) porque iOS ignora
 * `audio.volume`. Dos restricciones de iOS mandan acá:
 *   - Un <audio> solo puede sonar más tarde si su primer play() ocurrió
 *     dentro de un gesto del usuario → `unlock()` se llama en el tap de
 *     "abrir la carta" y "ceba" los dos decks.
 *   - Web Audio respeta el switch de silencio salvo que la sesión de audio
 *     sea de tipo "playback" (Safari 17+).
 *
 * Ruteo: decks → music (se baja: "duck") → master (mute) → parlante.
 * El latido y los efectos van directo al master: cuando suenan, la música
 * baja pero ellos no.
 */

export interface SoundtrackSong {
  id: string;
  src: string;
}

export interface SoundtrackDeps {
  createAudio: () => HTMLAudioElement;
  createContext: () => AudioContext | null;
  fetchAudio: (url: string) => Promise<ArrayBuffer>;
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
  fetchAudio: async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`No se pudo bajar el sonido (${response.status}).`);
    return response.arrayBuffer();
  },
};

function preferPlaybackAudioSession() {
  const nav = navigator as Navigator & { audioSession?: { type: string } };
  if (nav.audioSession) nav.audioSession.type = 'playback';
}

export class Soundtrack {
  private readonly songs: Map<string, string>;
  private readonly effects: Map<string, string>;
  private readonly deps: SoundtrackDeps;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private decks: [Deck, Deck] | null = null;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private active: 0 | 1 = 0;
  private started = false;
  private muted = false;
  private ducked = false;
  private effectsPlaying = 0;
  private resumeOnVisible = false;
  private timers = new Set<number>();

  constructor(
    songs: readonly SoundtrackSong[],
    deps: Partial<SoundtrackDeps> = {},
    effects: readonly SoundtrackSong[] = [],
  ) {
    this.songs = new Map(songs.map((song) => [song.id, song.src]));
    this.effects = new Map(effects.map((effect) => [effect.id, effect.src]));
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
      this.music = ctx.createGain();
      this.music.connect(this.master);
    }

    const firstSrc = this.songs.values().next().value ?? null;
    const createDeck = (): Deck => {
      const el = this.deps.createAudio();
      el.crossOrigin = 'anonymous';
      el.preload = 'auto';
      el.loop = true;
      if (firstSrc) el.src = firstSrc;

      let gain: GainNode | null = null;
      if (ctx && this.music) {
        gain = ctx.createGain();
        gain.gain.value = 0;
        ctx.createMediaElementSource(el).connect(gain).connect(this.music);
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
    this.applyLevels(0);
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
    this.applyLevels();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyLevels();
  }

  /** Latido directo al master: respeta el mute pero no baja con la música. */
  heartbeat(onBeat?: () => void): HeartbeatSynth {
    if (!this.ctx || !this.master) return SILENT_HEARTBEAT;
    return createHeartbeatSynth(this.ctx, this.master, onBeat);
  }

  /** Baja y decodifica un efecto de antemano, para que suene sin demora. */
  preloadEffect(id: string): void {
    const src = this.effects.get(id);
    const ctx = this.ctx;
    if (!src || !ctx || this.buffers.has(id)) return;
    this.buffers.set(
      id,
      this.deps
        .fetchAudio(src)
        .then((data) => ctx.decodeAudioData(data))
        .catch(() => null),
    );
  }

  /**
   * Hace sonar un efecto (ej. la risa) por encima de la música, que baja
   * mientras dura. Funciona fuera de un gesto: el contexto ya está andando.
   */
  async playEffect(id: string): Promise<void> {
    this.preloadEffect(id);
    const buffer = await this.buffers.get(id);
    const ctx = this.ctx;
    if (!buffer || !ctx || !this.master) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.master);
    this.effectsPlaying += 1;
    this.applyLevels(0.25);
    source.onended = () => {
      this.effectsPlaying = Math.max(0, this.effectsPlaying - 1);
      this.applyLevels(0.8);
    };
    source.start();
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
    this.buffers.clear();
    this.effectsPlaying = 0;
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
    this.music = null;
  }

  private applyLevels(seconds = 0.6): void {
    const musicLevel = this.ducked || this.effectsPlaying > 0 ? DUCK_LEVEL : 1;
    if (this.ctx && this.master && this.music) {
      rampParam(this.ctx, this.master.gain, this.muted ? 0 : 1, seconds);
      rampParam(this.ctx, this.music.gain, musicLevel, seconds);
      return;
    }
    for (const deck of this.decks ?? []) deck.el.muted = this.muted;
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
