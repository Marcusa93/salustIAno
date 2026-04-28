'use server';

import { createClient } from '@/lib/supabase/server';
import {
  type MilestoneCreateInput,
  type MilestoneUpdateInput,
  milestoneCreateSchema,
  milestoneUpdateSchema,
} from '@/lib/validators/milestone';
import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

type ActionResult<TInput> =
  | { ok: true }
  | { ok: false; errors: Partial<Record<keyof TInput | 'root', string>> };

function emptyToNull(value: string | undefined): string | null {
  return value && value.length > 0 ? value : null;
}

/**
 * Crea un hito médico nuevo.
 *
 * RLS exige `is_family_admin(family_group_id)` y `created_by = auth.uid()`.
 * Resolvemos `family_group_id` server-side leyendo la primera membership
 * activa del user (asumimos una familia por user en el MVP).
 */
export async function createMilestoneAction(
  input: MilestoneCreateInput,
): Promise<ActionResult<MilestoneCreateInput>> {
  const parsed = milestoneCreateSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      ok: false,
      errors: {
        title: fieldErrors.title?.[0],
        category: fieldErrors.category?.[0],
        description: fieldErrors.description?.[0],
        due_at: fieldErrors.due_at?.[0],
        notes: fieldErrors.notes?.[0],
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

  if (mErr || !memberships?.[0]?.family_group_id) {
    return {
      ok: false,
      errors: { root: 'No pudimos resolver tu familia. Probá de nuevo.' },
    };
  }

  const { error: insertError } = await supabase.from('medical_milestones').insert({
    family_group_id: memberships[0].family_group_id,
    title: parsed.data.title,
    category: parsed.data.category,
    description: emptyToNull(parsed.data.description),
    due_at: emptyToNull(parsed.data.due_at),
    notes: emptyToNull(parsed.data.notes),
    created_by: userData.user.id,
  });

  if (insertError) {
    if (insertError.message.toLowerCase().includes('row-level security')) {
      return {
        ok: false,
        errors: {
          root: 'Solo los admins de la familia pueden cargar hitos médicos.',
        },
      };
    }
    return { ok: false, errors: { root: 'No pudimos guardar el hito. Probá de nuevo.' } };
  }

  revalidatePath('/cuidar/calendario');
  redirect('/cuidar/calendario' as Route);
}

export async function updateMilestoneAction(
  id: string,
  input: MilestoneUpdateInput,
): Promise<ActionResult<MilestoneUpdateInput>> {
  const parsed = milestoneUpdateSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      ok: false,
      errors: {
        title: fieldErrors.title?.[0],
        category: fieldErrors.category?.[0],
        description: fieldErrors.description?.[0],
        due_at: fieldErrors.due_at?.[0],
        notes: fieldErrors.notes?.[0],
      },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('medical_milestones')
    .update({
      title: parsed.data.title,
      category: parsed.data.category,
      description: emptyToNull(parsed.data.description),
      due_at: emptyToNull(parsed.data.due_at),
      notes: emptyToNull(parsed.data.notes),
    })
    .eq('id', id);

  if (error) {
    return { ok: false, errors: { root: 'No pudimos actualizar el hito.' } };
  }

  revalidatePath('/cuidar/calendario');
  revalidatePath(`/cuidar/calendario/${id}`);
  redirect(`/cuidar/calendario/${id}` as Route);
}

/**
 * Marca un hito como completado o lo regresa a pendiente.
 */
export async function toggleMilestoneCompletedAction(
  id: string,
  completed: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('medical_milestones')
    .update({ completed_at: completed ? new Date().toISOString() : null })
    .eq('id', id);

  if (error) {
    return { ok: false, error: 'No pudimos actualizar el estado del hito.' };
  }

  revalidatePath('/cuidar/calendario');
  revalidatePath(`/cuidar/calendario/${id}`);
  return { ok: true };
}

export async function deleteMilestoneAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('medical_milestones')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    return { ok: false, error: 'No pudimos borrar el hito.' };
  }

  revalidatePath('/cuidar/calendario');
  redirect('/cuidar/calendario' as Route);
}
