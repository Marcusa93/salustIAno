'use server';

import { createClient } from '@/lib/supabase/server';
import {
  type DiaperEventInput,
  type FeedingEventInput,
  type SleepSessionInput,
  diaperEventSchema,
  feedingEventSchema,
  sleepSessionSchema,
} from '@/lib/validators/events';
import { revalidatePath } from 'next/cache';

type EventResult<TInput> =
  | { ok: true; id: string }
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
    .select('id, family_group_id')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (childError || !child) {
    return { error: 'Todavía no tenés un perfil de bebé creado.' as const };
  }

  return { supabase, userId: userData.user.id, childId: child.id };
}

function flatten<T>(error: import('zod').ZodError): Partial<Record<keyof T | 'root', string>> {
  const fieldErrors = error.flatten().fieldErrors as Record<string, string[] | undefined>;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(fieldErrors)) {
    if (v?.[0]) out[k] = v[0];
  }
  return out as Partial<Record<keyof T | 'root', string>>;
}

// ============================================================================
// Sleep
// ============================================================================

export async function createSleepAction(
  input: SleepSessionInput,
): Promise<EventResult<SleepSessionInput>> {
  const parsed = sleepSessionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: flatten<SleepSessionInput>(parsed.error) };
  }

  const ctx = await getActorContext();
  if ('error' in ctx) return { ok: false, errors: { root: ctx.error } };

  const { data, error } = await ctx.supabase
    .from('sleep_sessions')
    .insert({
      child_id: ctx.childId,
      started_at: parsed.data.started_at,
      ended_at: emptyToNull(parsed.data.ended_at),
      quality: parsed.data.quality,
      is_nap: parsed.data.is_nap,
      notes: emptyToNull(parsed.data.notes),
      created_by: ctx.userId,
    })
    .select('id')
    .single();

  if (error || !data) {
    return { ok: false, errors: { root: 'No pudimos guardar el sueño.' } };
  }

  revalidatePath('/home');
  revalidatePath('/timeline');
  return { ok: true, id: data.id };
}

// ============================================================================
// Feeding
// ============================================================================

export async function createFeedingAction(
  input: FeedingEventInput,
): Promise<EventResult<FeedingEventInput>> {
  const parsed = feedingEventSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: flatten<FeedingEventInput>(parsed.error) };
  }

  const ctx = await getActorContext();
  if ('error' in ctx) return { ok: false, errors: { root: ctx.error } };

  const { data, error } = await ctx.supabase
    .from('feeding_events')
    .insert({
      child_id: ctx.childId,
      occurred_at: parsed.data.occurred_at,
      type: parsed.data.type,
      side: emptyToNull(parsed.data.side),
      duration_minutes: parsed.data.duration_minutes ?? null,
      amount_ml: parsed.data.amount_ml ?? null,
      foods: parsed.data.foods && parsed.data.foods.length > 0 ? parsed.data.foods : null,
      reaction: parsed.data.reaction,
      notes: emptyToNull(parsed.data.notes),
      created_by: ctx.userId,
    })
    .select('id')
    .single();

  if (error || !data) {
    return { ok: false, errors: { root: 'No pudimos guardar la toma.' } };
  }

  revalidatePath('/home');
  revalidatePath('/timeline');
  return { ok: true, id: data.id };
}

// ============================================================================
// Diaper
// ============================================================================

export async function createDiaperAction(
  input: DiaperEventInput,
): Promise<EventResult<DiaperEventInput>> {
  const parsed = diaperEventSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: flatten<DiaperEventInput>(parsed.error) };
  }

  const ctx = await getActorContext();
  if ('error' in ctx) return { ok: false, errors: { root: ctx.error } };

  const { data, error } = await ctx.supabase
    .from('diaper_events')
    .insert({
      child_id: ctx.childId,
      occurred_at: parsed.data.occurred_at,
      type: parsed.data.type,
      notes: emptyToNull(parsed.data.notes),
      created_by: ctx.userId,
    })
    .select('id')
    .single();

  if (error || !data) {
    return { ok: false, errors: { root: 'No pudimos guardar el pañal.' } };
  }

  revalidatePath('/home');
  revalidatePath('/timeline');
  return { ok: true, id: data.id };
}

// ============================================================================
// Delete (genérico — recibe table name + id, RLS controla quién puede)
// ============================================================================

const ALLOWED_TABLES = ['sleep_sessions', 'feeding_events', 'diaper_events'] as const;

type EventTable = (typeof ALLOWED_TABLES)[number];

export async function deleteEventAction(
  table: EventTable,
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!ALLOWED_TABLES.includes(table)) {
    return { ok: false, error: 'Tabla no permitida.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from(table)
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    return { ok: false, error: 'No pudimos borrar el evento.' };
  }

  revalidatePath('/home');
  revalidatePath('/timeline');
  return { ok: true };
}
