import { describe, expect, it } from 'vitest';
import { FINALE, clearProgress, readProgress, resumableChapter, saveProgress } from './progress';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
    removeItem: (k: string) => {
      data.delete(k);
    },
  };
}

describe('progreso de lectura', () => {
  it('guarda y lee el último capítulo por carta', () => {
    const storage = memoryStorage();
    saveProgress(storage, 'mama-2026', 'agosto', new Date('2026-10-18T10:00:00Z'));
    expect(readProgress(storage, 'mama-2026')).toEqual({
      chapter: 'agosto',
      at: '2026-10-18T10:00:00.000Z',
    });
    expect(readProgress(storage, 'papa-2027')).toBeNull();
  });

  it('olvida el progreso al empezar de nuevo', () => {
    const storage = memoryStorage();
    saveProgress(storage, 'mama-2026', 'agosto');
    clearProgress(storage, 'mama-2026');
    expect(readProgress(storage, 'mama-2026')).toBeNull();
  });

  it('no se rompe sin storage, con basura guardada o si el storage tira error', () => {
    expect(readProgress(null, 'mama-2026')).toBeNull();
    const storage = memoryStorage();
    storage.setItem('salu:carta:mama-2026:progreso', '{no es json');
    expect(readProgress(storage, 'mama-2026')).toBeNull();
    const broken = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('lleno');
      },
      removeItem: () => {
        throw new Error('bloqueado');
      },
    };
    expect(readProgress(broken, 'mama-2026')).toBeNull();
    expect(() => saveProgress(broken, 'mama-2026', 'agosto')).not.toThrow();
    expect(() => clearProgress(broken, 'mama-2026')).not.toThrow();
  });
});

describe('resumableChapter', () => {
  const chapters = ['espera', 'nacimiento', 'mayo', 'agosto'];
  const at = '2026-10-18T10:00:00Z';

  it('ofrece seguir desde un capítulo posterior al primero, o desde el final', () => {
    expect(resumableChapter({ chapter: 'agosto', at }, chapters)).toBe('agosto');
    expect(resumableChapter({ chapter: FINALE, at }, chapters)).toBe(FINALE);
  });

  it('no ofrece seguir si recién empezaba o si el capítulo ya no existe', () => {
    expect(resumableChapter({ chapter: 'espera', at }, chapters)).toBeNull();
    expect(resumableChapter({ chapter: 'borrado', at }, chapters)).toBeNull();
    expect(resumableChapter(null, chapters)).toBeNull();
  });
});
