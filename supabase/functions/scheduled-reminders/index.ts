/**
 * Edge Function — scheduled-reminders
 * --------------------------------------------------------------------------
 * Corre cada hora desde pg_cron y manda 2 tipos de notificaciones push:
 *
 * 1. **Controles próximos**: para cada milestone NO completado cuyo due_at
 *    cae en las próximas 24h y todavía no fue notificado (last_reminded_at
 *    es null o > 22h atrás), push a la familia "Mañana es X".
 *
 * 2. **Toma vencida**: para cada bebé activo, si la última feeding_event
 *    fue hace >= 4h y la familia tiene push subscriptions activas, push
 *    "Hace 4h que no registramos toma — ¿la dieron?".
 *
 * Diseño:
 *  - Idempotente: si la function se ejecuta dos veces seguidas, no manda
 *    el mismo push gracias a `last_reminded_at`/`last_feeding_reminder_at`.
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
}

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

async function sendToFamily(
  familyGroupId: string,
  payload: PushPayload,
): Promise<{
  sent: number;
  failed: number;
}> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return { sent: 0, failed: 0 };

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, family_group_id, endpoint, keys')
    .eq('family_group_id', familyGroupId)
    .is('invalidated_at', null);

  if (!subs || subs.length === 0) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;
  for (const s of subs as PushSubRow[]) {
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

    const result = await sendToFamily(m.family_group_id, {
      title: '⏰ Control próximo',
      body: `${m.title} ${when}.`,
      url: `/cuidar/calendario/${m.id}`,
      tag: `milestone-reminder-${m.id}`,
    });

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
    .select('id, name, family_group_id, birth_date, last_feeding_reminder_at')
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
    const result = await sendToFamily(c.family_group_id, {
      title: '🍼 ¿Le tocó toma?',
      body: `Hace ${hoursAgo}h que no anotamos una toma de ${c.name}. Si ya le diste, anotalo.`,
      url: '/home',
      tag: `feeding-reminder-${c.id}`,
    });

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

Deno.serve(async (_req: Request) => {
  const startedAt = Date.now();
  try {
    const milestones = await processMilestoneReminders();
    const feedings = await processFeedingReminders();
    const elapsed = Date.now() - startedAt;
    return new Response(
      JSON.stringify({
        ok: true,
        milestones,
        feedings,
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
