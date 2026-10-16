import 'server-only';

import {
  LETTER_SLUG_PATTERN,
  type Letter,
  collectStoragePaths,
  hydrateLetter,
  letterManifestSchema,
} from '@/lib/carta/manifest';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const LETTERS_BUCKET = 'cartas';
// Alcanza para leerla con calma (y volver a leerla) sin recargar la página.
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 12;

export type LoadLetterResult =
  | { ok: true; letter: Letter }
  | { ok: false; reason: 'not-found' | 'invalid' | 'forbidden' };

/**
 * Carga una carta desde el bucket privado `cartas` y firma sus archivos.
 *
 * Quién puede leerla lo decide RLS: si la persona logueada puede ver al
 * bebé de la carta (`child_profiles`), es de la familia y puede leerla.
 * Recién después usamos el cliente admin, solo para leer el bucket y
 * firmar URLs de corta vida.
 */
export async function loadLetter(slug: string): Promise<LoadLetterResult> {
  if (!LETTER_SLUG_PATTERN.test(slug)) return { ok: false, reason: 'not-found' };

  const admin = createAdminClient();
  const bucket = admin.storage.from(LETTERS_BUCKET);

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
  const manifest = parsed.data;

  const supabase = await createClient();
  const { data: child } = await supabase
    .from('child_profiles')
    .select('id')
    .eq('id', manifest.childId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!child) return { ok: false, reason: 'forbidden' };

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

  return { ok: true, letter: hydrateLetter(manifest, (path) => urls.get(path)) };
}
