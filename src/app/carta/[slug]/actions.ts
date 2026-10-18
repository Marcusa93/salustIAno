'use server';

import { sendPushToFamily } from '@/app/(app)/perfil/push-actions';
import { getOrCreateMonthlyAlbum } from '@/lib/album/monthly-album';
import { LETTER_SLUG_PATTERN, type LetterPhoto } from '@/lib/carta/manifest';
import { letterMemoryTag, letterPhotoProblem } from '@/lib/carta/memories';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

const BUCKET = 'photos';
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 12;
const MAX_CAPTION = 200;

export type SaveLetterPhotoResult = { ok: true; photo: LetterPhoto } | { ok: false; error: string };

function positiveInt(value: FormDataEntryValue | null): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n < 20_000 ? n : null;
}

/**
 * Guarda la foto que se sacan al final de una carta: va al álbum del mes
 * (como cualquier foto) con el tag de la carta, para que la próxima vez
 * aparezca también ahí. Todo con el cliente del usuario: decide RLS.
 */
export async function saveLetterPhotoAction(
  slug: string,
  formData: FormData,
): Promise<SaveLetterPhotoResult> {
  if (!LETTER_SLUG_PATTERN.test(slug)) return { ok: false, error: 'Carta inválida.' };

  const file = formData.get('photo');
  if (!(file instanceof File)) return { ok: false, error: 'No recibimos la foto.' };
  const problem = letterPhotoProblem(file);
  if (problem) return { ok: false, error: problem };

  const rawCaption = formData.get('caption');
  const caption =
    typeof rawCaption === 'string' && rawCaption.trim().length > 0
      ? rawCaption.trim().slice(0, MAX_CAPTION)
      : null;
  const width = positiveInt(formData.get('width'));
  const height = positiveInt(formData.get('height'));

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, error: 'Tu sesión se venció. Volvé a entrar.' };

  const { data: membership } = await supabase
    .from('family_memberships')
    .select('family_group_id, display_name')
    .eq('user_id', userData.user.id)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();
  if (!membership?.family_group_id) return { ok: false, error: 'No encontramos tu familia.' };
  const familyGroupId = membership.family_group_id as string;

  const { data: child } = await supabase
    .from('child_profiles')
    .select('id')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!child) return { ok: false, error: 'No encontramos el perfil de Salu.' };

  const now = new Date();
  const albumId = await getOrCreateMonthlyAlbum(
    supabase,
    familyGroupId,
    child.id,
    userData.user.id,
    now,
  );

  const ext =
    ({ 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic' } as const)[
      file.type as 'image/png' | 'image/webp' | 'image/heic'
    ] ?? 'jpg';
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `${familyGroupId}/carta-${slug}-${now.getTime()}-${rand}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, await file.arrayBuffer(), {
      contentType: file.type,
      cacheControl: '31536000',
      upsert: false,
    });
  if (uploadError) return { ok: false, error: 'No pudimos guardar la foto. Probá de nuevo.' };

  const { error: insertError } = await supabase.from('media_items').insert({
    child_id: child.id,
    family_group_id: familyGroupId,
    album_id: albumId,
    storage_path: path,
    mime_type: file.type,
    size_bytes: file.size,
    width,
    height,
    caption,
    tags: ['carta', letterMemoryTag(slug)],
    taken_at: now.toISOString(),
    created_by: userData.user.id,
  });
  if (insertError) {
    await supabase.storage.from(BUCKET).remove([path]);
    return { ok: false, error: 'No pudimos guardar la foto. Probá de nuevo.' };
  }

  revalidatePath('/album');

  try {
    const name = (membership.display_name as string | null) ?? 'Alguien';
    await sendPushToFamily(
      familyGroupId,
      {
        title: `📸 ${name} se sacó una foto con Salu`,
        body: 'Desde la carta del Día de la Madre. Ya está en el álbum.',
        url: '/album',
        tag: `carta-${slug}`,
      },
      userData.user.id,
    );
  } catch {
    // best-effort: la foto ya quedó guardada
  }

  const { data: signed } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  return {
    ok: true,
    photo: {
      kind: 'photo',
      src: signed?.signedUrl ?? '',
      width: width ?? 1200,
      height: height ?? 1600,
      takenAt: now.toISOString(),
      alt: 'Mamá y Salu, el día de la carta.',
      ...(caption ? { caption } : {}),
    },
  };
}
