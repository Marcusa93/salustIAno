'use server';

import { tagPhoto } from '@/lib/ai/agents/photo-tagger';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

const BUCKET = 'photos';
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const MAX_PHOTO_BYTES = 20 * 1024 * 1024; // 20 MB
// Solo etiquetamos automáticamente formatos que el modelo entiende bien.
// HEIC/HEIF a veces no son interpretables por el endpoint de visión, así que
// las dejamos sin tags y la familia las puede tagear a mano.
const VISION_FRIENDLY_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
// Cota dura para no mandar imágenes enormes al modelo (los buffers grandes
// inflan el tiempo de upload y los costos). Si se pasa, omitimos tagging.
const MAX_TAGGABLE_BYTES = 8 * 1024 * 1024; // 8 MB

export interface AlbumEntry {
  id: string;
  name: string;
  kind: 'manual' | 'monthly' | 'milestone';
  monthKey: string | null; // 'YYYY-MM-01'
  coverPath: string | null;
  count: number;
  shareToken: string | null;
  sharedAt: string | null;
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
  const albumId = await getOrCreateMonthlyAlbum(
    supabase,
    familyGroupId,
    childId,
    userData.user.id,
    new Date(),
  );
  const shouldAutoTag = files.length === 1;

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

    // Tagging IA (best-effort). Si el modelo falla, timeoutea o el formato no
    // se puede analizar, dejamos tags=[] y caption=null y la familia lo edita
    // a mano desde el modal. Nunca bloquea el upload.
    const takenAtIso = new Date(file.lastModified || Date.now()).toISOString();
    let aiTags: string[] = [];
    let aiCaption: string | null = null;
    if (shouldAutoTag && VISION_FRIENDLY_MIME.has(file.type) && file.size <= MAX_TAGGABLE_BYTES) {
      try {
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        const dataUrl = `data:${file.type};base64,${base64}`;
        const result = await tagPhoto(
          { imageDataUrl: dataUrl, takenAtIso },
          {
            familyGroupId,
            ...(childId ? { childId } : {}),
            actorUserId: userData.user.id,
          },
        );
        aiTags = result.tags;
        aiCaption = result.caption.length > 0 ? result.caption : null;
      } catch {
        // best-effort, ya quedó logueado dentro del agente.
      }
    }

    // biome-ignore lint/suspicious/noExplicitAny: types stale.
    const sb = supabase as any;
    const { error: insertErr } = await sb.from('media_items').insert({
      child_id: childId,
      family_group_id: familyGroupId,
      album_id: albumId,
      storage_path: path,
      mime_type: file.type,
      size_bytes: file.size,
      caption: aiCaption,
      tags: aiTags,
      taken_at: takenAtIso,
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
  createdBy: string,
  date: Date,
): Promise<string | null> {
  // monthKey en hora AR — sin esto, una foto subida a las 23 AR (= 02
  // UTC del día siguiente) caería en el álbum del mes equivocado.
  const arParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);
  const arYear = arParts.find((p) => p.type === 'year')?.value ?? '';
  const arMonth = arParts.find((p) => p.type === 'month')?.value ?? '';
  const monthKey = `${arYear}-${arMonth}-01`;
  const monthName = date.toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
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
      created_by: createdBy,
    })
    .select('id')
    .single();

  if (!error && created?.id) return created.id as string;

  // Si otra request ganó la carrera y creó el álbum entre el SELECT y el
  // INSERT, re-leemos el registro en vez de dejar las fotos sin álbum.
  const { data: raced } = await supabase
    .from('albums')
    .select('id')
    .eq('family_group_id', familyGroupId)
    .eq('month_key', monthKey)
    .is('deleted_at', null)
    .maybeSingle();

  return (raced?.id as string | undefined) ?? null;
}

export async function listAlbumsAction(): Promise<AlbumEntry[]> {
  const supabase = await createClient();
  // biome-ignore lint/suspicious/noExplicitAny: types stale.
  const sb = supabase as any;
  const { data: albums } = await sb
    .from('albums')
    .select('id, name, kind, month_key, cover_path, share_token, shared_at')
    .is('deleted_at', null)
    .order('month_key', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (!albums) return [];

  return (albums as Array<Record<string, unknown>>).map((a) => ({
    id: a.id as string,
    name: a.name as string,
    kind: a.kind as AlbumEntry['kind'],
    monthKey: (a.month_key as string | null) ?? null,
    coverPath: (a.cover_path as string | null) ?? null,
    count: 0,
    shareToken: (a.share_token as string | null) ?? null,
    sharedAt: (a.shared_at as string | null) ?? null,
  }));
}

/**
 * Crea un álbum manual (sin month_key, kind='manual'). El nombre lo elige
 * la familia. El album_id se devuelve para poder navegar directo o asociar
 * fotos enseguida.
 */
export async function createManualAlbumAction(
  name: string,
): Promise<{ ok: true; album: AlbumEntry } | { ok: false; error: string }> {
  const trimmed = (name ?? '').trim();
  if (trimmed.length === 0 || trimmed.length > 80) {
    return { ok: false, error: 'El nombre tiene que tener entre 1 y 80 caracteres.' };
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, error: 'Sesión expirada.' };

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

  // biome-ignore lint/suspicious/noExplicitAny: types stale.
  const sb = supabase as any;
  const { data: created, error } = await sb
    .from('albums')
    .insert({
      family_group_id: membership.family_group_id,
      name: trimmed,
      kind: 'manual',
      created_by: userData.user.id,
    })
    .select('id, name, kind, month_key, cover_path, share_token, shared_at')
    .single();

  if (error || !created) return { ok: false, error: 'No pudimos crear el álbum.' };

  revalidatePath('/album');
  return {
    ok: true,
    album: {
      id: created.id as string,
      name: created.name as string,
      kind: created.kind as AlbumEntry['kind'],
      monthKey: (created.month_key as string | null) ?? null,
      coverPath: (created.cover_path as string | null) ?? null,
      count: 0,
      shareToken: (created.share_token as string | null) ?? null,
      sharedAt: (created.shared_at as string | null) ?? null,
    },
  };
}

/**
 * Asigna una foto a un álbum (manual o existente) o la saca del álbum
 * (`albumId === null` la deja huérfana).
 */
export async function assignPhotoToAlbumAction(
  photoId: string,
  albumId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof photoId !== 'string' || photoId.length === 0) {
    return { ok: false, error: 'ID inválido.' };
  }

  const supabase = await createClient();
  // biome-ignore lint/suspicious/noExplicitAny: types stale.
  const sb = supabase as any;
  const { error } = await sb.from('media_items').update({ album_id: albumId }).eq('id', photoId);

  if (error) return { ok: false, error: 'No pudimos cambiar el álbum de la foto.' };
  revalidatePath('/album');
  return { ok: true };
}

/**
 * Genera un share_token random de 32 chars y lo guarda en el álbum. La URL
 * `/compartir/album/[token]` queda accesible sin auth (anon) gracias a las
 * policies de la migration 017.
 */
export async function shareAlbumAction(
  albumId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (typeof albumId !== 'string' || albumId.length === 0) {
    return { ok: false, error: 'ID inválido.' };
  }

  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes, (b) => chars[b % chars.length]).join('');

  const supabase = await createClient();
  // biome-ignore lint/suspicious/noExplicitAny: types stale.
  const sb = supabase as any;
  const { error } = await sb
    .from('albums')
    .update({ share_token: token, shared_at: new Date().toISOString() })
    .eq('id', albumId);

  if (error) return { ok: false, error: 'No pudimos generar el link.' };
  revalidatePath('/album');
  return { ok: true, url: `/compartir/album/${token}` };
}

export async function revokeAlbumShareAction(
  albumId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  // biome-ignore lint/suspicious/noExplicitAny: types stale.
  const sb = supabase as any;
  const { error } = await sb
    .from('albums')
    .update({ share_token: null, shared_at: null })
    .eq('id', albumId);

  if (error) return { ok: false, error: 'No pudimos revocar el link.' };
  revalidatePath('/album');
  return { ok: true };
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

/**
 * Re-etiqueta una foto existente con el agente photo-tagger. Útil para fotos
 * subidas antes de que existiera el tagging IA, o cuando los tags actuales
 * no son los que la familia esperaba.
 *
 * Pisa los tags y el caption (no merge) — si la familia tenía tags propios,
 * el caller debería avisar antes. Para preservar lo manual, podríamos
 * agregar después un parámetro `merge: true`.
 */
export async function retagPhotoAction(
  id: string,
): Promise<{ ok: true; tags: string[]; caption: string | null } | { ok: false; error: string }> {
  if (typeof id !== 'string' || id.length === 0) {
    return { ok: false, error: 'ID inválido.' };
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, error: 'Sesión expirada.' };

  // biome-ignore lint/suspicious/noExplicitAny: types stale.
  const sb = supabase as any;
  const { data: row } = await sb
    .from('media_items')
    .select('id, storage_path, family_group_id, child_id, mime_type, taken_at')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!row) return { ok: false, error: 'Foto no encontrada.' };

  const mime = (row.mime_type as string | null) ?? '';
  if (!VISION_FRIENDLY_MIME.has(mime)) {
    return {
      ok: false,
      error: 'No podemos analizar este formato. Probá con JPG, PNG o WebP.',
    };
  }

  // Bajamos la imagen del Storage. Como ya validamos que el caller es family
  // member (RLS sobre media_items), la descarga del path correspondiente
  // está OK.
  const { data: blob, error: downloadErr } = await supabase.storage
    .from(BUCKET)
    .download(row.storage_path as string);

  if (downloadErr || !blob) {
    return { ok: false, error: 'No pudimos abrir la foto para analizarla.' };
  }

  const arrayBuffer = await blob.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_TAGGABLE_BYTES) {
    return { ok: false, error: 'La foto es demasiado grande para auto-etiquetar.' };
  }

  const dataUrl = `data:${mime};base64,${Buffer.from(arrayBuffer).toString('base64')}`;

  let tags: string[];
  let caption: string;
  try {
    const result = await tagPhoto(
      {
        imageDataUrl: dataUrl,
        ...(row.taken_at ? { takenAtIso: row.taken_at as string } : {}),
      },
      {
        familyGroupId: row.family_group_id as string,
        ...(row.child_id ? { childId: row.child_id as string } : {}),
        actorUserId: userData.user.id,
      },
    );
    tags = result.tags;
    caption = result.caption;
  } catch {
    return { ok: false, error: 'El modelo no pudo procesar la foto. Probá de nuevo.' };
  }

  const captionToSave = caption.trim().length > 0 ? caption.trim() : null;
  const { error: updateErr } = await sb
    .from('media_items')
    .update({ tags, caption: captionToSave })
    .eq('id', id);

  if (updateErr) return { ok: false, error: 'No pudimos guardar las nuevas etiquetas.' };

  revalidatePath('/album');
  return { ok: true, tags, caption: captionToSave };
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

/**
 * Renombra un álbum manual. Los mensuales no se renombran — su nombre
 * se deriva del `month_key` y la familia espera ver "Mayo 2026" siempre.
 * Si querés llamarlo distinto, conviene crear uno manual y mover las
 * fotos.
 */
export async function renameAlbumAction(
  id: string,
  name: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof id !== 'string' || id.length === 0) {
    return { ok: false, error: 'ID inválido.' };
  }
  const trimmed = (name ?? '').trim();
  if (trimmed.length === 0 || trimmed.length > 80) {
    return { ok: false, error: 'El nombre tiene que tener entre 1 y 80 caracteres.' };
  }

  const supabase = await createClient();
  // biome-ignore lint/suspicious/noExplicitAny: types stale.
  const sb = supabase as any;

  const { data: album } = await sb
    .from('albums')
    .select('id, kind')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!album) return { ok: false, error: 'Álbum no encontrado.' };
  if (album.kind !== 'manual') {
    return {
      ok: false,
      error: 'Los álbumes mensuales no se renombran — su nombre lo arma el sistema por mes.',
    };
  }

  const { error } = await sb.from('albums').update({ name: trimmed }).eq('id', id);
  if (error) return { ok: false, error: 'No pudimos renombrar el álbum.' };

  revalidatePath('/album');
  return { ok: true };
}

/**
 * Soft-delete de un álbum manual. Las fotos no se borran — quedan con
 * `album_id = null` (vuelven al pool general "sin álbum") para que la
 * familia no pierda nada por accidente.
 *
 * Los mensuales no se borran desde acá: si la familia subió una foto en
 * mayo, el álbum "Mayo 2026" siempre debería existir mientras esa foto
 * exista. Borrarlo lo recrearía en el próximo upload.
 *
 * Operación en dos pasos (no atómica):
 *   1. UPDATE media_items SET album_id = NULL WHERE album_id = id
 *   2. UPDATE albums SET deleted_at = now() WHERE id = id
 *
 * Si el paso 2 falla después del 1, las fotos quedan correctamente
 * desasignadas pero el álbum sigue existiendo (sin fotos) — el usuario
 * puede reintentar.
 */
export async function deleteAlbumAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof id !== 'string' || id.length === 0) {
    return { ok: false, error: 'ID inválido.' };
  }

  const supabase = await createClient();
  // biome-ignore lint/suspicious/noExplicitAny: types stale.
  const sb = supabase as any;

  const { data: album } = await sb
    .from('albums')
    .select('id, kind')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!album) return { ok: false, error: 'Álbum no encontrado.' };
  if (album.kind !== 'manual') {
    return {
      ok: false,
      error:
        'Los álbumes mensuales no se borran — se regeneran al subir una foto del mes. Para esconderlo, mové las fotos a otro álbum.',
    };
  }

  // 1. Sacar el album_id de las fotos (vuelven al pool general).
  const { error: detachErr } = await sb
    .from('media_items')
    .update({ album_id: null })
    .eq('album_id', id);
  if (detachErr) {
    return { ok: false, error: 'No pudimos desasignar las fotos del álbum.' };
  }

  // 2. Soft-delete del álbum.
  const { error: deleteErr } = await sb
    .from('albums')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (deleteErr) {
    return {
      ok: false,
      error:
        'Quitamos las fotos del álbum pero no pudimos eliminarlo. Probá de nuevo en unos segundos.',
    };
  }

  revalidatePath('/album');
  return { ok: true };
}
