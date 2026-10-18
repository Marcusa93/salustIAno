import { z } from 'zod';

/**
 * Contenido de una carta interactiva (textos, fotos, video, canciones).
 *
 * El contenido NO vive en el repo — el repo es público y esto es íntimo.
 * Vive en el bucket privado `cartas` de Supabase Storage como
 * `<slug>/manifest.json`, junto a los archivos que referencia. Ver
 * decisions/0014-cartas-contenido-privado.md.
 */

export const LETTER_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Paths relativos a la carpeta de la carta en el bucket: `fotos/01.jpg`.
// Nada de `..` ni paths absolutos: el loader los concatena al slug.
const mediaPathSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9/_.-]*$/i, 'Path de archivo inválido.')
  .refine((path) => !path.includes('..'), 'Path de archivo inválido.');

const isoDateTimeSchema = z.iso.datetime({ offset: true });

const photoSchema = z.object({
  kind: z.literal('photo'),
  path: mediaPathSchema,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  takenAt: isoDateTimeSchema,
  caption: z.string().min(1).optional(),
  alt: z.string().min(1),
  featured: z.boolean().optional(),
  // `contain` para fotos que no se pueden recortar (ej. una captura de pantalla).
  fit: z.enum(['cover', 'contain']).optional(),
  // Id de `sounds`: al tocar la foto suena (ej. la risa de Salu).
  sound: z.string().min(1).optional(),
});

const videoSchema = photoSchema.extend({
  kind: z.literal('video'),
  poster: mediaPathSchema.optional(),
});

const mediaSchema = z.discriminatedUnion('kind', [photoSchema, videoSchema]);

const songSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  artist: z.string().min(1).optional(),
  // `/audio/...` para un archivo público de la app; si no, path dentro del bucket.
  src: z.string().min(1),
});

const chapterSchema = z.object({
  id: z.string().regex(LETTER_SLUG_PATTERN),
  label: z.string().min(1),
  title: z.string().min(1),
  song: z.string().min(1).optional(),
  text: z.array(z.string().min(1)).min(1),
  media: z.array(mediaSchema),
  aunque: z
    .object({
      intro: z.string().min(1).optional(),
      cards: z.array(z.object({ text: z.string().min(1), media: photoSchema })).min(1),
      reveal: z.string().min(1),
    })
    .optional(),
});

export const letterManifestSchema = z
  .object({
    version: z.literal(1),
    slug: z.string().regex(LETTER_SLUG_PATTERN),
    childId: z.uuid(),
    birthAt: isoDateTimeSchema,
    envelope: z.object({
      to: z.string().min(1),
      from: z.string().min(1),
      stamp: z.string().min(1),
      hint: z.string().min(1),
    }),
    heartbeat: z.object({
      prompt: z.string().min(1),
      instruction: z.string().min(1),
      after: z.string().min(1),
    }),
    // Encabezado de carta: "Tucumán, 18 de octubre de 2026".
    dateline: z.string().min(1).optional(),
    intro: z.array(z.string().min(1)).min(1),
    songs: z.array(songSchema).min(1),
    // Efectos cortos que suenan al tocar algo (no son canciones de fondo).
    sounds: z.array(songSchema).optional(),
    chapters: z.array(chapterSchema).min(1),
    finale: z.object({
      song: z.string().min(1).optional(),
      lines: z.array(z.string().min(1)).min(1),
      touchPrompt: z.string().min(1),
      closing: z.array(z.string().min(1)).min(1),
      signature: z.string().min(1),
      wish: z.string().min(1),
      // Unas líneas de quien armó la carta, después de la firma de Salu.
      postscript: z
        .object({
          label: z.string().min(1),
          lines: z.array(z.string().min(1)).min(1),
          signature: z.string().min(1),
        })
        .optional(),
      // Una última foto para tocar (con su sonido), después de la firma.
      moment: z
        .object({
          photo: photoSchema,
          hint: z.string().min(1),
          after: z.string().min(1).optional(),
        })
        .optional(),
      // Cierre con cámara: "faltaba una foto, la de hoy". Se guarda en el álbum.
      photo: z
        .object({
          prompt: z.string().min(1),
          button: z.string().min(1),
          caption: z.string().min(1).max(200),
          saved: z.string().min(1),
        })
        .optional(),
    }),
  })
  .superRefine((manifest, ctx) => {
    const songIds = new Set(manifest.songs.map((song) => song.id));
    const referenced = [
      ...manifest.chapters.map((chapter) => chapter.song),
      manifest.finale.song,
    ].filter((id): id is string => id !== undefined);
    for (const id of referenced) {
      if (!songIds.has(id)) {
        ctx.addIssue({ code: 'custom', message: `La canción "${id}" no está en songs.` });
      }
    }

    const soundIds = new Set((manifest.sounds ?? []).map((sound) => sound.id));
    const photos = [
      ...manifest.chapters.flatMap((chapter) => [
        ...chapter.media,
        ...(chapter.aunque?.cards ?? []).map((card) => card.media),
      ]),
      ...(manifest.finale.moment ? [manifest.finale.moment.photo] : []),
    ];
    for (const media of photos) {
      if (media.sound && !soundIds.has(media.sound)) {
        ctx.addIssue({ code: 'custom', message: `El sonido "${media.sound}" no está en sounds.` });
      }
    }
  });

export type LetterManifest = z.infer<typeof letterManifestSchema>;
type ManifestPhoto = z.infer<typeof photoSchema>;
type ManifestVideo = z.infer<typeof videoSchema>;
type ManifestChapter = z.infer<typeof chapterSchema>;
type ManifestFinale = LetterManifest['finale'];

export type LetterPhoto = Omit<ManifestPhoto, 'path'> & { src: string };
export type LetterVideo = Omit<ManifestVideo, 'path' | 'poster'> & {
  src: string;
  posterSrc?: string;
};
export type LetterMedia = LetterPhoto | LetterVideo;

export interface LetterSong {
  id: string;
  title: string;
  artist?: string;
  src: string;
}

export interface LetterChapter extends Omit<ManifestChapter, 'media' | 'aunque'> {
  media: LetterMedia[];
  aunque?: {
    intro?: string;
    cards: { text: string; media: LetterPhoto }[];
    reveal: string;
  };
}

export interface LetterFinale extends Omit<ManifestFinale, 'moment'> {
  moment?: { photo: LetterPhoto; hint: string; after?: string };
}

/** La carta lista para el cliente: cada archivo con su URL firmada. */
export interface Letter extends Omit<LetterManifest, 'songs' | 'sounds' | 'chapters' | 'finale'> {
  songs: LetterSong[];
  sounds: LetterSong[];
  chapters: LetterChapter[];
  finale: LetterFinale;
  /** Fotos que se sacaron desde el final de la carta (viven en el álbum). */
  memories: LetterPhoto[];
}

/** Todos los paths del bucket que la carta necesita firmar. */
export function collectStoragePaths(manifest: LetterManifest): string[] {
  const paths = new Set<string>();
  for (const chapter of manifest.chapters) {
    for (const media of chapter.media) {
      paths.add(media.path);
      if (media.kind === 'video' && media.poster) paths.add(media.poster);
    }
    for (const card of chapter.aunque?.cards ?? []) paths.add(card.media.path);
  }
  for (const song of [...manifest.songs, ...(manifest.sounds ?? [])]) {
    if (!isPublicAsset(song.src)) paths.add(song.src);
  }
  if (manifest.finale.moment) paths.add(manifest.finale.moment.photo.path);
  return [...paths];
}

/**
 * Reemplaza cada path por su URL. Lo que no tiene URL (no se pudo firmar,
 * el archivo no se subió) se descarta en silencio: mejor una carta con una
 * foto menos que una carta rota.
 */
export function hydrateLetter(
  manifest: LetterManifest,
  urlFor: (path: string) => string | undefined,
): Letter {
  const photo = (media: ManifestPhoto): LetterPhoto | null => {
    const src = urlFor(media.path);
    if (!src) return null;
    const { path: _path, ...rest } = media;
    return { ...rest, src };
  };

  const chapters = manifest.chapters.map((chapter): LetterChapter => {
    const media = chapter.media
      .map((item): LetterMedia | null => {
        if (item.kind === 'photo') return photo(item);
        const src = urlFor(item.path);
        if (!src) return null;
        const { path: _path, poster, ...rest } = item;
        const posterSrc = poster ? urlFor(poster) : undefined;
        return posterSrc ? { ...rest, src, posterSrc } : { ...rest, src };
      })
      .filter((item): item is LetterMedia => item !== null);

    const cards = (chapter.aunque?.cards ?? [])
      .map((card) => {
        const media = photo(card.media);
        return media ? { text: card.text, media } : null;
      })
      .filter((card): card is { text: string; media: LetterPhoto } => card !== null);

    const { aunque, media: _media, ...rest } = chapter;
    return aunque && cards.length > 0
      ? { ...rest, media, aunque: { ...aunque, cards } }
      : { ...rest, media };
  });

  const audio = (list: LetterManifest['songs']) =>
    list
      .map((song): LetterSong | null => {
        const src = isPublicAsset(song.src) ? song.src : urlFor(song.src);
        return src ? { ...song, src } : null;
      })
      .filter((song): song is LetterSong => song !== null);

  const { moment, ...finaleRest } = manifest.finale;
  const momentPhoto = moment ? photo(moment.photo) : null;
  const finale: LetterFinale =
    moment && momentPhoto
      ? { ...finaleRest, moment: { ...moment, photo: momentPhoto } }
      : finaleRest;

  return {
    ...manifest,
    songs: audio(manifest.songs),
    sounds: audio(manifest.sounds ?? []),
    chapters,
    finale,
    memories: [],
  };
}

/** Fotos de toda la carta en orden cronológico — para el visor. */
export function photosInChronologicalOrder(letter: Letter): LetterPhoto[] {
  const photos: LetterPhoto[] = [];
  for (const chapter of letter.chapters) {
    for (const media of chapter.media) {
      if (media.kind === 'photo') photos.push(media);
    }
    // En el visor, las tarjetas de "aunque…" llevan su frase como epígrafe.
    for (const card of chapter.aunque?.cards ?? []) {
      photos.push({ ...card.media, caption: card.media.caption ?? card.text });
    }
  }
  photos.push(...letter.memories);
  return photos.sort((a, b) => Date.parse(a.takenAt) - Date.parse(b.takenAt));
}

function isPublicAsset(src: string): boolean {
  return src.startsWith('/');
}
