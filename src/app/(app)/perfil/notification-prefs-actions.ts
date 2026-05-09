'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export interface NotificationPrefs {
  /** Hitos médicos próximos a vencer (24h antes). Default ON. */
  controls: boolean;
  /** Toma vencida (>=4h sin registrar). Default ON. */
  feeding_overdue: boolean;
  /** Próxima toma estimada (predicción rule-based). Default OFF. */
  feeding_predicted: boolean;
  /** Próximo pañal estimado (predicción rule-based). Default OFF. */
  diaper_predicted: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  controls: true,
  feeding_overdue: true,
  feeding_predicted: false,
  diaper_predicted: false,
};

const VALID_KEYS = new Set<keyof NotificationPrefs>([
  'controls',
  'feeding_overdue',
  'feeding_predicted',
  'diaper_predicted',
]);

/**
 * Devuelve las prefs del usuario actual. Si no hay fila en
 * notification_prefs, devuelve los defaults.
 */
export async function loadNotificationPrefsAction(): Promise<NotificationPrefs> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return DEFAULT_PREFS;

  // biome-ignore lint/suspicious/noExplicitAny: types stale para notification_prefs.
  const sb = supabase as any;
  const { data } = await sb
    .from('notification_prefs')
    .select('prefs')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  const stored = (data?.prefs as Partial<NotificationPrefs> | null) ?? {};
  return { ...DEFAULT_PREFS, ...stored };
}

/**
 * Toggle de una pref. Si la fila no existe, se crea con los defaults
 * y luego se aplica el cambio. Devuelve las prefs actualizadas.
 *
 * Validación: el `key` tiene que estar en VALID_KEYS — defensa contra
 * tabla envenenada o updates malformados.
 */
export async function setNotificationPrefAction(
  key: string,
  value: boolean,
): Promise<{ ok: true; prefs: NotificationPrefs } | { ok: false; error: string }> {
  if (!VALID_KEYS.has(key as keyof NotificationPrefs)) {
    return { ok: false, error: 'Preferencia desconocida.' };
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, error: 'Sesión expirada.' };

  // biome-ignore lint/suspicious/noExplicitAny: types stale.
  const sb = supabase as any;

  // Leemos las prefs actuales (o defaults), aplicamos el cambio y
  // upserteamos de un saque. UPSERT con onConflict garantiza atomicidad.
  const { data: existing } = await sb
    .from('notification_prefs')
    .select('prefs')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  const current: NotificationPrefs = {
    ...DEFAULT_PREFS,
    ...((existing?.prefs as Partial<NotificationPrefs> | null) ?? {}),
  };
  const updated: NotificationPrefs = { ...current, [key]: value };

  const { error } = await sb
    .from('notification_prefs')
    .upsert(
      { user_id: userData.user.id, prefs: updated, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );

  if (error) return { ok: false, error: 'No pudimos guardar la preferencia.' };

  revalidatePath('/perfil');
  return { ok: true, prefs: updated };
}
