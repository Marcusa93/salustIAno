import 'server-only';

import { babyAgeFromBirth } from '@/lib/baby-age';
import type { DiaperRow, MilkRow } from '@/lib/solids/insights';
import { loadSolidMeals } from '@/lib/solids/load';
import { type FoodSummary, summarizeFoods } from '@/lib/solids/progress';
import type { Meal } from '@/lib/solids/types';
import { createClient } from '@/lib/supabase/server';

export interface SolidsData {
  childId: string;
  childName: string;
  firstName: string;
  birthDate: string | null;
  ageMonths: number;
  meals: Meal[];
  summaries: FoodSummary[];
  detailAvailable: boolean;
}

/** Bebé + comidas + resumen por alimento. null si no hay perfil de bebé. */
export async function loadSolidsData(): Promise<SolidsData | null> {
  const supabase = await createClient();
  const { data: child } = await supabase
    .from('child_profiles')
    .select('id, name, birth_date')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!child) return null;

  const { meals, detailAvailable } = await loadSolidMeals(supabase, child.id);
  const age = babyAgeFromBirth(child.birth_date);
  return {
    childId: child.id,
    childName: child.name,
    firstName: child.name.split(' ')[0] ?? child.name,
    birthDate: child.birth_date,
    ageMonths: age && !age.unborn ? age.months : 6,
    meals,
    summaries: summarizeFoods(meals),
    detailAvailable,
  };
}

const DAY_MS = 86_400_000;

export interface SolidsSignals {
  diapers: DiaperRow[];
  milk: MilkRow[];
}

/**
 * Pañales y tomas de leche alrededor del inicio de los sólidos (la semana
 * anterior) y de los últimos días, para comparar. Dos ventanas chicas en
 * vez de todo el historial.
 */
export async function loadSolidsSignals(
  childId: string,
  meals: readonly Meal[],
): Promise<SolidsSignals> {
  const start = meals[0]?.occurredAt;
  if (!start) return { diapers: [], milk: [] };

  const supabase = await createClient();
  const startMs = Date.parse(start);
  const windows: Array<[string, string]> = [
    [new Date(startMs - 8 * DAY_MS).toISOString(), new Date(startMs + DAY_MS).toISOString()],
    [new Date(Date.now() - 9 * DAY_MS).toISOString(), new Date().toISOString()],
  ];

  const results = await Promise.all(
    windows.flatMap(([from, to]) => [
      supabase
        .from('diaper_events')
        .select('id, occurred_at, type')
        .eq('child_id', childId)
        .is('deleted_at', null)
        .gte('occurred_at', from)
        .lte('occurred_at', to)
        .limit(500),
      supabase
        .from('feeding_events')
        .select('id, occurred_at, type, amount_ml')
        .eq('child_id', childId)
        .neq('type', 'solid')
        .is('deleted_at', null)
        .gte('occurred_at', from)
        .lte('occurred_at', to)
        .limit(500),
    ]),
  );

  // Si empezó hace pocos días las ventanas se pisan: sin duplicados.
  const diapers = new Map<string, DiaperRow>();
  const milk = new Map<string, MilkRow>();
  results.forEach((res, i) => {
    for (const row of res.data ?? []) {
      if (i % 2 === 0) diapers.set(row.id, row as DiaperRow);
      else milk.set(row.id, row as MilkRow);
    }
  });
  return { diapers: [...diapers.values()], milk: [...milk.values()] };
}

export interface MealPhoto {
  id: string;
  url: string;
}

/**
 * Fotos de esas comidas, con URL firmada por una hora. Si la columna
 * feeding_event_id todavía no existe (migración sin aplicar), no hay fotos.
 */
export async function loadMealPhotos(
  mealIds: readonly string[],
): Promise<Map<string, MealPhoto[]>> {
  const byMeal = new Map<string, MealPhoto[]>();
  if (mealIds.length === 0) return byMeal;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('media_items')
    .select('id, storage_path, feeding_event_id')
    .in('feeding_event_id', [...mealIds])
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(100);
  if (error || !data || data.length === 0) return byMeal;

  const { data: signed } = await supabase.storage.from('photos').createSignedUrls(
    data.map((r) => r.storage_path),
    3600,
  );
  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  for (const r of data) {
    const url = urlByPath.get(r.storage_path);
    if (!r.feeding_event_id || !url) continue;
    const list = byMeal.get(r.feeding_event_id) ?? [];
    list.push({ id: r.id, url });
    byMeal.set(r.feeding_event_id, list);
  }
  return byMeal;
}
