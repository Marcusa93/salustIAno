'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

const BUCKET = 'photos';
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const MAX_PHOTO_BYTES = 20 * 1024 * 1024; // 20 MB

export interface AlbumEntry {
  id: string;
  name: string;
  kind: 'manual' | 'monthly' | 'milestone';
  monthKey: string | null; // 'YYYY-MM-01'
  coverPath: string | null;
  count: number;
}

export interface PhotoEntry {
  id: string;
  albumId: string | null;
  storagePath: string;
  caption: string | null;
  tags: string[];
  width: number | null;
  height: number | null;
  takenAt: string | null;
  createdAt: string;
}

export type UploadResult =
  | { ok: true; uploaded: number; failed: number }
  | { ok: false; error: string };

/**
 * Sube una o varias fotos al bucket `photos`. Para cada una:
 *   1. Valida tipo y tamaño.
 *   2. La sube al Storage en {family}/{ts}-{rand}.{ext}.
 *   3. Crea/encuentra el álbum mensual (kind='monthly', month_key=primer
 *      día del mes de la fecha actual) — auto-categorización por mes.
 *   4. Inserta media_items asociando la foto al álbum.
 *
 * No bloquea si una foto falla — devuelve cuántas pasaron y cuántas no.
 */
export async function uploadPhotosAction(formData: FormData): Promise<UploadResult> {
  const files = formData.getAll('photos').filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return { ok: false, error: 'No recibimos ninguna foto.' };
  }

  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return { ok: false, error: 'Sesión expirada.' };
  }

  const { data: membership } = await supabase
    .from('family_memberships')
    .select('family_group_id')
    .eq('user_id', userData.user.id)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();

  if (!membership?.family_group_id) {
    return { ok: false, error: 'No encontramos tu grupo familiar.' };
  }
  const familyGroupId = membership.family_group_id as string;

  const { data: child } = await supabase
    .from('child_profiles')
    .select('id')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  const childId = (child?.id as string | undefined) ?? null;

  // Resolver/crear álbum mensual para hoy.
  const albumId = await getOrCreateMonthlyAlbum(supabase, familyGroupId, childId, new Date());

  let uploaded = 0;
  let failed = 0;

  for (const file of files) {
    if (file.size === 0 || file.size > MAX_PHOTO_BYTES) {
      failed += 1;
      continue;
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      failed += 1;
      continue;
    }

    const ext =
      (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const rand = Math.random().toString(36).slice(2, 8);
    const path = `${familyGroupId}/${Date.now()}-${rand}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, arrayBuffer, {
      contentType: file.type,
      cacheControl: '31536000',
      upsert: false,
    });

    if (uploadErr) {
      failed += 1;
      continue;
    }

    // biome-ignore lint/suspicious/noExplicitAny: types stale.
    const sb = supabase as any;
    const { error: insertErr } = await sb.from('media_items').insert({
      child_id: childId,
      family_group_id: familyGroupId,
      album_id: albumId,
      storage_path: path,
      mime_type: file.type,
      caption: null,
      tags: [],
      taken_at: new Date(file.lastModified || Date.now()).toISOString(),
      created_by: userData.user.id,
    });

    if (insertErr) {
      // Borramos el objeto subido para no dejar huérfano.
      await supabase.storage.from(BUCKET).remove([path]);
      failed += 1;
      continue;
    }
    uploaded += 1;
  }

  if (uploaded > 0) revalidatePath('/album');
  return { ok: true, uploaded, failed };
}

/**
 * Crea o devuelve el álbum mensual para la fecha dada. La unicidad por
 * (family_group_id, month_key) en la tabla evita duplicados.
 */
async function getOrCreateMonthlyAlbum(
  // biome-ignore lint/suspicious/noExplicitAny: tipo del cliente Supabase server.
  supabase: any,
  familyGroupId: string,
  childId: string | null,
  date: Date,
): Promise<string | null> {
  const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
  const monthName = date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  const capitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  const { data: existing } = await supabase
    .from('albums')
    .select('id')
    .eq('family_group_id', familyGroupId)
    .eq('month_key', monthKey)
    .is('deleted_at', null)
    .maybeSingle();

  if (existing?.id) return existing.id as string;

  const { data: created, error } = await supabase
    .from('albums')
    .insert({
      family_group_id: familyGroupId,
      child_id: childId,
      name: capitalized,
      kind: 'monthly',
      month_key: monthKey,
    })
    .select('id')
    .single();

  if (error || !created) return null;
  return created.id as string;
}

export async function listAlbumsAction(): Promise<AlbumEntry[]> {
  const supabase = await createClient();
  // biome-ignore lint/suspicious/noExplicitAny: types stale.
  const sb = supabase as any;
  const { data: albums } = await sb
    .from('albums')
    .select('id, name, kind, month_key, cover_path')
    .is('deleted_at', null)
    .order('month_key', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (!albums) return [];

  // Contar fotos por álbum (una sola query con group by sería ideal pero
  // PostgREST no expone agregados directos sin RPC. Hacemos N queries
  // simples — en la práctica los álbumes son pocos por familia).
  const counts: Record<string, number> = {};
  for (const a of albums as Array<{ id: string }>) {
    const { count } = await sb
      .from('media_items')
      .select('id', { count: 'exact', head: true })
      .eq('album_id', a.id)
      .is('deleted_at', null);
    counts[a.id] = count ?? 0;
  }

  return (albums as Array<Record<string, unknown>>).map((a) => ({
    id: a.id as string,
    name: a.name as string,
    kind: a.kind as AlbumEntry['kind'],
    monthKey: (a.month_key as string | null) ?? null,
    coverPath: (a.cover_path as string | null) ?? null,
    count: counts[a.id as string] ?? 0,
  }));
}

export async function listPhotosAction(albumId?: string | null): Promise<PhotoEntry[]> {
  const supabase = await createClient();
  // biome-ignore lint/suspicious/noExplicitAny: types stale.
  const sb = supabase as any;
  let query = sb
    .from('media_items')
    .select('id, album_id, storage_path, caption, tags, width, height, taken_at, created_at')
    .is('deleted_at', null)
    .order('taken_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(200);

  if (albumId) query = query.eq('album_id', albumId);

  const { data, error } = await query;
  if (error || !data) return [];

  return (data as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    albumId: (r.album_id as string | null) ?? null,
    storagePath: r.storage_path as string,
    caption: (r.caption as string | null) ?? null,
    tags: (r.tags as string[]) ?? [],
    width: (r.width as number | null) ?? null,
    height: (r.height as number | null) ?? null,
    takenAt: (r.taken_at as string | null) ?? null,
    createdAt: r.created_at as string,
  }));
}

export async function getPhotoUrlAction(
  path: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (typeof path !== 'string' || path.length === 0 || path.length > 500) {
    return { ok: false, error: 'Path inválido.' };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) {
    return { ok: false, error: 'No pudimos abrir la foto.' };
  }
  return { ok: true, url: data.signedUrl };
}

export async function updatePhotoAction(
  id: string,
  updates: { caption?: string; tags?: string[] },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  // biome-ignore lint/suspicious/noExplicitAny: types stale.
  const sb = supabase as any;

  const payload: Record<string, unknown> = {};
  if (updates.caption !== undefined) {
    payload.caption = updates.caption.trim().length > 0 ? updates.caption.trim() : null;
  }
  if (updates.tags !== undefined) {
    payload.tags = updates.tags
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0 && t.length <= 50)
      .slice(0, 12);
  }

  const { error } = await sb.from('media_items').update(payload).eq('id', id);
  if (error) return { ok: false, error: 'No pudimos guardar los cambios.' };
  revalidatePath('/album');
  return { ok: true };
}

export async function deletePhotoAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  // biome-ignore lint/suspicious/noExplicitAny: types stale.
  const sb = supabase as any;

  // Lookup del path para eliminar también del Storage.
  const { data: row } = await sb
    .from('media_items')
    .select('storage_path')
    .eq('id', id)
    .maybeSingle();

  const { error } = await sb
    .from('media_items')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return { ok: false, error: 'No pudimos borrar la foto.' };

  if (row?.storage_path) {
    // Best-effort: si falla el remove del Storage, queda huérfano.
    await supabase.storage.from(BUCKET).remove([row.storage_path as string]);
  }

  revalidatePath('/album');
  return { ok: true };
}
