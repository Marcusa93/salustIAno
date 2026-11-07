'use server';

import { maxReaction } from '@/lib/solids/progress';
import { createClient } from '@/lib/supabase/server';
import { type SolidMealInput, solidMealSchema } from '@/lib/validators/solid-meal';
import { revalidatePath } from 'next/cache';

export type SaveSolidMealResult =
  | {
      ok: true;
      id: string;
      /** false si la comida quedó, pero el detalle por alimento no (migración sin aplicar). */
      detailSaved: boolean;
      /** Alimentos que probó por primera vez en esta comida. */
      firstTimes: string[];
    }
  | { ok: false; error: string };

async function getActor() {
  const supabase = await createClient();
  const { data: userData, error } = await supabase.auth.getUser();
  if (error || !userData.user) return { error: 'Sesión expirada.' as const };

  const { data: child } = await supabase
    .from('child_profiles')
    .select('id')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!child) return { error: 'Todavía no tenés un perfil de bebé creado.' as const };

  return { supabase, userId: userData.user.id, childId: child.id as string };
}

/**
 * Crea o edita una comida sólida: el feeding_events (para que aparezca en
 * todo lo demás) y una fila por alimento con cómo le fue.
 */
export async function saveSolidMealAction(
  input: SolidMealInput,
  mealId?: string,
): Promise<SaveSolidMealResult> {
  const parsed = solidMealSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Revisá los datos.' };
  }
  const actor = await getActor();
  if ('error' in actor) return { ok: false, error: actor.error ?? 'Sin sesión.' };
  const { supabase, userId, childId } = actor;
  const data = parsed.data;

  const mealFields = {
    occurred_at: new Date(data.occurred_at).toISOString(),
    foods: data.tastings.map((t) => t.food_name),
    reaction: maxReaction(data.tastings.map((t) => t.reaction)),
    notes: data.notes ? data.notes : null,
  };

  let id: string;
  if (mealId) {
    const { data: updated, error } = await supabase
      .from('feeding_events')
      .update(mealFields)
      .eq('id', mealId)
      .eq('child_id', childId)
      .eq('type', 'solid')
      .is('deleted_at', null)
      .select('id')
      .maybeSingle();
    if (error || !updated) return { ok: false, error: 'No pudimos guardar los cambios.' };
    id = updated.id;
  } else {
    const { data: created, error } = await supabase
      .from('feeding_events')
      .insert({ ...mealFields, child_id: childId, type: 'solid', created_by: userId })
      .select('id')
      .single();
    if (error || !created) return { ok: false, error: 'No pudimos guardar la comida.' };
    id = created.id;
  }

  const keys = [...new Set(data.tastings.map((t) => t.food_key))];
  const [prior, previousRows] = await Promise.all([
    supabase
      .from('solid_food_tastings')
      .select('food_key')
      .eq('child_id', childId)
      .in('food_key', keys)
      .neq('feeding_event_id', id),
    mealId
      ? supabase.from('solid_food_tastings').select('id').eq('feeding_event_id', id)
      : Promise.resolve({ data: [] as { id: string }[], error: null }),
  ]);

  // Primero insertamos lo nuevo y recién después borramos lo viejo: si algo
  // falla en el medio, la comida no se queda sin alimentos.
  const { error: insertError } = await supabase.from('solid_food_tastings').insert(
    data.tastings.map((t, position) => ({
      feeding_event_id: id,
      child_id: childId,
      food_key: t.food_key,
      food_name: t.food_name,
      format: t.format,
      acceptance: t.acceptance,
      amount: t.amount,
      gagged: t.gagged,
      reaction: t.reaction,
      reaction_signs: t.reaction !== 'none' ? t.reaction_signs : [],
      position,
      created_by: userId,
    })),
  );
  const detailSaved = !insertError;
  const oldIds = (previousRows.data ?? []).map((r) => r.id);
  if (detailSaved && oldIds.length > 0) {
    await supabase.from('solid_food_tastings').delete().in('id', oldIds);
  }

  let firstTimes: string[] = [];
  if (detailSaved && !prior.error) {
    const seen = new Set((prior.data ?? []).map((r) => r.food_key));
    firstTimes = [
      ...new Set(data.tastings.filter((t) => !seen.has(t.food_key)).map((t) => t.food_name)),
    ];
  }

  revalidatePath('/comidas');
  revalidatePath('/home');
  revalidatePath('/timeline');
  return { ok: true, id, detailSaved, firstTimes };
}
