import 'server-only';

import type { createClient } from '@/lib/supabase/server';

/**
 * Crea o devuelve el álbum mensual para la fecha dada. La unicidad por
 * (family_group_id, month_key) en la tabla evita duplicados.
 */
export async function getOrCreateMonthlyAlbum(
  supabase: Awaited<ReturnType<typeof createClient>>,
  familyGroupId: string,
  childId: string | null,
  createdBy: string,
  date: Date,
): Promise<string | null> {
  // monthKey en hora AR — sin esto, una foto subida a las 23 AR (= 02
  // UTC del día siguiente) caería en el álbum del mes equivocado.
  const arParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);
  const arYear = arParts.find((p) => p.type === 'year')?.value ?? '';
  const arMonth = arParts.find((p) => p.type === 'month')?.value ?? '';
  const monthKey = `${arYear}-${arMonth}-01`;
  const monthName = date.toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
  const capitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  const { data: existing } = await supabase
    .from('albums')
    .select('id')
    .eq('family_group_id', familyGroupId)
    .eq('month_key', monthKey)
    .is('deleted_at', null)
    .maybeSingle();

  if (existing?.id) return existing.id as string;

  const { data: created, error } = await supabase
    .from('albums')
    .insert({
      family_group_id: familyGroupId,
      child_id: childId,
      name: capitalized,
      kind: 'monthly',
      month_key: monthKey,
      created_by: createdBy,
    })
    .select('id')
    .single();

  if (!error && created?.id) return created.id as string;

  // Si otra request ganó la carrera y creó el álbum entre el SELECT y el
  // INSERT, re-leemos el registro en vez de dejar las fotos sin álbum.
  const { data: raced } = await supabase
    .from('albums')
    .select('id')
    .eq('family_group_id', familyGroupId)
    .eq('month_key', monthKey)
    .is('deleted_at', null)
    .maybeSingle();

  return (raced?.id as string | undefined) ?? null;
}
