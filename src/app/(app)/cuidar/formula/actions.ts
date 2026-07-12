'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { sendPushToFamily } from '../../perfil/push-actions';

// ─── helpers ──────────────────────────────────────────────────────────────────

async function getActorContext() {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return { error: 'Sesión expirada.' as const };

  const { data: child } = await supabase
    .from('child_profiles')
    .select('id')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!child) return { error: 'Todavía no tenés un perfil de bebé creado.' as const };

  const { data: membership } = await supabase
    .from('family_memberships')
    .select('family_group_id')
    .eq('user_id', userData.user.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!membership) return { error: 'No pertenecés a ningún grupo familiar.' as const };

  return {
    supabase,
    userId: userData.user.id,
    childId: child.id,
    familyGroupId: membership.family_group_id,
  };
}

// ─── tipos ────────────────────────────────────────────────────────────────────

export interface FormulaStockRow {
  id: string;
  current_boxes: number;
  alert_threshold: number;
  ml_per_box: number;
  brand: string | null;
  updated_at: string;
}

// ─── actions ──────────────────────────────────────────────────────────────────

/** Devuelve el stock actual del bebé. Si no hay fila aún, devuelve null. */
export async function getFormulaStockAction(): Promise<
  { ok: true; stock: FormulaStockRow | null } | { ok: false; error: string }
> {
  const ctx = await getActorContext();
  if ('error' in ctx) return { ok: false, error: ctx.error ?? 'Error.' };

  const { data, error } = await ctx.supabase
    .from('formula_stock')
    .select('id, current_boxes, alert_threshold, ml_per_box, brand, updated_at')
    .eq('child_id', ctx.childId)
    .maybeSingle();

  if (error) return { ok: false, error: 'Error al leer el stock.' };

  return { ok: true, stock: data };
}

const adjustSchema = z.object({
  delta: z.number().int(),
});

/**
 * Ajusta el stock sumando o restando `delta` cajas.
 * El resultado se clampea a 0 (no puede ser negativo).
 * Si el stock cae por debajo del umbral, envía push a toda la familia.
 */
export async function adjustFormulaStockAction(
  delta: number,
): Promise<{ ok: true; current_boxes: number } | { ok: false; error: string }> {
  const parsed = adjustSchema.safeParse({ delta });
  if (!parsed.success) return { ok: false, error: 'Cantidad inválida.' };

  const ctx = await getActorContext();
  if ('error' in ctx) return { ok: false, error: ctx.error ?? 'Error.' };

  const { data: existing } = await ctx.supabase
    .from('formula_stock')
    .select('id, current_boxes, alert_threshold, family_group_id')
    .eq('child_id', ctx.childId)
    .maybeSingle();

  if (!existing) {
    return { ok: false, error: 'Configurá el stock primero desde los ajustes.' };
  }

  const newBoxes = Math.max(0, existing.current_boxes + parsed.data.delta);

  const { error: updateError } = await ctx.supabase
    .from('formula_stock')
    .update({
      current_boxes: newBoxes,
      updated_by: ctx.userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', existing.id);

  if (updateError) return { ok: false, error: 'No pudimos actualizar el stock.' };

  // Notificación push cuando el stock cae al umbral o por debajo
  const wasAbove = existing.current_boxes > existing.alert_threshold;
  const nowAtOrBelow = newBoxes <= existing.alert_threshold;
  if (wasAbove && nowAtOrBelow) {
    const adminSupabase = createAdminClient();
    const { data: familyData } = await adminSupabase
      .from('family_groups')
      .select('name')
      .eq('id', existing.family_group_id)
      .maybeSingle();

    await sendPushToFamily(existing.family_group_id, {
      title: 'Stock de fórmula bajo',
      body: `Quedan ${newBoxes} caja${newBoxes === 1 ? '' : 's'} de fórmula${familyData?.name ? ` de ${familyData.name}` : ''}. ¡Es hora de comprar!`,
      url: '/cuidar/formula',
      tag: 'formula-low-stock',
    });
  }

  revalidatePath('/cuidar/formula');
  revalidatePath('/cuidar');
  return { ok: true, current_boxes: newBoxes };
}

const settingsSchema = z.object({
  alert_threshold: z.number().int().min(0).max(999),
  ml_per_box: z.number().int().min(1).max(9999),
  brand: z.string().max(100).optional(),
  current_boxes: z.number().int().min(0).max(9999).optional(),
});

export type FormulaSettingsInput = z.infer<typeof settingsSchema>;

/** Upsert de configuración + stock inicial. */
export async function saveFormulaSettingsAction(
  input: FormulaSettingsInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? 'Datos inválidos.';
    return { ok: false, error: first };
  }

  const ctx = await getActorContext();
  if ('error' in ctx) return { ok: false, error: ctx.error ?? 'Error.' };

  const { data: existing } = await ctx.supabase
    .from('formula_stock')
    .select('id, current_boxes')
    .eq('child_id', ctx.childId)
    .maybeSingle();

  const now = new Date().toISOString();

  if (existing) {
    const { error } = await ctx.supabase
      .from('formula_stock')
      .update({
        alert_threshold: parsed.data.alert_threshold,
        ml_per_box: parsed.data.ml_per_box,
        brand: parsed.data.brand ?? null,
        ...(parsed.data.current_boxes !== undefined
          ? { current_boxes: parsed.data.current_boxes }
          : {}),
        updated_by: ctx.userId,
        updated_at: now,
      })
      .eq('id', existing.id);

    if (error) return { ok: false, error: 'No pudimos guardar la configuración.' };
  } else {
    const { error } = await ctx.supabase.from('formula_stock').insert({
      family_group_id: ctx.familyGroupId,
      child_id: ctx.childId,
      alert_threshold: parsed.data.alert_threshold,
      ml_per_box: parsed.data.ml_per_box,
      brand: parsed.data.brand ?? null,
      current_boxes: parsed.data.current_boxes ?? 0,
      updated_by: ctx.userId,
      created_at: now,
      updated_at: now,
    });

    if (error) return { ok: false, error: 'No pudimos guardar la configuración.' };
  }

  revalidatePath('/cuidar/formula');
  revalidatePath('/cuidar');
  return { ok: true };
}
