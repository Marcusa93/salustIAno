'use server';

import { createClient } from '@/lib/supabase/server';
import {
  type BloodType,
  type ChildProfileInput,
  childProfileSchema,
} from '@/lib/validators/child-profile';
import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

type ActionResult<TInput> =
  | { ok: true }
  | { ok: false; errors: Partial<Record<keyof TInput | 'root', string>> };

function emptyToNull<T>(value: T | undefined | ''): T | null {
  if (value === undefined || value === '') return null;
  return value as T;
}

interface DbInsertPayload {
  family_group_id: string;
  name: string;
  birth_date: string | null;
  birth_time: string | null;
  birth_place: string | null;
  birth_weight_grams: number | null;
  birth_height_cm: number | null;
  gestational_weeks_at_birth: number | null;
  pediatrician_name: string | null;
  pediatrician_phone: string | null;
  health_insurance: string | null;
  blood_type: BloodType | null;
  notes: string | null;
  created_by: string;
}

interface DbUpdatePayload extends Omit<DbInsertPayload, 'family_group_id' | 'created_by'> {}

function toDbPayload(
  parsed: ChildProfileInput,
): Omit<DbInsertPayload, 'family_group_id' | 'created_by'> {
  return {
    name: parsed.name,
    birth_date: emptyToNull(parsed.birth_date),
    birth_time: emptyToNull(parsed.birth_time),
    birth_place: emptyToNull(parsed.birth_place),
    birth_weight_grams: parsed.birth_weight_grams ?? null,
    birth_height_cm: parsed.birth_height_cm ?? null,
    gestational_weeks_at_birth: parsed.gestational_weeks_at_birth ?? null,
    pediatrician_name: emptyToNull(parsed.pediatrician_name),
    pediatrician_phone: emptyToNull(parsed.pediatrician_phone),
    health_insurance: emptyToNull(parsed.health_insurance),
    blood_type: emptyToNull(parsed.blood_type) as BloodType | null,
    notes: emptyToNull(parsed.notes),
  };
}

/**
 * Crea un perfil de bebé. RLS exige `is_family_admin(family_group_id)`
 * (ADR 0004 — los admins son los únicos que cargan perfil del niño y datos
 * médicos sensibles).
 */
export async function createChildAction(
  input: ChildProfileInput,
): Promise<ActionResult<ChildProfileInput>> {
  const parsed = childProfileSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      ok: false,
      errors: Object.fromEntries(
        Object.entries(fieldErrors).map(([k, v]) => [k, v?.[0]]),
      ) as Partial<Record<keyof ChildProfileInput, string>>,
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
    return { ok: false, errors: { root: 'No pudimos resolver tu familia.' } };
  }

  const payload: DbInsertPayload = {
    family_group_id: memberships[0].family_group_id,
    created_by: userData.user.id,
    ...toDbPayload(parsed.data),
  };

  const { data: created, error: insertError } = await supabase
    .from('child_profiles')
    .insert(payload)
    .select('id')
    .single();

  if (insertError || !created) {
    if (insertError?.message.toLowerCase().includes('row-level security')) {
      return {
        ok: false,
        errors: { root: 'Solo los admins de la familia pueden crear el perfil del bebé.' },
      };
    }
    return { ok: false, errors: { root: 'No pudimos guardar el perfil. Probá de nuevo.' } };
  }

  revalidatePath('/familia');
  redirect(`/familia/bebe/${created.id}` as Route);
}

export async function updateChildAction(
  id: string,
  input: ChildProfileInput,
): Promise<ActionResult<ChildProfileInput>> {
  const parsed = childProfileSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      ok: false,
      errors: Object.fromEntries(
        Object.entries(fieldErrors).map(([k, v]) => [k, v?.[0]]),
      ) as Partial<Record<keyof ChildProfileInput, string>>,
    };
  }

  const supabase = await createClient();
  const update: DbUpdatePayload = toDbPayload(parsed.data);
  const { error } = await supabase.from('child_profiles').update(update).eq('id', id);

  if (error) {
    return { ok: false, errors: { root: 'No pudimos guardar los cambios.' } };
  }

  revalidatePath('/familia');
  revalidatePath(`/familia/bebe/${id}`);
  redirect(`/familia/bebe/${id}` as Route);
}

export async function deleteChildAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('child_profiles')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    return { ok: false, error: 'No pudimos borrar el perfil.' };
  }

  revalidatePath('/familia');
  redirect('/familia' as Route);
}
