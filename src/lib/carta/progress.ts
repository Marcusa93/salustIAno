/**
 * Hasta dónde llegó la lectura de una carta, guardado en el dispositivo
 * (localStorage). Con un bebé en brazos es fácil tener que dejarla por la
 * mitad: la próxima vez se ofrece seguir desde ahí.
 */

/** Id de capítulo, o `FINALE` si ya llegó al cierre. */
export const FINALE = 'final';

export interface LetterProgress {
  chapter: string;
  at: string;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const key = (slug: string) => `salu:carta:${slug}:progreso`;

/** localStorage si se puede usar (modo privado o bloqueado: `null`). */
export function safeStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readProgress(storage: StorageLike | null, slug: string): LetterProgress | null {
  try {
    const raw = storage?.getItem(key(slug));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'chapter' in parsed &&
      typeof parsed.chapter === 'string' &&
      'at' in parsed &&
      typeof parsed.at === 'string'
    ) {
      return { chapter: parsed.chapter, at: parsed.at };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveProgress(
  storage: StorageLike | null,
  slug: string,
  chapter: string,
  now: Date = new Date(),
): void {
  try {
    storage?.setItem(key(slug), JSON.stringify({ chapter, at: now.toISOString() }));
  } catch {
    // Sin espacio o bloqueado: no pasa nada, solo no se ofrece seguir.
  }
}

export function clearProgress(storage: StorageLike | null, slug: string): void {
  try {
    storage?.removeItem(key(slug));
  } catch {
    // idem
  }
}

/**
 * Si vale la pena ofrecer "seguir donde estabas": solo si pasó del primer
 * capítulo (si no, es lo mismo que empezar) y ese capítulo todavía existe.
 */
export function resumableChapter(
  progress: LetterProgress | null,
  chapterIds: readonly string[],
): string | null {
  if (!progress) return null;
  if (progress.chapter === FINALE) return FINALE;
  const index = chapterIds.indexOf(progress.chapter);
  return index > 0 ? progress.chapter : null;
}
