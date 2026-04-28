'use server';

import { createClient } from '@/lib/supabase/server';
import {
  type CareGuideCreateInput,
  type CareGuideUpdateInput,
  careGuideCreateSchema,
  careGuideUpdateSchema,
} from '@/lib/validators/care-guide';
import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

type ActionResult<TInput> =
  | { ok: true }
  | { ok: false; errors: Partial<Record<keyof TInput | 'root', string>> };

/**
 * Crea una entrada nueva en `care_guides`.
 *
 * RLS exige que `created_by = auth.uid()` y que el user sea miembro del
 * `family_group_id`. Resolvemos `family_group_id` server-side leyendo la
 * primera membership activa del user (asumimos una familia por user en
 * este MVP; si en el futuro hay multifamilia, sumamos un selector).
 *
 * En éxito: revalida `/cuidar/guia` y redirige al listado.
 */
export async function createCareGuideAction(
  input: CareGuideCreateInput,
): Promise<ActionResult<CareGuideCreateInput>> {
  const parsed = careGuideCreateSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      ok: false,
      errors: {
        title: fieldErrors.title?.[0],
        category: fieldErrors.category?.[0],
        content: fieldErrors.content?.[0],
        source: fieldErrors.source?.[0],
      },
    };
  }

  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { ok: false, errors: { root: 'Sesión expirada. Probá entrar de nuevo.' } };
  }

  const { data: memberships, error: mErr } = await supabase
    .from('family_memberships')
    .select('family_group_id')
    .eq('user_id', userData.user.id)
    .is('deleted_at', null)
    .limit(1);

  if (mErr) {
    return { ok: false, errors: { root: 'No pudimos resolver tu familia. Probá de nuevo.' } };
  }

  const familyGroupId = memberships?.[0]?.family_group_id;
  if (!familyGroupId) {
    return {
      ok: false,
      errors: {
        root: 'Tu cuenta todavía no tiene una familia asociada. Avisanos si esto no se resuelve.',
      },
    };
  }

  const { error: insertError } = await supabase.from('care_guides').insert({
    family_group_id: familyGroupId,
    category: parsed.data.category,
    title: parsed.data.title,
    content: parsed.data.content,
    source: parsed.data.source && parsed.data.source.length > 0 ? parsed.data.source : null,
    created_by: userData.user.id,
  });

  if (insertError) {
    return { ok: false, errors: { root: 'No pudimos guardar la entrada. Probá de nuevo.' } };
  }

  revalidatePath('/cuidar/guia');
  redirect('/cuidar/guia' as Route);
}

/**
 * Actualiza una entrada existente. RLS controla que el user sea autor o
 * admin de la familia.
 */
export async function updateCareGuideAction(
  id: string,
  input: CareGuideUpdateInput,
): Promise<ActionResult<CareGuideUpdateInput>> {
  const parsed = careGuideUpdateSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      ok: false,
      errors: {
        title: fieldErrors.title?.[0],
        category: fieldErrors.category?.[0],
        content: fieldErrors.content?.[0],
        source: fieldErrors.source?.[0],
      },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('care_guides')
    .update({
      title: parsed.data.title,
      category: parsed.data.category,
      content: parsed.data.content,
      source: parsed.data.source && parsed.data.source.length > 0 ? parsed.data.source : null,
    })
    .eq('id', id);

  if (error) {
    return { ok: false, errors: { root: 'No pudimos actualizar la entrada.' } };
  }

  revalidatePath('/cuidar/guia');
  revalidatePath(`/cuidar/guia/${id}`);
  redirect(`/cuidar/guia/${id}` as Route);
}

/**
 * Borrado lógico. RLS controla que sea autor o admin.
 */
export async function deleteCareGuideAction(id: string): Promise<ActionResult<never>> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('care_guides')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    return { ok: false, errors: { root: 'No pudimos borrar la entrada.' } };
  }

  revalidatePath('/cuidar/guia');
  redirect('/cuidar/guia' as Route);
}
