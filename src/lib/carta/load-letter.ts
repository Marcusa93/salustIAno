import 'server-only';

import {
  LETTER_SLUG_PATTERN,
  type Letter,
  type LetterManifest,
  type LetterPhoto,
  collectStoragePaths,
  hydrateLetter,
  letterManifestSchema,
} from '@/lib/carta/manifest';
import { letterMemoryTag, memoriesFromItems } from '@/lib/carta/memories';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const LETTERS_BUCKET = 'cartas';
const ALBUM_BUCKET = 'photos';
// Alcanza para leerla con calma (y volver a leerla) sin recargar la página.
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 12;

export type LoadLetterResult =
  | { ok: true; letter: Letter }
  | { ok: false; reason: 'not-found' | 'invalid' | 'forbidden' };

type LettersBucket = ReturnType<ReturnType<typeof createAdminClient>['storage']['from']>;

type ManifestResult =
  | { ok: true; manifest: LetterManifest; bucket: LettersBucket }
  | { ok: false; reason: 'not-found' | 'invalid' };

/** Baja y valida `<slug>/manifest.json` del bucket privado. */
async function readManifest(slug: string): Promise<ManifestResult> {
  if (!LETTER_SLUG_PATTERN.test(slug)) return { ok: false, reason: 'not-found' };

  const bucket = createAdminClient().storage.from(LETTERS_BUCKET);
  const { data: file, error: downloadError } = await bucket.download(`${slug}/manifest.json`);
  if (downloadError || !file) return { ok: false, reason: 'not-found' };

  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  const parsed = letterManifestSchema.safeParse(raw);
  if (!parsed.success || parsed.data.slug !== slug) return { ok: false, reason: 'invalid' };
  return { ok: true, manifest: parsed.data, bucket };
}

/** Firma cada archivo de la carta con URLs de corta vida. */
async function signLetter(
  bucket: LettersBucket,
  manifest: LetterManifest,
  memories: LetterPhoto[] = [],
): Promise<Letter> {
  const { slug } = manifest;
  const paths = collectStoragePaths(manifest);
  const { data: signed } = await bucket.createSignedUrls(
    paths.map((path) => `${slug}/${path}`),
    SIGNED_URL_TTL_SECONDS,
  );

  const urls = new Map<string, string>();
  for (const entry of signed ?? []) {
    if (!entry.error && entry.path && entry.signedUrl) {
      urls.set(entry.path.slice(slug.length + 1), entry.signedUrl);
    }
  }
  return { ...hydrateLetter(manifest, (path) => urls.get(path)), memories };
}

/**
 * Carga una carta de la familia desde el bucket privado `cartas` y firma
 * sus archivos.
 *
 * Quién puede leerla lo decide RLS: si la persona logueada puede ver al
 * bebé de la carta (`child_profiles`), es de la familia y puede leerla.
 * Recién después usamos el cliente admin, solo para leer el bucket y
 * firmar URLs de corta vida.
 */
export async function loadLetter(slug: string): Promise<LoadLetterResult> {
  const read = await readManifest(slug);
  if (!read.ok) return read;
  const { manifest, bucket } = read;
  if (!manifest.childId) return { ok: false, reason: 'forbidden' };

  const supabase = await createClient();
  const { data: child } = await supabase
    .from('child_profiles')
    .select('id')
    .eq('id', manifest.childId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!child) return { ok: false, reason: 'forbidden' };

  const memories = await loadMemories(supabase, slug);
  return { ok: true, letter: await signLetter(bucket, manifest, memories) };
}

/**
 * Carga una carta para alguien de afuera de la familia (ej. la de Tibu
 * para Franco): se lee con el link, sin cuenta. Solo la sirve si el
 * manifest dice `"public": true`; una carta de la familia nunca sale por acá.
 */
export async function loadPublicLetter(slug: string): Promise<LoadLetterResult> {
  const read = await readManifest(slug);
  if (!read.ok) return read;
  if (read.manifest.public !== true) return { ok: false, reason: 'forbidden' };
  return { ok: true, letter: await signLetter(read.bucket, read.manifest) };
}

/**
 * Fotos que se sacaron desde el final de la carta. Están en el álbum de la
 * familia, así que se leen con el cliente del usuario: decide RLS.
 */
async function loadMemories(
  supabase: Awaited<ReturnType<typeof createClient>>,
  slug: string,
): Promise<LetterPhoto[]> {
  const { data: items } = await supabase
    .from('media_items')
    .select('storage_path, caption, taken_at, created_at, width, height')
    .contains('tags', [letterMemoryTag(slug)])
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(24);
  if (!items || items.length === 0) return [];

  const { data: signed } = await supabase.storage.from(ALBUM_BUCKET).createSignedUrls(
    items.map((item) => item.storage_path),
    SIGNED_URL_TTL_SECONDS,
  );
  const urls = new Map<string, string>();
  for (const entry of signed ?? []) {
    if (!entry.error && entry.path && entry.signedUrl) urls.set(entry.path, entry.signedUrl);
  }
  return memoriesFromItems(items, (path) => urls.get(path), 'Mamá y Salu, el día de la carta.');
}
