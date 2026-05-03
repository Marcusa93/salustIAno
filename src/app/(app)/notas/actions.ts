'use server';

import { createClient } from '@/lib/supabase/server';
import { type NoteInput, noteSchema } from '@/lib/validators/note';
import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { sendPushToFamily } from '../perfil/push-actions';

type ActionResult<TInput> =
  | { ok: true }
  | { ok: false; errors: Partial<Record<keyof TInput | 'root', string>> };

async function getActorContext() {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return { error: 'Sesión expirada.' as const };

  const { data: child, error: childError } = await supabase
    .from('child_profiles')
    .select('id')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (childError || !child) {
    return { error: 'Todavía no tenés un perfil de bebé creado.' as const };
  }

  return { supabase, userId: userData.user.id, childId: child.id };
}

function flatten(error: import('zod').ZodError): Partial<Record<keyof NoteInput | 'root', string>> {
  const fieldErrors = error.flatten().fieldErrors as Record<string, string[] | undefined>;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(fieldErrors)) {
    if (v?.[0]) out[k] = v[0];
  }
  return out as Partial<Record<keyof NoteInput | 'root', string>>;
}

/**
 * Crea una nota. RLS permite que cualquier miembro inserte (con
 * self-attribution). Update/delete los maneja el author o un admin.
 */
export async function createNoteAction(input: NoteInput): Promise<ActionResult<NoteInput>> {
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: flatten(parsed.error) };
  }

  const ctx = await getActorContext();
  if ('error' in ctx) return { ok: false, errors: { root: ctx.error } };

  const { data, error } = await ctx.supabase
    .from('notes')
    .insert({
      child_id: ctx.childId,
      occurred_at: parsed.data.occurred_at,
      category: parsed.data.category,
      content: parsed.data.content,
      created_by: ctx.userId,
    })
    .select('id')
    .single();

  if (error || !data) {
    return { ok: false, errors: { root: 'No pudimos guardar la nota.' } };
  }

  // Notificación push al resto de la familia (best-effort, no bloquea).
  // El display_name del autor lo resolvemos por la membership.
  try {
    const { data: membership } = await ctx.supabase
      .from('family_memberships')
      .select('display_name, family_group_id')
      .eq('user_id', ctx.userId)
      .is('deleted_at', null)
      .maybeSingle();

    if (membership?.family_group_id) {
      const author = membership.display_name ?? 'Alguien';
      const excerpt = parsed.data.content.slice(0, 80);
      await sendPushToFamily(
        membership.family_group_id,
        {
          title: `${author} dejó un momento`,
          body: excerpt,
          url: `/notas/${data.id}`,
          tag: `note-${data.id}`,
        },
        ctx.userId,
      );
    }
  } catch {
    /* Push falla no debería bloquear la creación de la nota. */
  }

  revalidatePath('/timeline');
  revalidatePath('/home');
  redirect(`/notas/${data.id}` as Route);
}

export async function updateNoteAction(
  id: string,
  input: NoteInput,
): Promise<ActionResult<NoteInput>> {
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: flatten(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('notes')
    .update({
      occurred_at: parsed.data.occurred_at,
      category: parsed.data.category,
      content: parsed.data.content,
    })
    .eq('id', id);

  if (error) {
    return { ok: false, errors: { root: 'No pudimos actualizar la nota.' } };
  }

  revalidatePath('/timeline');
  revalidatePath('/home');
  revalidatePath(`/notas/${id}`);
  redirect(`/notas/${id}` as Route);
}

export async function deleteNoteAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('notes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    return { ok: false, error: 'No pudimos borrar la nota.' };
  }

  revalidatePath('/timeline');
  revalidatePath('/home');
  redirect('/timeline?tipo=note' as Route);
}

// ----------------------------------------------------------------------------
// Fotos adjuntas a notas (migration 018 — note_id en media_items)
// ----------------------------------------------------------------------------

const PHOTO_BUCKET = 'photos';
const ALLOWED_PHOTO_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const MAX_PHOTO_BYTES = 20 * 1024 * 1024; // 20 MB

export interface NotePhoto {
  id: string;
  storagePath: string;
  caption: string | null;
}

/**
 * Sube una o varias fotos al bucket `photos` y las asocia a la nota dada.
 * Reusa la convención de path `{family}/notes/{ts}-{rand}.{ext}` para que
 * la RLS de Storage filtre por familia.
 */
export async function attachPhotosToNoteAction(
  noteId: string,
  formData: FormData,
): Promise<{ ok: true; uploaded: number; failed: number } | { ok: false; error: string }> {
  if (typeof noteId !== 'string' || noteId.length === 0) {
    return { ok: false, error: 'ID de nota inválido.' };
  }

  const files = formData.getAll('photos').filter((f): f is File => f instanceof File);
  if (files.length === 0) return { ok: false, error: 'No recibimos ninguna foto.' };

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, error: 'Sesión expirada.' };

  // Verificamos que la nota existe y resolvemos child_id + family_group_id.
  // biome-ignore lint/suspicious/noExplicitAny: types stale.
  const sb = supabase as any;
  const { data: note } = await sb
    .from('notes')
    .select('id, child_id')
    .eq('id', noteId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!note) return { ok: false, error: 'No encontramos esa nota.' };

  const { data: child } = await sb
    .from('child_profiles')
    .select('family_group_id')
    .eq('id', note.child_id)
    .maybeSingle();

  if (!child?.family_group_id) {
    return { ok: false, error: 'No encontramos el grupo familiar de la nota.' };
  }
  const familyGroupId = child.family_group_id as string;

  let uploaded = 0;
  let failed = 0;

  for (const file of files) {
    if (file.size === 0 || file.size > MAX_PHOTO_BYTES) {
      failed += 1;
      continue;
    }
    if (!ALLOWED_PHOTO_MIME.includes(file.type)) {
      failed += 1;
      continue;
    }

    const ext =
      (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const rand = Math.random().toString(36).slice(2, 8);
    const path = `${familyGroupId}/notes/${Date.now()}-${rand}.${ext}`;

    const buffer = await file.arrayBuffer();
    const { error: uploadErr } = await supabase.storage.from(PHOTO_BUCKET).upload(path, buffer, {
      contentType: file.type,
      cacheControl: '31536000',
      upsert: false,
    });
    if (uploadErr) {
      failed += 1;
      continue;
    }

    const { error: insertErr } = await sb.from('media_items').insert({
      child_id: note.child_id,
      family_group_id: familyGroupId,
      note_id: noteId,
      storage_path: path,
      mime_type: file.type,
      caption: null,
      tags: [],
      taken_at: new Date(file.lastModified || Date.now()).toISOString(),
      created_by: userData.user.id,
    });

    if (insertErr) {
      await supabase.storage.from(PHOTO_BUCKET).remove([path]);
      failed += 1;
      continue;
    }
    uploaded += 1;
  }

  if (uploaded > 0) {
    revalidatePath(`/notas/${noteId}`);
  }
  return { ok: true, uploaded, failed };
}

/**
 * Devuelve las fotos asociadas a una nota.
 */
export async function listNotePhotosAction(noteId: string): Promise<NotePhoto[]> {
  if (typeof noteId !== 'string' || noteId.length === 0) return [];

  const supabase = await createClient();
  // biome-ignore lint/suspicious/noExplicitAny: types stale.
  const sb = supabase as any;
  const { data } = await sb
    .from('media_items')
    .select('id, storage_path, caption')
    .eq('note_id', noteId)
    .is('deleted_at', null)
    .order('taken_at', { ascending: true, nullsFirst: false });

  if (!data) return [];
  return (data as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    storagePath: r.storage_path as string,
    caption: (r.caption as string | null) ?? null,
  }));
}

/**
 * Saca el note_id de una foto (la nota se queda sin esa foto, pero la foto
 * sigue existiendo en el álbum/storage). Si querés borrar la foto entera
 * usá `deletePhotoAction` desde /album.
 */
export async function detachPhotoFromNoteAction(
  photoId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof photoId !== 'string' || photoId.length === 0) {
    return { ok: false, error: 'ID inválido.' };
  }

  const supabase = await createClient();
  // biome-ignore lint/suspicious/noExplicitAny: types stale.
  const sb = supabase as any;
  const { error } = await sb.from('media_items').update({ note_id: null }).eq('id', photoId);

  if (error) return { ok: false, error: 'No pudimos sacar la foto de la nota.' };
  return { ok: true };
}
