'use server';

import { startOfTodayAr } from '@/lib/format-ar';
import { createClient } from '@/lib/supabase/server';

export interface MemberActivity {
  userId: string;
  displayName: string | null;
  role: 'admin' | 'caregiver' | 'family' | 'viewer' | null;
  isSelf: boolean;
  counts: {
    feeding: number;
    sleep: number;
    diaper: number;
    note: number;
    total: number;
  };
}

/**
 * Devuelve qué hizo cada miembro de la familia HOY: cuántas tomas, sueños,
 * pañales y notas registró cada uno. Pensado para mostrar en /home como
 * card "Hoy en familia". Sirve como reconocimiento de quién está presente.
 */
export async function getTodayActivityByMemberAction(): Promise<MemberActivity[]> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];

  const { data: child } = await supabase
    .from('child_profiles')
    .select('id')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!child) return [];

  // Medianoche en hora AR (no UTC del runtime).
  const todayStart = startOfTodayAr();
  const todayIso = todayStart.toISOString();

  const [
    { data: feedingRows },
    { data: sleepRows },
    { data: diaperRows },
    { data: noteRows },
    { data: members },
  ] = await Promise.all([
    supabase
      .from('feeding_events')
      .select('created_by')
      .eq('child_id', child.id)
      .is('deleted_at', null)
      .gte('occurred_at', todayIso),
    supabase
      .from('sleep_sessions')
      .select('created_by')
      .eq('child_id', child.id)
      .is('deleted_at', null)
      .gte('started_at', todayIso),
    supabase
      .from('diaper_events')
      .select('created_by')
      .eq('child_id', child.id)
      .is('deleted_at', null)
      .gte('occurred_at', todayIso),
    supabase
      .from('notes')
      .select('created_by')
      .eq('child_id', child.id)
      .is('deleted_at', null)
      .gte('created_at', todayIso),
    supabase
      .from('family_memberships')
      .select('user_id, display_name, role')
      .is('deleted_at', null),
  ]);

  // Index de membership por user_id.
  const memberByUserId = new Map<
    string,
    { displayName: string | null; role: MemberActivity['role'] }
  >();
  for (const m of (members ?? []) as Array<{
    user_id: string;
    display_name: string | null;
    role: MemberActivity['role'];
  }>) {
    memberByUserId.set(m.user_id, { displayName: m.display_name, role: m.role });
  }

  // Aggregator por user_id.
  const acc = new Map<
    string,
    {
      feeding: number;
      sleep: number;
      diaper: number;
      note: number;
    }
  >();

  function bump(userId: string | null | undefined, kind: 'feeding' | 'sleep' | 'diaper' | 'note') {
    if (!userId) return;
    let bucket = acc.get(userId);
    if (!bucket) {
      bucket = { feeding: 0, sleep: 0, diaper: 0, note: 0 };
      acc.set(userId, bucket);
    }
    bucket[kind] += 1;
  }

  for (const r of (feedingRows ?? []) as Array<{ created_by: string | null }>)
    bump(r.created_by, 'feeding');
  for (const r of (sleepRows ?? []) as Array<{ created_by: string | null }>)
    bump(r.created_by, 'sleep');
  for (const r of (diaperRows ?? []) as Array<{ created_by: string | null }>)
    bump(r.created_by, 'diaper');
  for (const r of (noteRows ?? []) as Array<{ created_by: string | null }>)
    bump(r.created_by, 'note');

  const result: MemberActivity[] = [];
  for (const [userId, counts] of acc.entries()) {
    const member = memberByUserId.get(userId);
    const total = counts.feeding + counts.sleep + counts.diaper + counts.note;
    if (total === 0) continue;
    result.push({
      userId,
      displayName: member?.displayName ?? null,
      role: member?.role ?? null,
      isSelf: userId === userData.user.id,
      counts: { ...counts, total },
    });
  }

  // Ordenamos por total desc, después por nombre.
  result.sort((a, b) => {
    if (b.counts.total !== a.counts.total) return b.counts.total - a.counts.total;
    return (a.displayName ?? '').localeCompare(b.displayName ?? '');
  });

  return result;
}
