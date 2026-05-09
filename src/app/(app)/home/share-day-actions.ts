'use server';

import { formatDateAr, formatTimeAr } from '@/lib/format-ar';
import { createClient } from '@/lib/supabase/server';

export interface DayShareSnapshot {
  /** Texto compacto listo para mandar por WhatsApp / Telegram. */
  text: string;
  /** URL firmada de la foto más reciente del día (1h de validez). */
  photoUrl: string | null;
  /** Path de la foto en Storage — para reuso si la UI necesita re-firmar. */
  photoPath: string | null;
  /** Hora del día en que se generó (AR), por si la UI quiere mostrar
   * "actualizado a las HH:MM". */
  generatedAtAr: string;
}

const PHOTOS_BUCKET = 'photos';

/**
 * Arma el "compartir el día" — texto cariñoso del estado actual del bebé
 * + la foto más reciente subida hoy (si existe). Se usa en la
 * `ShareDayCard` del home, que muestra preview y dispara Web Share.
 *
 * El texto NO incluye nombres ni contenido sensible; solo conteos y
 * horas totales. La foto va siempre como signed URL (1h) — la familia
 * extendida no tiene login, recibe el link directo.
 */
export async function getDayShareSnapshotAction(): Promise<DayShareSnapshot | null> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const { data: child } = await supabase
    .from('child_profiles')
    .select('id, name')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!child) return null;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();

  const [{ data: feedings }, { data: diapers }, { data: sleeps }, { data: latestPhoto }] =
    await Promise.all([
      supabase
        .from('feeding_events')
        .select('occurred_at')
        .eq('child_id', child.id)
        .is('deleted_at', null)
        .gte('occurred_at', todayIso),
      supabase
        .from('diaper_events')
        .select('occurred_at')
        .eq('child_id', child.id)
        .is('deleted_at', null)
        .gte('occurred_at', todayIso),
      supabase
        .from('sleep_sessions')
        .select('started_at, ended_at')
        .eq('child_id', child.id)
        .is('deleted_at', null)
        .gte('started_at', todayIso),
      // biome-ignore lint/suspicious/noExplicitAny: media_items types stale.
      (supabase as any)
        .from('media_items')
        .select('storage_path, taken_at, created_at')
        .eq('child_id', child.id)
        .is('deleted_at', null)
        .gte('created_at', todayIso)
        .order('taken_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const feedingCount = (feedings ?? []).length;
  const diaperCount = (diapers ?? []).length;
  const sleepRows = (sleeps ?? []) as Array<{ started_at: string; ended_at: string | null }>;

  // Total de horas dormidas hoy (incluyendo siesta en curso desde su
  // started_at hasta ahora).
  const sleepMs = sleepRows.reduce((acc, s) => {
    const start = new Date(s.started_at).getTime();
    const end = s.ended_at ? new Date(s.ended_at).getTime() : Date.now();
    return acc + Math.max(0, end - start);
  }, 0);
  const sleepHours = Math.round((sleepMs / (1000 * 60 * 60)) * 10) / 10;
  const sleepCount = sleepRows.length;

  // Texto. Idioma: rioplatense, 1ra persona del plural cuando aplique
  // ("hoy tuvimos"). Si todavía no hay datos, lo decimos honesto.
  const today = new Date();
  const dayLabel = formatDateAr(today, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const capitalized = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1);

  const parts: string[] = [];
  if (feedingCount > 0) parts.push(`🍼 ${feedingCount} toma${feedingCount === 1 ? '' : 's'}`);
  if (sleepCount > 0) {
    const hStr = sleepHours > 0 ? ` (${sleepHours}h)` : '';
    parts.push(`😴 ${sleepCount} sueño${sleepCount === 1 ? '' : 's'}${hStr}`);
  }
  if (diaperCount > 0) parts.push(`👶 ${diaperCount} pañal${diaperCount === 1 ? '' : 'es'}`);

  const summary = parts.length === 0 ? 'Todavía no hay registros del día.' : parts.join(' · ');

  const text = `${child.name} hoy — ${capitalized}\n${summary} 💛`;

  // Foto: signed URL si encontramos algo del día.
  const photoPath = (latestPhoto?.storage_path as string | undefined) ?? null;
  let photoUrl: string | null = null;
  if (photoPath) {
    const { data: signed } = await supabase.storage
      .from(PHOTOS_BUCKET)
      .createSignedUrl(photoPath, 60 * 60);
    photoUrl = signed?.signedUrl ?? null;
  }

  const generatedAtAr = formatTimeAr(today);

  return {
    text,
    photoUrl,
    photoPath,
    generatedAtAr,
  };
}
