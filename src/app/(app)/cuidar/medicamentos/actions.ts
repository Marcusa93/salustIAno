'use server';

import { createClient } from '@/lib/supabase/server';
import { type MedicationDoseInput, medicationDoseSchema } from '@/lib/validators/medication';
import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

type ActionResult<TInput> =
  | { ok: true }
  | { ok: false; errors: Partial<Record<keyof TInput | 'root', string>> };

function emptyToNull<T>(v: T | undefined | ''): T | null {
  if (v === undefined || v === '') return null;
  return v as T;
}

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

function flatten(
  error: import('zod').ZodError,
): Partial<Record<keyof MedicationDoseInput | 'root', string>> {
  const fieldErrors = error.flatten().fieldErrors as Record<string, string[] | undefined>;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(fieldErrors)) {
    if (v?.[0]) out[k] = v[0];
  }
  return out as Partial<Record<keyof MedicationDoseInput | 'root', string>>;
}

export async function createMedicationDoseAction(
  input: MedicationDoseInput,
): Promise<ActionResult<MedicationDoseInput>> {
  const parsed = medicationDoseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: flatten(parsed.error) };
  }

  const ctx = await getActorContext();
  if ('error' in ctx) return { ok: false, errors: { root: ctx.error } };

  const givenAt = new Date(parsed.data.given_at);
  const nextDoseAt =
    parsed.data.interval_hours != null
      ? new Date(givenAt.getTime() + parsed.data.interval_hours * 60 * 60 * 1000)
      : null;

  // biome-ignore lint/suspicious/noExplicitAny: medication_doses falta en types/database.ts (regenerar Supabase types resolvería).
  const { error: insertError } = await (ctx.supabase as any).from('medication_doses').insert({
    child_id: ctx.childId,
    medication_name: parsed.data.medication_name.trim(),
    dose_amount: emptyToNull(parsed.data.dose_amount),
    given_at: givenAt.toISOString(),
    interval_hours: parsed.data.interval_hours ?? null,
    next_dose_at: nextDoseAt?.toISOString() ?? null,
    notes: emptyToNull(parsed.data.notes),
    created_by: ctx.userId,
  });

  if (insertError) {
    return { ok: false, errors: { root: 'No pudimos guardar la dosis.' } };
  }

  revalidatePath('/cuidar/medicamentos');
  revalidatePath('/cuidar');
  redirect('/cuidar/medicamentos' as Route);
}

export async function deleteMedicationDoseAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();

  // biome-ignore lint/suspicious/noExplicitAny: medication_doses falta en types/database.ts (regenerar Supabase types resolvería).
  const { error } = await (supabase as any)
    .from('medication_doses')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    return { ok: false, error: 'No pudimos borrar la dosis.' };
  }

  revalidatePath('/cuidar/medicamentos');
  revalidatePath('/cuidar');
  redirect('/cuidar/medicamentos' as Route);
}
