import type { LetterPhoto } from '@/lib/carta/manifest';

/**
 * "Memorias" de una carta: las fotos que se sacan desde su final. Viven en
 * el álbum de la familia (bucket `photos` + `media_items`) con un tag que
 * las ata a la carta, así aparecen en los dos lados.
 */

export const LETTER_PHOTO_MAX_BYTES = 12 * 1024 * 1024;
const LETTER_PHOTO_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);

export function letterMemoryTag(slug: string): string {
  return `carta:${slug}`;
}

/** Por qué no se puede guardar un archivo como foto de la carta, o `null` si se puede. */
export function letterPhotoProblem(file: { size: number; type: string }): string | null {
  if (file.size === 0) return 'La foto llegó vacía. Probá de nuevo.';
  if (file.size > LETTER_PHOTO_MAX_BYTES) return 'La foto es demasiado pesada.';
  if (!LETTER_PHOTO_MIME.has(file.type)) return 'Ese archivo no es una foto.';
  return null;
}

export interface MemoryItem {
  storage_path: string;
  caption: string | null;
  taken_at: string | null;
  created_at: string;
  width: number | null;
  height: number | null;
}

/** Filas de `media_items` → polaroids de la carta. Sin URL firmada, se omite. */
export function memoriesFromItems(
  items: MemoryItem[],
  urlFor: (path: string) => string | undefined,
  alt: string,
): LetterPhoto[] {
  return items
    .map((item): LetterPhoto | null => {
      const src = urlFor(item.storage_path);
      if (!src) return null;
      return {
        kind: 'photo',
        src,
        width: item.width ?? 1200,
        height: item.height ?? 1600,
        takenAt: item.taken_at ?? item.created_at,
        alt,
        ...(item.caption ? { caption: item.caption } : {}),
      };
    })
    .filter((photo): photo is LetterPhoto => photo !== null)
    .sort((a, b) => Date.parse(a.takenAt) - Date.parse(b.takenAt));
}
