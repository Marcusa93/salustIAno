import { type Proposal, chat, summarizeProposal } from '@/lib/ai/agents/salustia';
import { env } from '@/lib/env';
import { startOfTodayAr } from '@/lib/format-ar';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  type DiaperType,
  type FeedingType,
  diaperEventSchema,
  feedingEventSchema,
} from '@/lib/validators/events';

// Node runtime: usa el cliente admin (server-only) y, a futuro, crypto para
// verificar la firma de Alexa. Nunca cachear: cada request es una interacción.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ============================================================================
// Endpoint de la Alexa Skill de Salu.
//
// Alexa (Amazon) hace POST acá con un request firmado. Verificamos que sea
// nuestra Skill (applicationId) y que no sea un replay (timestamp), y actuamos
// como la familia vía el cliente admin (no hay sesión de usuario en una
// interacción de voz — la identidad la garantiza Amazon + el applicationId).
//
// ⚠️ PENDIENTE de hardening: falta verificar la FIRMA de Alexa
// (Signature / SignatureCertChainUrl) para blindar el endpoint. Ver TODO abajo.
// ============================================================================

// ---- Tipos mínimos del request de Alexa (solo lo que usamos) --------------
interface AlexaSlot {
  name: string;
  value?: string;
}
interface AlexaRequestEnvelope {
  version: string;
  context?: {
    System?: { application?: { applicationId?: string } };
  };
  session?: {
    application?: { applicationId?: string };
  };
  request: {
    type: string;
    timestamp?: string;
    intent?: { name: string; slots?: Record<string, AlexaSlot> };
  };
}

// ---- Helpers de respuesta -------------------------------------------------
function speak(text: string, endSession = true): Response {
  return Response.json({
    version: '1.0',
    response: {
      outputSpeech: { type: 'PlainText', text },
      shouldEndSession: endSession,
    },
  });
}

// ---- Normalización de slots hablados → enums de la DB ---------------------
function normalize(s: string | undefined): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim();
}

function feedingTypeFrom(value: string | undefined): FeedingType | null {
  const v = normalize(value);
  if (!v) return null;
  if (/(pecho|teta|lactancia|mama)/.test(v)) return 'breastfeeding';
  if (/(mamadera|biberon|bibe|formula|leche)/.test(v)) return 'bottle';
  if (/(solido|comida|papilla|pure|fruta)/.test(v)) return 'solid';
  return null;
}

function diaperTypeFrom(value: string | undefined): DiaperType | null {
  const v = normalize(value);
  if (!v) return null;
  if (/(ambos|los dos|todo|completo)/.test(v)) return 'both';
  if (/(caca|popo|sucio|materia|hizo)/.test(v)) return 'dirty';
  if (/(pis|pichi|pipi|mojado|orina)/.test(v)) return 'wet';
  if (/(seco|nada|limpio)/.test(v)) return 'dry';
  return null;
}

function slotNumber(slot: AlexaSlot | undefined): number | undefined {
  if (!slot?.value) return undefined;
  const n = Number.parseInt(slot.value, 10);
  return Number.isNaN(n) ? undefined : n;
}

// ---- Resolución de la familia/bebé objetivo -------------------------------
type AdminClient = ReturnType<typeof createAdminClient>;

interface Target {
  childId: string;
  childName: string;
  familyGroupId: string;
  createdBy: string | null;
}

async function resolveTarget(admin: AdminClient): Promise<Target | null> {
  const { data: child } = await admin
    .from('child_profiles')
    .select('id, name, family_group_id')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!child) return null;

  const { data: adminMember } = await admin
    .from('family_memberships')
    .select('user_id')
    .eq('family_group_id', child.family_group_id)
    .eq('role', 'admin')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  return {
    childId: child.id,
    childName: child.name,
    familyGroupId: child.family_group_id,
    createdBy: adminMember?.user_id ?? null,
  };
}

// ---- Consultas de lectura -------------------------------------------------
async function todaySummary(admin: AdminClient, childId: string): Promise<string> {
  const since = startOfTodayAr().toISOString();
  const [{ count: feedings }, { count: diapers }, { count: sleeps }] = await Promise.all([
    admin
      .from('feeding_events')
      .select('id', { count: 'exact', head: true })
      .eq('child_id', childId)
      .is('deleted_at', null)
      .gte('occurred_at', since),
    admin
      .from('diaper_events')
      .select('id', { count: 'exact', head: true })
      .eq('child_id', childId)
      .is('deleted_at', null)
      .gte('occurred_at', since),
    admin
      .from('sleep_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('child_id', childId)
      .is('deleted_at', null)
      .gte('started_at', since),
  ]);
  return `Hoy: ${feedings ?? 0} tomas, ${diapers ?? 0} pañales y ${sleeps ?? 0} sueños registrados.`;
}

function humanizeSince(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'recién';
  if (mins < 60) return `hace ${mins} minutos`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `hace ${h} horas` : `hace ${h} horas y ${m} minutos`;
}

async function lastFeeding(admin: AdminClient, childId: string): Promise<string> {
  const { data } = await admin
    .from('feeding_events')
    .select('occurred_at, type')
    .eq('child_id', childId)
    .is('deleted_at', null)
    .order('occurred_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return 'Todavía no hay ninguna toma registrada.';
  const tipo =
    data.type === 'breastfeeding'
      ? 'de pecho'
      : data.type === 'bottle'
        ? 'de mamadera'
        : 'de sólido';
  return `La última toma ${tipo} fue ${humanizeSince(data.occurred_at as string)}.`;
}

// ---- Registro de eventos --------------------------------------------------
async function registerFeeding(
  admin: AdminClient,
  target: Target,
  slots: Record<string, AlexaSlot> | undefined,
): Promise<string> {
  const type = feedingTypeFrom(slots?.metodo?.value);
  if (!type) {
    return '¿Fue pecho, mamadera o sólido? Decime, por ejemplo, "tomó pecho quince minutos".';
  }
  const duration = slotNumber(slots?.duracion);
  const amount = slotNumber(slots?.cantidad);

  const input: Record<string, unknown> = { occurred_at: new Date().toISOString(), type };
  if (type === 'breastfeeding' && duration !== undefined) input.duration_minutes = duration;
  if (type === 'bottle' && amount !== undefined) input.amount_ml = amount;

  const parsed = feedingEventSchema.safeParse(input);
  if (!parsed.success) return 'No pude anotar esa toma, revisá los datos e intentá de nuevo.';

  const { error } = await admin.from('feeding_events').insert({
    child_id: target.childId,
    created_by: target.createdBy,
    occurred_at: parsed.data.occurred_at,
    type: parsed.data.type,
    duration_minutes: parsed.data.duration_minutes ?? null,
    amount_ml: parsed.data.amount_ml ?? null,
    reaction: parsed.data.reaction,
  });
  if (error) return 'Hubo un problema al guardar la toma. Probá de nuevo en un ratito.';

  const detalle =
    type === 'breastfeeding'
      ? duration !== undefined
        ? ` de pecho de ${duration} minutos`
        : ' de pecho'
      : type === 'bottle'
        ? amount !== undefined
          ? ` de mamadera de ${amount} mililitros`
          : ' de mamadera'
        : ' de sólido';
  return `Listo, anoté una toma${detalle} para ${target.childName}.`;
}

async function registerDiaper(
  admin: AdminClient,
  target: Target,
  slots: Record<string, AlexaSlot> | undefined,
): Promise<string> {
  const type = diaperTypeFrom(slots?.tipo?.value);
  if (!type) {
    return '¿El pañal fue de pis, de caca, ambos o estaba seco?';
  }
  const parsed = diaperEventSchema.safeParse({ occurred_at: new Date().toISOString(), type });
  if (!parsed.success) return 'No pude anotar ese pañal, intentá de nuevo.';

  const { error } = await admin.from('diaper_events').insert({
    child_id: target.childId,
    created_by: target.createdBy,
    occurred_at: parsed.data.occurred_at,
    type: parsed.data.type,
  });
  if (error) return 'Hubo un problema al guardar el pañal. Probá de nuevo.';

  const label =
    type === 'wet'
      ? 'de pis'
      : type === 'dirty'
        ? 'de caca'
        : type === 'both'
          ? 'de pis y caca'
          : 'seco';
  return `Anotado, un pañal ${label} para ${target.childName}.`;
}

// ---- Texto libre → Salustia (consultar o cargar CUALQUIER cosa) -----------
/** Si el ISO no trae zona horaria, lo tratamos como hora de Argentina (UTC-3). */
function toTimestamptz(iso: string): string {
  return /[zZ]$|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}-03:00`;
}

/** Ejecuta una propuesta de Salustia con el admin client. Devuelve true si la
 *  cargó. milestone/memory no se cargan por voz (se avisan). */
async function executeProposal(admin: AdminClient, target: Target, p: Proposal): Promise<boolean> {
  const base = { child_id: target.childId, created_by: target.createdBy };
  if (p.kind === 'feeding') {
    const { error } = await admin.from('feeding_events').insert({
      ...base,
      occurred_at: toTimestamptz(p.occurred_at),
      type: p.type,
      side: p.side ?? null,
      duration_minutes: p.duration_minutes ?? null,
      amount_ml: p.amount_ml ?? null,
      reaction: p.reaction,
    });
    return !error;
  }
  if (p.kind === 'diaper') {
    const { error } = await admin.from('diaper_events').insert({
      ...base,
      occurred_at: toTimestamptz(p.occurred_at),
      type: p.type,
      notes: p.notes ?? null,
    });
    return !error;
  }
  if (p.kind === 'sleep') {
    const { error } = await admin.from('sleep_sessions').insert({
      ...base,
      started_at: toTimestamptz(p.started_at),
      ended_at: p.ended_at ? toTimestamptz(p.ended_at) : null,
      quality: p.quality,
      is_nap: p.is_nap,
      notes: p.notes ?? null,
    });
    return !error;
  }
  if (p.kind === 'note') {
    const { error } = await admin.from('notes').insert({
      ...base,
      occurred_at: toTimestamptz(p.occurred_at ?? new Date().toISOString()),
      category: p.category,
      content: p.content,
    });
    return !error;
  }
  return false; // milestone / memory → por ahora no por voz
}

async function handleFreeText(admin: AdminClient, target: Target, text: string): Promise<Response> {
  if (!text.trim()) {
    return speak('Contame qué querés saber o anotar.', false);
  }
  if (!target.createdBy) {
    return speak('No pude identificar tu usuario. Entrá una vez a la app y reintentá.', true);
  }
  let out: Awaited<ReturnType<typeof chat>>;
  try {
    out = await chat(
      { messages: [{ role: 'user', content: text }], voice: 'baby' },
      {
        auth: { supabase: admin, userId: target.createdBy },
        familyGroupId: target.familyGroupId,
        actorUserId: target.createdBy,
      },
    );
  } catch {
    return speak('Uh, no pude procesar eso ahora. Probá de nuevo en un ratito.', true);
  }

  const proposals = out.proposals ?? [];
  if (proposals.length === 0) {
    // Consulta pura → leemos la respuesta de Salustia.
    return speak(out.reply || 'Listo.', true);
  }
  // Hay cosas para cargar; por voz no hay cards de confirmación, así que las
  // ejecutamos y confirmamos hablando.
  const done: string[] = [];
  const skipped: string[] = [];
  for (const p of proposals) {
    const ok = await executeProposal(admin, target, p);
    (ok ? done : skipped).push(summarizeProposal(p));
  }
  let msg = '';
  if (done.length > 0) msg += `Anoté: ${done.join('; ')}.`;
  if (skipped.length > 0) msg += ` Esto cargalo desde la app: ${skipped.join('; ')}.`;
  return speak(msg.trim() || out.reply || 'Listo.', true);
}

// ---- Handler principal ----------------------------------------------------
export async function POST(req: Request): Promise<Response> {
  let body: AlexaRequestEnvelope;
  try {
    body = (await req.json()) as AlexaRequestEnvelope;
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  // Verificación 1: applicationId (que sea NUESTRA Skill).
  const appId =
    body.context?.System?.application?.applicationId ?? body.session?.application?.applicationId;
  if (env.ALEXA_SKILL_ID && appId !== env.ALEXA_SKILL_ID) {
    return new Response('Forbidden', { status: 403 });
  }

  // Verificación 2: anti-replay (timestamp del request dentro de ~150s).
  const ts = body.request?.timestamp ? Date.parse(body.request.timestamp) : Number.NaN;
  if (!Number.isNaN(ts) && Math.abs(Date.now() - ts) > 150_000) {
    return new Response('Stale request', { status: 400 });
  }

  // TODO (hardening antes de exponer en serio): verificar la firma de Alexa
  // con los headers `signature` / `signaturecertchainurl` (cadena de certs de
  // Amazon + validación del cuerpo crudo). Sin esto, la seguridad depende solo
  // del applicationId (no publicado) + HTTPS.

  const type = body.request?.type;

  if (type === 'SessionEndedRequest') {
    return Response.json({ version: '1.0', response: {} });
  }

  const admin = createAdminClient();
  const target = await resolveTarget(admin);

  if (type === 'LaunchRequest') {
    if (!target) {
      return speak(
        'Hola. Todavía no cargaste el perfil del bebé en Salu. Crealo desde la app y después te ayudo a anotar tomas y pañales.',
        true,
      );
    }
    const resumen = await todaySummary(admin, target.childId);
    return speak(`Hola. ${resumen} ¿Qué querés hacer?`, false);
  }

  if (type !== 'IntentRequest' || !body.request.intent) {
    return speak('No entendí. Probá de nuevo.', true);
  }

  const intent = body.request.intent.name;
  const slots = body.request.intent.slots;

  // Built-ins de Alexa.
  if (intent === 'AMAZON.StopIntent' || intent === 'AMAZON.CancelIntent') {
    return speak('Chau, cualquier cosa avisame.', true);
  }
  if (intent === 'AMAZON.HelpIntent' || intent === 'AMAZON.FallbackIntent') {
    return speak(
      'Podés decir: "tomó pecho quince minutos", "hizo caca", "cómo va el día" o "cuándo fue la última toma".',
      false,
    );
  }

  if (!target) {
    return speak(
      'Todavía no hay un perfil de bebé cargado en Salu. Crealo desde la app primero.',
      true,
    );
  }

  switch (intent) {
    case 'ResumenHoyIntent':
      return speak(await todaySummary(admin, target.childId), true);
    case 'UltimaTomaIntent':
      return speak(await lastFeeding(admin, target.childId), true);
    case 'RegistrarTomaIntent':
      return speak(await registerFeeding(admin, target, slots), true);
    case 'RegistrarPanalIntent':
      return speak(await registerDiaper(admin, target, slots), true);
    case 'SaluLibreIntent':
      return await handleFreeText(admin, target, slots?.texto?.value ?? '');
    default:
      return speak('Esa todavía no la sé hacer. Decí "ayuda" para escuchar las opciones.', false);
  }
}
