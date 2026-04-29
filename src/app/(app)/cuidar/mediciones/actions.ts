'use server';

import { createClient } from '@/lib/supabase/server';
import { type MeasurementInput, measurementSchema } from '@/lib/validators/measurement';
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
): Partial<Record<keyof MeasurementInput | 'root', string>> {
  const fieldErrors = error.flatten().fieldErrors as Record<string, string[] | undefined>;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(fieldErrors)) {
    if (v?.[0]) out[k] = v[0];
  }
  return out as Partial<Record<keyof MeasurementInput | 'root', string>>;
}

/**
 * Crea una medición. RLS exige `is_family_admin` y `created_by =
 * auth.uid()` (ADR 0004 — datos médicos solo cargados por admins).
 */
export async function createMeasurementAction(
  input: MeasurementInput,
): Promise<ActionResult<MeasurementInput>> {
  const parsed = measurementSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: flatten(parsed.error) };
  }

  const ctx = await getActorContext();
  if ('error' in ctx) return { ok: false, errors: { root: ctx.error } };

  const { error: insertError } = await ctx.supabase.from('child_measurements').insert({
    child_id: ctx.childId,
    measured_at: parsed.data.measured_at,
    weight_grams: parsed.data.weight_grams ?? null,
    height_cm: parsed.data.height_cm ?? null,
    head_circumference_cm: parsed.data.head_circumference_cm ?? null,
    notes: emptyToNull(parsed.data.notes),
    created_by: ctx.userId,
  });

  if (insertError) {
    if (insertError.message.toLowerCase().includes('row-level security')) {
      return {
        ok: false,
        errors: { root: 'Solo los admins de la familia pueden cargar mediciones.' },
      };
    }
    return { ok: false, errors: { root: 'No pudimos guardar la medición.' } };
  }

  revalidatePath('/cuidar/mediciones');
  revalidatePath('/timeline');
  redirect('/cuidar/mediciones' as Route);
}

export async function updateMeasurementAction(
  id: string,
  input: MeasurementInput,
): Promise<ActionResult<MeasurementInput>> {
  const parsed = measurementSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: flatten(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('child_measurements')
    .update({
      measured_at: parsed.data.measured_at,
      weight_grams: parsed.data.weight_grams ?? null,
      height_cm: parsed.data.height_cm ?? null,
      head_circumference_cm: parsed.data.head_circumference_cm ?? null,
      notes: emptyToNull(parsed.data.notes),
    })
    .eq('id', id);

  if (error) {
    return { ok: false, errors: { root: 'No pudimos actualizar la medición.' } };
  }

  revalidatePath('/cuidar/mediciones');
  revalidatePath(`/cuidar/mediciones/${id}`);
  revalidatePath('/timeline');
  redirect(`/cuidar/mediciones/${id}` as Route);
}

export async function deleteMeasurementAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('child_measurements')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    return { ok: false, error: 'No pudimos borrar la medición.' };
  }

  revalidatePath('/cuidar/mediciones');
  revalidatePath('/timeline');
  redirect('/cuidar/mediciones' as Route);
}
