// Sube una carta (manifest.json + fotos, video y canciones) al bucket
// privado `cartas` de Supabase Storage. El contenido no se commitea: el
// repo es público. Ver decisions/0014-cartas-contenido-privado.md.
//
// Uso:
//   node --env-file=.env.local scripts/carta/upload-letter.mjs "<carpeta de la carta>"
//
// La carpeta tiene el manifest.json y los archivos con los mismos paths
// que referencia (fotos/01.jpg, video/nacimiento.mp4, canciones/x.mp3...).
// Se puede correr de nuevo cuantas veces haga falta: pisa lo que ya estaba.

import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'cartas';
const CONTENT_TYPES = {
  '.json': 'application/json',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
};

const folder = process.argv[2];
if (!folder) {
  console.error(
    'Falta la carpeta: node --env-file=.env.local scripts/carta/upload-letter.mjs <carpeta>',
  );
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error(
    'Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY (¿corriste con --env-file=.env.local?).',
  );
  process.exit(1);
}

const root = resolve(folder);
const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'));
const slug = manifest.slug;
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug ?? '')) {
  console.error('El manifest necesita un "slug" válido (ej. "mama-2026").');
  process.exit(1);
}

const files = new Set(['manifest.json']);
for (const chapter of manifest.chapters ?? []) {
  for (const media of chapter.media ?? []) {
    files.add(media.path);
    if (media.poster) files.add(media.poster);
  }
  for (const card of chapter.aunque?.cards ?? []) files.add(card.media.path);
}
for (const song of manifest.songs ?? []) {
  if (!song.src.startsWith('/')) files.add(song.src);
}

const missing = [];
for (const file of files) {
  try {
    await stat(join(root, file));
  } catch {
    missing.push(file);
  }
}
if (missing.length > 0) {
  console.error(`Faltan archivos en ${root}:\n  ${missing.join('\n  ')}`);
  process.exit(1);
}

const supabase = createClient(url, secret, { auth: { persistSession: false } });

const { data: buckets, error: listError } = await supabase.storage.listBuckets();
if (listError) throw listError;
if (!buckets.some((bucket) => bucket.name === BUCKET)) {
  const { error } = await supabase.storage.createBucket(BUCKET, { public: false });
  if (error) throw error;
  console.info(`Bucket privado "${BUCKET}" creado.`);
}

let uploaded = 0;
for (const file of files) {
  const contentType = CONTENT_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(`${slug}/${file}`, await readFile(join(root, file)), {
      contentType,
      upsert: true,
      // El manifest cambia seguido mientras se ajusta la carta; los archivos no.
      cacheControl: file === 'manifest.json' ? '0' : '86400',
    });
  if (error) {
    console.error(`✗ ${file}: ${error.message}`);
    process.exitCode = 1;
    continue;
  }
  uploaded += 1;
  console.info(`✓ ${file}`);
}

console.info(`\n${uploaded}/${files.size} archivos subidos a ${BUCKET}/${slug}/`);
