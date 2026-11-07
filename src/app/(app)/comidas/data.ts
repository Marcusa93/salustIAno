import 'server-only';

import { babyAgeFromBirth } from '@/lib/baby-age';
import { loadSolidMeals } from '@/lib/solids/load';
import { type FoodSummary, summarizeFoods } from '@/lib/solids/progress';
import type { Meal } from '@/lib/solids/types';
import { createClient } from '@/lib/supabase/server';

export interface SolidsData {
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
    childName: child.name,
    firstName: child.name.split(' ')[0] ?? child.name,
    birthDate: child.birth_date,
    ageMonths: age && !age.unborn ? age.months : 6,
    meals,
    summaries: summarizeFoods(meals),
    detailAvailable,
  };
}
