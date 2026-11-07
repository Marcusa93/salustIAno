import 'server-only';

import type { createClient } from '@/lib/supabase/server';
import { type SolidEventRow, type TastingRow, buildMeals } from './progress';
import type { Meal } from './types';

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface SolidMealsResult {
  meals: Meal[];
  /**
   * false si la tabla del detalle todavía no existe (migración sin aplicar):
   * las comidas se ven igual, con lo que traiga `foods`.
   */
  detailAvailable: boolean;
}

/** Todas las comidas sólidas del bebé, de la más vieja a la más nueva. */
export async function loadSolidMeals(
  supabase: Supabase,
  childId: string,
): Promise<SolidMealsResult> {
  const [eventsRes, tastingsRes] = await Promise.all([
    supabase
      .from('feeding_events')
      .select('id, occurred_at, foods, reaction, notes')
      .eq('child_id', childId)
      .eq('type', 'solid')
      .is('deleted_at', null)
      .order('occurred_at', { ascending: true })
      .limit(2000),
    supabase
      .from('solid_food_tastings')
      .select(
        'id, feeding_event_id, food_key, food_name, format, acceptance, amount, gagged, reaction, reaction_signs, position',
      )
      .eq('child_id', childId)
      .limit(10_000),
  ]);

  const events: SolidEventRow[] = eventsRes.data ?? [];
  const detailAvailable = !tastingsRes.error;
  const rows: TastingRow[] = tastingsRes.data ?? [];
  return { meals: buildMeals(events, rows), detailAvailable };
}
