import { describe, expect, it } from 'vitest';
import {
  type LetterManifest,
  collectStoragePaths,
  hydrateLetter,
  letterManifestSchema,
  photosInChronologicalOrder,
} from './manifest';

function nth<T>(items: T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`No hay elemento ${index}.`);
  return item;
}

const photo = (path: string, takenAt: string) => ({
  kind: 'photo' as const,
  path,
  width: 1200,
  height: 1600,
  takenAt,
  alt: `Foto ${path}`,
});

function baseManifest(): LetterManifest {
  return {
    version: 1,
    slug: 'mama-2026',
    childId: '00000000-0000-4000-8000-000000000001',
    birthAt: '2026-05-04T18:30:00-03:00',
    envelope: {
      to: 'Para mamá',
      from: 'De: Salu',
      stamp: '18 · 10 · 26',
      hint: 'Subí el volumen.',
    },
    heartbeat: { prompt: 'Antes de verme…', instruction: 'Apoyá el dedo.', after: 'Ese era yo.' },
    intro: ['Mamá:'],
    songs: [
      { id: 'piano', title: 'Piano', src: '/audio/piano.mp3' },
      { id: 'nuestra', title: 'Nuestra canción', src: 'canciones/nuestra.mp3' },
    ],
    chapters: [
      {
        id: 'nacimiento',
        label: '4 de mayo',
        title: 'El día que te conocí',
        song: 'nuestra',
        text: ['Hola, mamá.'],
        media: [
          photo('fotos/03.jpg', '2026-05-04T18:36:20-03:00'),
          {
            kind: 'video',
            path: 'video/nacimiento.mp4',
            poster: 'video/nacimiento.jpg',
            width: 576,
            height: 1024,
            takenAt: '2026-05-04T18:45:48-03:00',
            alt: 'Video',
          },
        ],
      },
      {
        id: 'septiembre',
        label: 'Septiembre',
        title: 'Cuatro meses',
        text: ['La que volvió a trabajar.'],
        media: [photo('fotos/35.jpg', '2026-09-07T14:10:15-03:00')],
        aunque: {
          cards: [{ text: 'Aunque…', media: photo('fotos/38.jpg', '2026-09-17T09:28:20-03:00') }],
          reveal: 'Y aun así, mamá…',
        },
      },
    ],
    finale: {
      song: 'piano',
      lines: ['Nunca vas a estar sola.'],
      touchPrompt: 'Apoyá el dedo.',
      closing: ['Gracias por tu magia.'],
      signature: 'Salu',
      wish: 'Feliz Día de la Madre.',
    },
  };
}

describe('letterManifestSchema', () => {
  it('acepta un manifest completo', () => {
    expect(letterManifestSchema.safeParse(baseManifest()).success).toBe(true);
  });

  it('acepta una posdata al final', () => {
    const manifest = baseManifest();
    manifest.finale.postscript = {
      label: 'P.D. de papá',
      lines: ['Nadie nunca me hizo tan feliz.'],
      signature: 'Marco',
    };
    const parsed = letterManifestSchema.safeParse(manifest);
    expect(parsed.success && parsed.data.finale.postscript?.signature).toBe('Marco');
  });

  it('acepta los textos de la foto del final, con epígrafe corto', () => {
    const manifest = baseManifest();
    manifest.finale.photo = {
      prompt: 'Faltaba una foto: la de hoy.',
      button: 'Sacarnos una foto',
      caption: 'Mamá y yo, el día de esta carta.',
      saved: 'La guardé en el álbum.',
    };
    expect(letterManifestSchema.safeParse(manifest).success).toBe(true);
    manifest.finale.photo.caption = 'x'.repeat(201);
    expect(letterManifestSchema.safeParse(manifest).success).toBe(false);
  });

  it('rechaza una foto que referencia un sonido inexistente', () => {
    const manifest = baseManifest();
    manifest.finale.moment = {
      photo: { ...photo('fotos/46.jpg', '2026-10-17T20:30:00-03:00'), sound: 'risa' },
      hint: 'Tocame',
    };
    expect(letterManifestSchema.safeParse(manifest).success).toBe(false);
    manifest.sounds = [{ id: 'risa', title: 'La risa', src: 'sonidos/risa.mp3' }];
    expect(letterManifestSchema.safeParse(manifest).success).toBe(true);
  });

  it('rechaza un capítulo que referencia una canción inexistente', () => {
    const manifest = baseManifest();
    nth(manifest.chapters, 0).song = 'no-existe';
    expect(letterManifestSchema.safeParse(manifest).success).toBe(false);
  });

  it('rechaza paths que intentan salir de la carpeta de la carta', () => {
    const manifest = baseManifest();
    nth(manifest.chapters, 1).media = [
      photo('fotos/../../otra-carta/manifest.json', '2026-09-07T14:10:15-03:00'),
    ];
    expect(letterManifestSchema.safeParse(manifest).success).toBe(false);
  });

  it('exige fechas con zona horaria', () => {
    const manifest = baseManifest();
    nth(manifest.chapters, 1).media = [photo('fotos/35.jpg', '2026-09-07 14:10')];
    expect(letterManifestSchema.safeParse(manifest).success).toBe(false);
  });
});

describe('collectStoragePaths', () => {
  it('junta fotos, video, poster, tarjetas y canciones del bucket, sin las públicas', () => {
    expect(collectStoragePaths(baseManifest()).sort()).toEqual([
      'canciones/nuestra.mp3',
      'fotos/03.jpg',
      'fotos/35.jpg',
      'fotos/38.jpg',
      'video/nacimiento.jpg',
      'video/nacimiento.mp4',
    ]);
  });
});

describe('sonidos y momento final', () => {
  const withMoment = () => {
    const manifest = baseManifest();
    manifest.sounds = [{ id: 'risa', title: 'La risa', src: 'sonidos/risa.mp3' }];
    manifest.finale.moment = {
      photo: { ...photo('fotos/46.jpg', '2026-10-17T20:30:00-03:00'), sound: 'risa' },
      hint: 'Tocame',
      after: 'Esta risa es tuya, mamá.',
    };
    return manifest;
  };

  it('firma la risa y la foto del momento', () => {
    expect(collectStoragePaths(withMoment())).toEqual(
      expect.arrayContaining(['sonidos/risa.mp3', 'fotos/46.jpg']),
    );
    const letter = hydrateLetter(withMoment(), (path) => `u:${path}`);
    expect(letter.sounds).toEqual([{ id: 'risa', title: 'La risa', src: 'u:sonidos/risa.mp3' }]);
    expect(letter.finale.moment?.photo).toMatchObject({ src: 'u:fotos/46.jpg', sound: 'risa' });
    expect(letter.finale.moment?.photo).not.toHaveProperty('path');
  });

  it('firma la foto del latido y la deja lista para la pantalla del principio', () => {
    const manifest = baseManifest();
    manifest.heartbeat.photo = photo('fotos/03.jpg', '2026-05-04T18:36:20-03:00');
    expect(collectStoragePaths(manifest)).toContain('fotos/03.jpg');
    const letter = hydrateLetter(manifest, (path) => `u:${path}`);
    expect(letter.heartbeat.photo).toMatchObject({ src: 'u:fotos/03.jpg' });
    expect(letter.heartbeat.after).toBe('Ese era yo.');
    expect(hydrateLetter(baseManifest(), (path) => `u:${path}`).heartbeat.photo).toBeUndefined();
  });

  it('si la foto del momento no se pudo firmar, el final queda sin momento', () => {
    const letter = hydrateLetter(withMoment(), (path) =>
      path === 'fotos/46.jpg' ? undefined : `u:${path}`,
    );
    expect(letter.finale.moment).toBeUndefined();
    expect(letter.finale.signature).toBe('Salu');
  });
});

describe('hydrateLetter', () => {
  const signed = (path: string) => `https://storage.test/${path}?token=abc`;

  it('reemplaza cada path por su URL y deja las canciones públicas como están', () => {
    const letter = hydrateLetter(baseManifest(), signed);
    const birth = nth(letter.chapters, 0);
    expect(birth.media[0]).toMatchObject({ kind: 'photo', src: signed('fotos/03.jpg') });
    expect(birth.media[0]).not.toHaveProperty('path');
    expect(birth.media[1]).toMatchObject({
      kind: 'video',
      src: signed('video/nacimiento.mp4'),
      posterSrc: signed('video/nacimiento.jpg'),
    });
    expect(letter.songs.map((song) => song.src)).toEqual([
      '/audio/piano.mp3',
      signed('canciones/nuestra.mp3'),
    ]);
  });

  it('descarta lo que no se pudo firmar en vez de romper la carta', () => {
    const letter = hydrateLetter(baseManifest(), (path) =>
      path.startsWith('fotos/38') || path.startsWith('canciones/') ? undefined : signed(path),
    );
    expect(nth(letter.chapters, 1).aunque).toBeUndefined();
    expect(nth(letter.chapters, 1).media).toHaveLength(1);
    expect(letter.songs.map((song) => song.id)).toEqual(['piano']);
  });
});

describe('photosInChronologicalOrder', () => {
  it('ordena todas las fotos por fecha e incluye las tarjetas, pero no el video', () => {
    const manifest = baseManifest();
    manifest.chapters.reverse();
    const letter = hydrateLetter(manifest, (path) => `u:${path}`);
    expect(photosInChronologicalOrder(letter).map((p) => p.src)).toEqual([
      'u:fotos/03.jpg',
      'u:fotos/35.jpg',
      'u:fotos/38.jpg',
    ]);
  });

  it('suma al visor las fotos sacadas desde la carta, en su lugar cronológico', () => {
    const letter = hydrateLetter(baseManifest(), (path) => `u:${path}`);
    letter.memories = [
      {
        kind: 'photo',
        src: 'u:album/hoy.jpg',
        width: 1200,
        height: 1600,
        takenAt: '2026-10-18T12:00:00-03:00',
        alt: 'Mamá y Salu',
      },
    ];
    expect(photosInChronologicalOrder(letter).at(-1)?.src).toBe('u:album/hoy.jpg');
  });

  it('usa la frase de la tarjeta como epígrafe en el visor', () => {
    const letter = hydrateLetter(baseManifest(), (path) => `u:${path}`);
    const card = photosInChronologicalOrder(letter).find((p) => p.src === 'u:fotos/38.jpg');
    expect(card?.caption).toBe('Aunque…');
  });
});
