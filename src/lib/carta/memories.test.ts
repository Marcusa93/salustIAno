import { describe, expect, it } from 'vitest';
import {
  LETTER_PHOTO_MAX_BYTES,
  letterMemoryTag,
  letterPhotoProblem,
  memoriesFromItems,
} from './memories';

describe('letterMemoryTag', () => {
  it('ata la foto a la carta por su slug', () => {
    expect(letterMemoryTag('mama-2026')).toBe('carta:mama-2026');
  });
});

describe('letterPhotoProblem', () => {
  it('acepta fotos comunes de celular', () => {
    expect(letterPhotoProblem({ size: 900_000, type: 'image/jpeg' })).toBeNull();
    expect(letterPhotoProblem({ size: 2_000_000, type: 'image/heic' })).toBeNull();
  });

  it('rechaza vacías, pesadas o que no son fotos', () => {
    expect(letterPhotoProblem({ size: 0, type: 'image/jpeg' })).toMatch(/vacía/);
    expect(letterPhotoProblem({ size: LETTER_PHOTO_MAX_BYTES + 1, type: 'image/jpeg' })).toMatch(
      /pesada/,
    );
    expect(letterPhotoProblem({ size: 1000, type: 'video/mp4' })).toMatch(/no es una foto/);
  });
});

describe('memoriesFromItems', () => {
  const item = (path: string, takenAt: string | null, caption: string | null = null) => ({
    storage_path: path,
    caption,
    taken_at: takenAt,
    created_at: '2026-10-18T10:00:00Z',
    width: null,
    height: null,
  });

  it('arma polaroids en orden cronológico, con epígrafe si lo tiene', () => {
    const photos = memoriesFromItems(
      [item('b.jpg', '2026-10-18T15:00:00Z', 'Mamá y yo'), item('a.jpg', '2026-10-18T12:00:00Z')],
      (path) => `https://firmada/${path}`,
      'Mamá y Salu',
    );
    expect(photos.map((p) => p.src)).toEqual(['https://firmada/a.jpg', 'https://firmada/b.jpg']);
    expect(photos[1]).toMatchObject({ caption: 'Mamá y yo', alt: 'Mamá y Salu', width: 1200 });
    expect(photos[0]).not.toHaveProperty('caption');
  });

  it('si no hay fecha de toma usa la de creación, y omite las que no se pudieron firmar', () => {
    const photos = memoriesFromItems(
      [item('a.jpg', null), item('perdida.jpg', '2026-10-18T12:00:00Z')],
      (path) => (path === 'a.jpg' ? 'https://firmada/a.jpg' : undefined),
      'Mamá y Salu',
    );
    expect(photos).toHaveLength(1);
    expect(photos[0]?.takenAt).toBe('2026-10-18T10:00:00Z');
  });
});
