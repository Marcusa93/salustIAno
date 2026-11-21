import 'server-only';

import type { Database } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';
import { type DailyCourse, type DailyDoseRow, buildDailyCourses } from './daily';

type Supabase = SupabaseClient<Database>;

/** Alcanza para ver el inicio de un tratamiento de un mes y medio. */
const LOOKBACK_DAYS = 45;

export interface MedicationDosesResult {
  /** Dosis de los últimos 45 días, de la más nueva a la más vieja. */
  doses: DailyDoseRow[];
  courses: DailyCourse[];
}

export async function loadMedicationDoses(
  supabase: Supabase,
  childId: string,
  now: Date = new Date(),
): Promise<MedicationDosesResult> {
  const since = new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from('medication_doses')
    .select(
      'id, medication_name, dose_amount, given_at, interval_hours, next_dose_at, created_by, notes',
    )
    .eq('child_id', childId)
    .is('deleted_at', null)
    .gte('given_at', since)
    .order('given_at', { ascending: false })
    .limit(500);

  if (error || !data) return { doses: [], courses: [] };
  return { doses: data, courses: buildDailyCourses(data, now) };
}

/** Nombre visible de cada miembro de la familia (user_id → display_name). */
export async function loadMemberNames(supabase: Supabase): Promise<Map<string, string>> {
  const { data } = await supabase
    .from('family_memberships')
    .select('user_id, display_name')
    .is('deleted_at', null);
  const names = new Map<string, string>();
  for (const row of data ?? []) {
    const name = row.display_name?.trim();
    if (name) names.set(row.user_id, name);
  }
  return names;
}
