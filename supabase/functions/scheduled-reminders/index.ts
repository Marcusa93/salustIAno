/**
 * Edge Function — scheduled-reminders
 * --------------------------------------------------------------------------
 * Corre cada 15 min desde pg_cron y manda 4 tipos de notificaciones push:
 *
 * 1. **Controles próximos**: para cada milestone NO completado cuyo due_at
 *    cae en las próximas 24h y todavía no fue notificado (last_reminded_at
 *    es null o > 22h atrás), push a la familia "Mañana es X".
 *    Pref: `controls` (default ON).
 *
 * 2. **Toma vencida**: para cada bebé activo, si la última feeding_event
 *    fue hace >= 4h y la familia tiene push subscriptions activas, push
 *    "Hace 4h que no registramos toma — ¿la dieron?".
 *    Pref: `feeding_overdue` (default ON).
 *
 * 3. **Próxima toma estimada**: rule-based. Si la próxima toma estimada
 *    (mediana del intervalo de los últimos 7 días) cae en los próximos
 *    5–30 min, push "🍼 Probablemente venga toma en ~X min".
 *    Pref: `feeding_predicted` (default OFF — opt-in).
 *
 * 4. **Próximo pañal estimado**: idem para pañales.
 *    Pref: `diaper_predicted` (default OFF — opt-in).
 *
 * Diseño:
 *  - Idempotente: si la function se ejecuta dos veces seguidas, no manda
 *    el mismo push gracias a las columnas `last_*_reminder_at`.
 *  - Predictivos solo se mandan a users que tienen la pref activa.
 *  - Deno runtime — usamos npm:web-push (Supabase Edge runtime soporta
 *    npm specifiers desde 2024).
 *  - Lee VAPID keys de los secrets de la function:
 *      VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL
 *  - Service role key para queries que cruzan familias.
 */

// @ts-expect-error Deno runtime: npm specifier soportado en Edge Functions.
import webpush from 'npm:web-push@3.6.7';
// @ts-expect-error Deno runtime: import maps no están en lib estándar de TS.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

interface PushSubRow {
  id: string;
  user_id: string;
  family_group_id: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

interface MilestoneRow {
  id: string;
  family_group_id: string;
  title: string;
  due_at: string | null;
  last_reminded_at: string | null;
}

interface ChildRow {
  id: string;
  name: string;
  family_group_id: string;
  last_feeding_reminder_at: string | null;
  last_predicted_feeding_reminder_at: string | null;
  last_predicted_diaper_reminder_at: string | null;
}

interface NotificationPrefs {
  controls?: boolean;
  feeding_overdue?: boolean;
  feeding_predicted?: boolean;
  diaper_predicted?: boolean;
}

type PrefKey = keyof NotificationPrefs;

const DEFAULT_PREFS: Required<NotificationPrefs> = {
  controls: true,
  feeding_overdue: true,
  feeding_predicted: false,
  diaper_predicted: false,
};

const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY');
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY');
const VAPID_EMAIL = Deno.env.get('VAPID_EMAIL') ?? 'noreply@salu.local';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(`mailto:${VAPID_EMAIL}`, VAPID_PUBLIC, VAPID_PRIVATE);
}

const FEEDING_REMINDER_HOURS = 4; // umbral para "hace mucho que no anotaron"
const MILESTONE_LOOKAHEAD_HOURS = 24; // notificar si vence en menos de 24h

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * Lee las prefs de un user desde notification_prefs. Si la fila no existe
 * todavía, devuelve DEFAULT_PREFS (controls + feeding_overdue ON,
 * predictivos OFF).
 */
async function getPrefs(userId: string): Promise<Required<NotificationPrefs>> {
  const { data } = await supabase
    .from('notification_prefs')
    .select('prefs')
    .eq('user_id', userId)
    .maybeSingle();
  const stored = (data?.prefs as NotificationPrefs | null) ?? {};
  return { ...DEFAULT_PREFS, ...stored };
}

/**
 * Manda push a la familia, opcionalmente filtrando por una pref específica.
 *
 * Si `prefKey` se pasa, solo se envía a las subscriptions cuyo user tenga
 * esa pref activa. Sin prefKey, se envía a todas (push "tradicionales"
 * tipo control / toma vencida que asumimos importantes para todos).
 *
 * Pref lookup es 1 query por user único. Si la familia tiene 4 devices
 * de 2 users, hace 2 queries — aceptable para una function que corre
 * cada 15 min.
 */
async function sendToFamily(
  familyGroupId: string,
  payload: PushPayload,
  prefKey?: PrefKey,
): Promise<{
  sent: number;
  failed: number;
}> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return { sent: 0, failed: 0 };

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, family_group_id, endpoint, keys')
    .eq('family_group_id', familyGroupId)
    .is('invalidated_at', null);

  if (!subs || subs.length === 0) return { sent: 0, failed: 0 };

  // Cache de prefs por user (varios devices del mismo user comparten).
  const prefsByUser = new Map<string, Required<NotificationPrefs>>();
  async function userHasPref(userId: string, key: PrefKey): Promise<boolean> {
    let p = prefsByUser.get(userId);
    if (!p) {
      p = await getPrefs(userId);
      prefsByUser.set(userId, p);
    }
    return p[key] === true;
  }

  let sent = 0;
  let failed = 0;
  for (const s of subs as PushSubRow[]) {
    if (prefKey && !(await userHasPref(s.user_id, prefKey))) continue;
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: s.keys },
        JSON.stringify(payload),
      );
      sent += 1;
    } catch (err) {
      failed += 1;
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await supabase
          .from('push_subscriptions')
          .update({ invalidated_at: new Date().toISOString() })
          .eq('id', s.id);
      }
    }
  }
  return { sent, failed };
}

// ============================================================================
// Predicciones rule-based (replicado del cliente: src/lib/predictions.ts).
// La edge function corre en Deno y no puede importar TS de la app, así que
// la lógica se duplica acá. Si esto crece, conviene extraer a un módulo
// .ts compartido en supabase/functions/_shared/.
// ============================================================================

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    const a = sorted[mid - 1];
    const b = sorted[mid];
    if (a === undefined || b === undefined) return null;
    return (a + b) / 2;
  }
  return sorted[mid] ?? null;
}

function intervalsBetween(timestamps: string[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < timestamps.length; i++) {
    const prev = timestamps[i - 1];
    const curr = timestamps[i];
    if (!prev || !curr) continue;
    const delta = (new Date(curr).getTime() - new Date(prev).getTime()) / 60_000;
    if (delta > 0) out.push(delta);
  }
  return out;
}

interface PredictOpts {
  minIntervalMinutes: number;
  maxIntervalMinutes: number;
  minSamples: number;
}

/**
 * Devuelve la fecha estimada del próximo evento. Null si no hay datos
 * suficientes para una predicción razonable.
 */
function predictNext(
  asc: string[],
  lastAtISO: string,
  opts: PredictOpts,
): { expectedAt: Date; medianMinutes: number } | null {
  const intervals = intervalsBetween(asc).filter(
    (m) => m >= opts.minIntervalMinutes && m <= opts.maxIntervalMinutes,
  );
  if (intervals.length < opts.minSamples) return null;
  const med = median(intervals);
  if (med === null) return null;
  const lastMs = new Date(lastAtISO).getTime();
  if (Number.isNaN(lastMs)) return null;
  return { expectedAt: new Date(lastMs + med * 60_000), medianMinutes: med };
}

const FEEDING_PREDICT_OPTS: PredictOpts = {
  minIntervalMinutes: 30,
  maxIntervalMinutes: 360,
  minSamples: 3,
};

const DIAPER_PREDICT_OPTS: PredictOpts = {
  minIntervalMinutes: 15,
  maxIntervalMinutes: 480,
  minSamples: 3,
};

// Ventana en minutos a partir de ahora dentro de la cual disparamos el
// push. Si la próxima toma estimada cae más allá de los 30 min, esperamos
// al próximo tick del cron. Si cae antes de los 5 min, ya casi pasó —
// avisar es ruido.
const PREDICT_LEAD_MIN_MIN = 5;
const PREDICT_LEAD_MAX_MIN = 30;
const PREDICT_REMINDER_COOLDOWN_HOURS = 1.5;

async function processMilestoneReminders(): Promise<{ checked: number; notified: number }> {
  const now = new Date();
  const horizon = new Date(now.getTime() + MILESTONE_LOOKAHEAD_HOURS * 60 * 60 * 1000);
  const cutoff = new Date(now.getTime() - 22 * 60 * 60 * 1000); // 22h de gracia entre avisos

  const { data: milestones } = await supabase
    .from('medical_milestones')
    .select('id, family_group_id, title, due_at, last_reminded_at')
    .is('deleted_at', null)
    .is('completed_at', null)
    .gte('due_at', now.toISOString())
    .lte('due_at', horizon.toISOString());

  if (!milestones || milestones.length === 0) return { checked: 0, notified: 0 };

  let notified = 0;
  for (const m of milestones as MilestoneRow[]) {
    // Skip si ya avisamos en las últimas 22h.
    if (m.last_reminded_at && new Date(m.last_reminded_at) > cutoff) continue;
    if (!m.due_at) continue;

    const due = new Date(m.due_at);
    const hoursUntil = Math.round((due.getTime() - now.getTime()) / (60 * 60 * 1000));
    const when =
      hoursUntil <= 1 ? 'es ya' : hoursUntil <= 12 ? `es en ${hoursUntil}h` : 'es mañana';

    const result = await sendToFamily(
      m.family_group_id,
      {
        title: '⏰ Control próximo',
        body: `${m.title} ${when}.`,
        url: `/cuidar/calendario/${m.id}`,
        tag: `milestone-reminder-${m.id}`,
      },
      'controls',
    );

    if (result.sent > 0) {
      await supabase
        .from('medical_milestones')
        .update({ last_reminded_at: now.toISOString() })
        .eq('id', m.id);
      notified += 1;
    }
  }
  return { checked: milestones.length, notified };
}

async function processFeedingReminders(): Promise<{ checked: number; notified: number }> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - FEEDING_REMINDER_HOURS * 60 * 60 * 1000);
  const reminderCooldown = new Date(now.getTime() - 3 * 60 * 60 * 1000); // 3h entre avisos

  // Solo bebés ya nacidos (con birth_date <= now) — antes del nacimiento no
  // tiene sentido recordar tomas.
  const { data: children } = await supabase
    .from('child_profiles')
    .select(
      'id, name, family_group_id, birth_date, last_feeding_reminder_at, last_predicted_feeding_reminder_at, last_predicted_diaper_reminder_at',
    )
    .is('deleted_at', null)
    .lte('birth_date', now.toISOString());

  if (!children || children.length === 0) return { checked: 0, notified: 0 };

  let notified = 0;
  for (const c of children as ChildRow[]) {
    // Si avisamos en las últimas 3h, skip — evita spam.
    if (c.last_feeding_reminder_at && new Date(c.last_feeding_reminder_at) > reminderCooldown) {
      continue;
    }

    const { data: lastFeeding } = await supabase
      .from('feeding_events')
      .select('occurred_at')
      .eq('child_id', c.id)
      .is('deleted_at', null)
      .order('occurred_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Si la última toma fue después del cutoff (i.e. hace menos de 4h), no
    // hace falta recordar. Si nunca registraron toma, tampoco recordamos —
    // probablemente la familia recién está empezando a usar Salu.
    if (!lastFeeding) continue;
    const lastAt = new Date(lastFeeding.occurred_at as string);
    if (lastAt > cutoff) continue;

    const hoursAgo = Math.round((now.getTime() - lastAt.getTime()) / (60 * 60 * 1000));
    const result = await sendToFamily(
      c.family_group_id,
      {
        title: '🍼 ¿Le tocó toma?',
        body: `Hace ${hoursAgo}h que no anotamos una toma de ${c.name}. Si ya le diste, anotalo.`,
        url: '/home',
        tag: `feeding-reminder-${c.id}`,
      },
      'feeding_overdue',
    );

    if (result.sent > 0) {
      await supabase
        .from('child_profiles')
        .update({ last_feeding_reminder_at: now.toISOString() })
        .eq('id', c.id);
      notified += 1;
    }
  }
  return { checked: children.length, notified };
}

/**
 * Procesa predicciones de "próxima toma estimada" para todos los bebés
 * activos. Para cada uno con datos suficientes y pref activada en al
 * menos un user de la familia, manda push si la próxima cae en los
 * próximos 5–30 min.
 */
async function processFeedingPredictions(): Promise<{ checked: number; notified: number }> {
  const now = new Date();
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 días
  const cooldownCutoff = new Date(now.getTime() - PREDICT_REMINDER_COOLDOWN_HOURS * 60 * 60 * 1000);

  const { data: children } = await supabase
    .from('child_profiles')
    .select('id, name, family_group_id, birth_date, last_predicted_feeding_reminder_at')
    .is('deleted_at', null)
    .lte('birth_date', now.toISOString());

  if (!children || children.length === 0) return { checked: 0, notified: 0 };

  let notified = 0;
  for (const c of children as ChildRow[]) {
    if (
      c.last_predicted_feeding_reminder_at &&
      new Date(c.last_predicted_feeding_reminder_at) > cooldownCutoff
    ) {
      continue;
    }

    const { data: feedings } = await supabase
      .from('feeding_events')
      .select('occurred_at')
      .eq('child_id', c.id)
      .is('deleted_at', null)
      .gte('occurred_at', since.toISOString())
      .order('occurred_at', { ascending: true });

    const list = (feedings ?? []) as Array<{ occurred_at: string }>;
    if (list.length < 4) continue;
    const lastFeeding = list[list.length - 1];
    if (!lastFeeding) continue;

    const prediction = predictNext(
      list.map((f) => f.occurred_at),
      lastFeeding.occurred_at,
      FEEDING_PREDICT_OPTS,
    );
    if (!prediction) continue;

    const minutesUntil = Math.round((prediction.expectedAt.getTime() - now.getTime()) / 60_000);
    if (minutesUntil < PREDICT_LEAD_MIN_MIN || minutesUntil > PREDICT_LEAD_MAX_MIN) {
      continue;
    }

    const cadenceHours = Math.round((prediction.medianMinutes / 60) * 10) / 10;
    const result = await sendToFamily(
      c.family_group_id,
      {
        title: '🍼 Probablemente venga toma',
        body: `${c.name} suele tomar cada ${cadenceHours}h. Quedan ~${minutesUntil} min.`,
        url: '/home',
        tag: `feeding-predicted-${c.id}`,
      },
      'feeding_predicted',
    );

    if (result.sent > 0) {
      await supabase
        .from('child_profiles')
        .update({ last_predicted_feeding_reminder_at: now.toISOString() })
        .eq('id', c.id);
      notified += 1;
    }
  }
  return { checked: children.length, notified };
}

/**
 * Procesa predicciones de "próximo pañal estimado". Misma lógica que
 * feedings con un umbral de cadencia más laxo (los pañales son menos
 * predictivos pero la cadencia ronda 2–3h).
 */
async function processDiaperPredictions(): Promise<{ checked: number; notified: number }> {
  const now = new Date();
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const cooldownCutoff = new Date(now.getTime() - PREDICT_REMINDER_COOLDOWN_HOURS * 60 * 60 * 1000);

  const { data: children } = await supabase
    .from('child_profiles')
    .select('id, name, family_group_id, birth_date, last_predicted_diaper_reminder_at')
    .is('deleted_at', null)
    .lte('birth_date', now.toISOString());

  if (!children || children.length === 0) return { checked: 0, notified: 0 };

  let notified = 0;
  for (const c of children as ChildRow[]) {
    if (
      c.last_predicted_diaper_reminder_at &&
      new Date(c.last_predicted_diaper_reminder_at) > cooldownCutoff
    ) {
      continue;
    }

    const { data: diapers } = await supabase
      .from('diaper_events')
      .select('occurred_at')
      .eq('child_id', c.id)
      .is('deleted_at', null)
      .gte('occurred_at', since.toISOString())
      .order('occurred_at', { ascending: true });

    const list = (diapers ?? []) as Array<{ occurred_at: string }>;
    if (list.length < 4) continue;
    const lastDiaper = list[list.length - 1];
    if (!lastDiaper) continue;

    const prediction = predictNext(
      list.map((d) => d.occurred_at),
      lastDiaper.occurred_at,
      DIAPER_PREDICT_OPTS,
    );
    if (!prediction) continue;

    const minutesUntil = Math.round((prediction.expectedAt.getTime() - now.getTime()) / 60_000);
    if (minutesUntil < PREDICT_LEAD_MIN_MIN || minutesUntil > PREDICT_LEAD_MAX_MIN) {
      continue;
    }

    const result = await sendToFamily(
      c.family_group_id,
      {
        title: '👶 Probablemente toque pañal',
        body: `${c.name} suele cambiarse en ~${minutesUntil} min según los últimos días.`,
        url: '/home',
        tag: `diaper-predicted-${c.id}`,
      },
      'diaper_predicted',
    );

    if (result.sent > 0) {
      await supabase
        .from('child_profiles')
        .update({ last_predicted_diaper_reminder_at: now.toISOString() })
        .eq('id', c.id);
      notified += 1;
    }
  }
  return { checked: children.length, notified };
}

Deno.serve(async (_req: Request) => {
  const startedAt = Date.now();
  try {
    const milestones = await processMilestoneReminders();
    const feedings = await processFeedingReminders();
    const feedingPredictions = await processFeedingPredictions();
    const diaperPredictions = await processDiaperPredictions();
    const elapsed = Date.now() - startedAt;
    return new Response(
      JSON.stringify({
        ok: true,
        milestones,
        feedings,
        feedingPredictions,
        diaperPredictions,
        elapsedMs: elapsed,
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : 'unknown',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
