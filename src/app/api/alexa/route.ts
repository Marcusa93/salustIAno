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

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ============================================================================
// Endpoint de la Alexa Skill de Salu.
//
// Alexa hace POST acá con un request firmado. Verificamos applicationId y
// timestamp (anti-replay). La sesión se mantiene abierta tras cada acción
// para que el usuario pueda cargar varios eventos en cadena sin re-invocar.
//
// ⚠️ PENDIENTE hardening: verificar firma Amazon (Signature / SignatureCertChainUrl).
// ============================================================================

interface AlexaSlot {
  name: string;
  value?: string;
}

interface AlexaRequestEnvelope {
  version: string;
  context?: { System?: { application?: { applicationId?: string } } };
  session?: {
    application?: { applicationId?: string };
    attributes?: Record<string, unknown>;
  };
  request: {
    type: string;
    timestamp?: string;
    intent?: { name: string; slots?: Record<string, AlexaSlot> };
  };
}

// Contexto que se persiste entre turnos de la misma sesión de Alexa.
interface SessionAttribs {
  lastAction?: 'feeding' | 'diaper' | 'sleep_start' | 'sleep_end';
  lastFeedingType?: FeedingType;
  lastDiaperType?: DiaperType;
  lastAmount?: number;
  lastDuration?: number;
}

// ---- Modo noche: 20:00–09:00 AR → Alexa susurra --------------------------
function isNightAr(): boolean {
  const h = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Argentina/Buenos_Aires',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(new Date()),
  );
  return h >= 20 || h < 9;
}

function escapeSsml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---- Respuesta Alexa -------------------------------------------------------
// endSession=false mantiene el micrófono abierto; siempre incluye reprompt.
const REPROMPT_DAY =
  '¿Querés cargar algo más? Podés decir "tomó pecho", "hizo caca", "se durmió" o "cómo va el día".';
const REPROMPT_NIGHT = 'Decime.';

function speak(
  text: string,
  end = true,
  opts: { reprompt?: string; attribs?: SessionAttribs } = {},
): Response {
  const { reprompt, attribs = {} } = opts;
  const night = isNightAr();
  const outputSpeech = night
    ? {
        type: 'SSML',
        ssml: `<speak><amazon:effect name="whispered">${escapeSsml(text)}</amazon:effect></speak>`,
      }
    : { type: 'PlainText', text };

  const response: Record<string, unknown> = { outputSpeech, shouldEndSession: end };
  if (!end) {
    const rp = reprompt ?? (night ? REPROMPT_NIGHT : REPROMPT_DAY);
    response.reprompt = { outputSpeech: { type: 'PlainText', text: rp } };
  }

  return Response.json({ version: '1.0', sessionAttributes: attribs, response });
}

// ---- Normalización de slots hablados -------------------------------------
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
  if (/(solido|comida|papilla|pure|fruta|solidos)/.test(v)) return 'solid';
  return null;
}

function diaperTypeFrom(value: string | undefined): DiaperType | null {
  const v = normalize(value);
  if (!v) return null;
  if (/(ambos|los dos|todo|completo|pis\s*y\s*caca|caca\s*y\s*pis)/.test(v)) return 'both';
  if (/(caca|popo|sucio|materia)/.test(v)) return 'dirty';
  if (/(pis|pichi|pipi|mojado|orina|humedo)/.test(v)) return 'wet';
  if (/(seco|nada|limpio)/.test(v)) return 'dry';
  return null;
}

function slotNumber(slot: AlexaSlot | undefined): number | undefined {
  if (!slot?.value) return undefined;
  const n = Number.parseInt(slot.value, 10);
  return Number.isNaN(n) ? undefined : n;
}

// ---- Resolución del bebé / familia ----------------------------------------
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
function humanizeSince(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'recién';
  if (mins < 60) return `hace ${mins} ${mins === 1 ? 'minuto' : 'minutos'}`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return `hace ${h} ${h === 1 ? 'hora' : 'horas'}`;
  return `hace ${h}h ${m}min`;
}

interface DayStats {
  feedings: number;
  diapers: number;
  activeSleep: { id: string; started_at: string } | null;
  lastFeedingAt: string | null;
}

async function getDayStats(admin: AdminClient, childId: string): Promise<DayStats> {
  const since = startOfTodayAr().toISOString();
  const [{ count: feedings }, { count: diapers }, { data: activeSleep }, { data: lastFeeding }] =
    await Promise.all([
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
        .select('id, started_at')
        .eq('child_id', childId)
        .is('ended_at', null)
        .is('deleted_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from('feeding_events')
        .select('occurred_at')
        .eq('child_id', childId)
        .is('deleted_at', null)
        .order('occurred_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  return {
    feedings: feedings ?? 0,
    diapers: diapers ?? 0,
    activeSleep: activeSleep as { id: string; started_at: string } | null,
    lastFeedingAt: (lastFeeding as { occurred_at: string } | null)?.occurred_at ?? null,
  };
}

async function todaySummaryText(admin: AdminClient, childId: string): Promise<string> {
  const stats = await getDayStats(admin, childId);
  const parts = [`${stats.feedings} tomas`, `${stats.diapers} pañales`];
  if (stats.activeSleep) parts.push(`durmiendo ${humanizeSince(stats.activeSleep.started_at)}`);
  return `Hoy: ${parts.join(', ')}.`;
}

async function lastFeedingText(admin: AdminClient, childId: string): Promise<string> {
  const { data } = await admin
    .from('feeding_events')
    .select('occurred_at, type, amount_ml, duration_minutes')
    .eq('child_id', childId)
    .is('deleted_at', null)
    .order('occurred_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return 'Todavía no hay ninguna toma registrada hoy.';
  const tipo =
    data.type === 'breastfeeding'
      ? 'de pecho'
      : data.type === 'bottle'
        ? 'de mamadera'
        : 'de sólido';
  const detalle =
    data.type === 'bottle' && data.amount_ml
      ? ` (${data.amount_ml} ml)`
      : data.type === 'breastfeeding' && data.duration_minutes
        ? ` (${data.duration_minutes} min)`
        : '';
  return `La última toma ${tipo}${detalle} fue ${humanizeSince(data.occurred_at as string)}.`;
}

// ---- Registro de toma -------------------------------------------------------
interface RegResult {
  text: string;
  ok: boolean;
  attribs: SessionAttribs;
}

async function registerFeeding(
  admin: AdminClient,
  target: Target,
  slots: Record<string, AlexaSlot> | undefined,
  prevAttribs: SessionAttribs,
): Promise<RegResult> {
  const type = feedingTypeFrom(slots?.metodo?.value);
  if (!type) {
    return {
      text: '¿La toma fue de pecho, mamadera o sólido?',
      ok: false,
      attribs: prevAttribs,
    };
  }

  const duration = slotNumber(slots?.duracion);
  const amount = slotNumber(slots?.cantidad);
  const offsetMins = slotNumber(slots?.tiempo);
  const occurredAt = offsetMins
    ? new Date(Date.now() - offsetMins * 60_000).toISOString()
    : new Date().toISOString();

  const input: Record<string, unknown> = { occurred_at: occurredAt, type };
  if (type === 'breastfeeding' && duration !== undefined) input.duration_minutes = duration;
  if (type === 'bottle' && amount !== undefined) input.amount_ml = amount;

  const parsed = feedingEventSchema.safeParse(input);
  if (!parsed.success) {
    return { text: 'No pude anotar esa toma. Intentá de nuevo.', ok: false, attribs: prevAttribs };
  }

  const { error } = await admin.from('feeding_events').insert({
    child_id: target.childId,
    created_by: target.createdBy,
    occurred_at: parsed.data.occurred_at,
    type: parsed.data.type,
    duration_minutes: parsed.data.duration_minutes ?? null,
    amount_ml: parsed.data.amount_ml ?? null,
    reaction: parsed.data.reaction,
  });

  if (error) {
    return {
      text: 'Hubo un problema al guardar la toma. Probá en un ratito.',
      ok: false,
      attribs: prevAttribs,
    };
  }

  const tiempoPasado = offsetMins ? ` (hace ${offsetMins} min)` : '';
  const detalle =
    type === 'breastfeeding'
      ? duration !== undefined
        ? ` de pecho de ${duration} min`
        : ' de pecho'
      : type === 'bottle'
        ? amount !== undefined
          ? ` de mamadera de ${amount} ml`
          : ' de mamadera'
        : ' de sólido';

  const text = isNightAr()
    ? 'Anotado.'
    : `Listo, anoté una toma${detalle}${tiempoPasado} para ${target.childName}.`;

  return {
    text,
    ok: true,
    attribs: {
      lastAction: 'feeding',
      lastFeedingType: type,
      lastAmount: amount,
      lastDuration: duration,
    },
  };
}

// ---- Registro de pañal ------------------------------------------------------
async function registerDiaper(
  admin: AdminClient,
  target: Target,
  slots: Record<string, AlexaSlot> | undefined,
  prevAttribs: SessionAttribs,
): Promise<RegResult> {
  const type = diaperTypeFrom(slots?.tipo?.value);
  if (!type) {
    return {
      text: '¿El pañal fue de pis, de caca, ambos o estaba seco?',
      ok: false,
      attribs: prevAttribs,
    };
  }

  const offsetMins = slotNumber(slots?.tiempo);
  const occurredAt = offsetMins
    ? new Date(Date.now() - offsetMins * 60_000).toISOString()
    : new Date().toISOString();

  const parsed = diaperEventSchema.safeParse({ occurred_at: occurredAt, type });
  if (!parsed.success) {
    return { text: 'No pude anotar ese pañal. Intentá de nuevo.', ok: false, attribs: prevAttribs };
  }

  const { error } = await admin.from('diaper_events').insert({
    child_id: target.childId,
    created_by: target.createdBy,
    occurred_at: parsed.data.occurred_at,
    type: parsed.data.type,
  });

  if (error) {
    return {
      text: 'No se pudo guardar el pañal. Probá en un ratito.',
      ok: false,
      attribs: prevAttribs,
    };
  }

  const label =
    type === 'wet'
      ? 'de pis'
      : type === 'dirty'
        ? 'de caca'
        : type === 'both'
          ? 'de pis y caca'
          : 'seco';
  const tiempoPasado = offsetMins ? ` (hace ${offsetMins} min)` : '';
  const text = isNightAr()
    ? 'Anotado.'
    : `Anotado, pañal ${label}${tiempoPasado} para ${target.childName}.`;

  return {
    text,
    ok: true,
    attribs: { lastAction: 'diaper', lastDiaperType: type },
  };
}

// ---- Registro de sueño ------------------------------------------------------
async function registerSleepStart(admin: AdminClient, target: Target): Promise<RegResult> {
  const { data: open } = await admin
    .from('sleep_sessions')
    .select('id, started_at')
    .eq('child_id', target.childId)
    .is('ended_at', null)
    .is('deleted_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (open) {
    const mins = Math.round((Date.now() - new Date(open.started_at as string).getTime()) / 60_000);
    return {
      text: isNightAr() ? 'Ya estaba durmiendo.' : `Ya está durmiendo, arrancó hace ${mins} min.`,
      ok: false,
      attribs: { lastAction: 'sleep_start' },
    };
  }

  const { error } = await admin.from('sleep_sessions').insert({
    child_id: target.childId,
    created_by: target.createdBy,
    started_at: new Date().toISOString(),
    is_nap: true,
  });

  if (error) {
    return { text: 'No pude anotar el sueño. Probá de nuevo.', ok: false, attribs: {} };
  }

  return {
    text: isNightAr() ? 'Anotado.' : `Listo, anoté que ${target.childName} se durmió ahora.`,
    ok: true,
    attribs: { lastAction: 'sleep_start' },
  };
}

async function registerSleepEnd(admin: AdminClient, target: Target): Promise<RegResult> {
  const { data: open } = await admin
    .from('sleep_sessions')
    .select('id, started_at')
    .eq('child_id', target.childId)
    .is('ended_at', null)
    .is('deleted_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!open) {
    return {
      text: isNightAr() ? 'No había sueño abierto.' : 'No había ningún sueño abierto para cerrar.',
      ok: false,
      attribs: {},
    };
  }

  const now = new Date().toISOString();
  const totalMins = Math.round(
    (Date.now() - new Date(open.started_at as string).getTime()) / 60_000,
  );
  const hours = Math.floor(totalMins / 60);
  const rest = totalMins % 60;
  const durLabel = hours > 0 ? `${hours}h${rest > 0 ? ` ${rest}min` : ''}` : `${totalMins} min`;

  const { error } = await admin.from('sleep_sessions').update({ ended_at: now }).eq('id', open.id);

  if (error) {
    return { text: 'No pude cerrar el sueño. Probá de nuevo.', ok: false, attribs: {} };
  }

  return {
    text: isNightAr() ? 'Anotado.' : `Listo, ${target.childName} durmió ${durLabel}.`,
    ok: true,
    attribs: { lastAction: 'sleep_end' },
  };
}

// ---- Repetir última acción (RepetirUltimoIntent) -------------------------
async function repeatLastAction(
  admin: AdminClient,
  target: Target,
  prev: SessionAttribs,
): Promise<RegResult> {
  if (!prev.lastAction) {
    return {
      text: 'No sé qué repetir, no hay ninguna acción reciente en esta sesión.',
      ok: false,
      attribs: prev,
    };
  }

  if (prev.lastAction === 'feeding') {
    const fakeslots: Record<string, AlexaSlot> = {};
    if (prev.lastFeedingType) {
      fakeslots.metodo = { name: 'metodo', value: prev.lastFeedingType };
    }
    if (prev.lastAmount !== undefined) {
      fakeslots.cantidad = { name: 'cantidad', value: String(prev.lastAmount) };
    }
    if (prev.lastDuration !== undefined) {
      fakeslots.duracion = { name: 'duracion', value: String(prev.lastDuration) };
    }
    return registerFeeding(admin, target, fakeslots, prev);
  }

  if (prev.lastAction === 'diaper') {
    const fakeslots: Record<string, AlexaSlot> = {};
    if (prev.lastDiaperType) {
      fakeslots.tipo = { name: 'tipo', value: prev.lastDiaperType };
    }
    return registerDiaper(admin, target, fakeslots, prev);
  }

  if (prev.lastAction === 'sleep_start') return registerSleepStart(admin, target);
  if (prev.lastAction === 'sleep_end') return registerSleepEnd(admin, target);

  return { text: 'No encontré qué repetir.', ok: false, attribs: prev };
}

// ---- Estado actual (EstadoActualIntent) ------------------------------------
async function currentStatus(admin: AdminClient, target: Target): Promise<string> {
  const stats = await getDayStats(admin, target.childId);
  const name = target.childName;

  if (stats.activeSleep) {
    const mins = Math.round(
      (Date.now() - new Date(stats.activeSleep.started_at).getTime()) / 60_000,
    );
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const durStr = h > 0 ? `${h}h${m > 0 ? ` ${m}min` : ''}` : `${mins} min`;
    return `${name} está durmiendo hace ${durStr}. Hoy: ${stats.feedings} tomas y ${stats.diapers} pañales.`;
  }

  const ultimaToma = stats.lastFeedingAt
    ? ` La última toma fue ${humanizeSince(stats.lastFeedingAt)}.`
    : '';
  return `${name} está despierto/a.${ultimaToma} Hoy: ${stats.feedings} tomas y ${stats.diapers} pañales.`;
}

// ---- Texto libre → Salustia -----------------------------------------------
function toTimestamptz(iso: string): string {
  return /[zZ]$|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}-03:00`;
}

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
  return false;
}

async function handleFreeText(
  admin: AdminClient,
  target: Target,
  text: string,
  prevAttribs: SessionAttribs,
): Promise<Response> {
  if (!text.trim()) {
    return speak('Contame qué querés saber o anotar.', false, { attribs: prevAttribs });
  }
  if (!target.createdBy) {
    return speak('No pude identificar tu usuario. Entrá una vez a la app y reintentá.', true);
  }
  const userText = isNightAr()
    ? `${text} (es de noche y el bebé duerme: respondé en una sola frase muy corta)`
    : text;

  let out: Awaited<ReturnType<typeof chat>>;
  try {
    out = await chat(
      { messages: [{ role: 'user', content: userText }], voice: 'baby' },
      {
        auth: { supabase: admin, userId: target.createdBy },
        familyGroupId: target.familyGroupId,
        actorUserId: target.createdBy,
      },
    );
  } catch {
    return speak('No pude procesar eso ahora. Probá en un ratito.', false, {
      attribs: prevAttribs,
    });
  }

  const proposals = out.proposals ?? [];
  if (proposals.length === 0) {
    return speak(out.reply || 'Listo.', false, { attribs: prevAttribs });
  }

  const done: string[] = [];
  const skipped: string[] = [];
  for (const p of proposals) {
    const ok = await executeProposal(admin, target, p);
    (ok ? done : skipped).push(summarizeProposal(p));
  }

  if (isNightAr()) {
    return speak(done.length > 0 ? 'Anotado.' : out.reply || 'Listo.', false, {
      attribs: prevAttribs,
    });
  }

  let msg = '';
  if (done.length > 0) msg += `Anoté: ${done.join('; ')}.`;
  if (skipped.length > 0) msg += ` Cargá esto desde la app: ${skipped.join('; ')}.`;
  return speak(msg.trim() || out.reply || 'Listo.', false, { attribs: prevAttribs });
}

// ---- Handler principal ----------------------------------------------------
export async function POST(req: Request): Promise<Response> {
  let body: AlexaRequestEnvelope;
  try {
    body = (await req.json()) as AlexaRequestEnvelope;
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  // Verificación 1: applicationId.
  const appId =
    body.context?.System?.application?.applicationId ?? body.session?.application?.applicationId;
  if (env.ALEXA_SKILL_ID && appId !== env.ALEXA_SKILL_ID) {
    return new Response('Forbidden', { status: 403 });
  }

  // Verificación 2: anti-replay (timestamp dentro de ~150s).
  const ts = body.request?.timestamp ? Date.parse(body.request.timestamp) : Number.NaN;
  if (!Number.isNaN(ts) && Math.abs(Date.now() - ts) > 150_000) {
    return new Response('Stale request', { status: 400 });
  }

  // Contexto de la sesión actual (vacío si primer turno).
  const prevAttribs = (body.session?.attributes ?? {}) as SessionAttribs;

  const type = body.request?.type;

  if (type === 'SessionEndedRequest') {
    return Response.json({ version: '1.0', response: {} });
  }

  const admin = createAdminClient();
  const target = await resolveTarget(admin);

  // --- LaunchRequest: saludo contextual ------------------------------------
  if (type === 'LaunchRequest') {
    if (!target) {
      return speak(
        'Hola. Todavía no hay perfil de bebé en Salu. Crealo desde la app y volvemos.',
        true,
      );
    }
    const stats = await getDayStats(admin, target.childId);
    const name = target.childName;

    if (isNightAr()) {
      const dormido = stats.activeSleep ? ` ${name} está durmiendo.` : '';
      return speak(`Hola.${dormido} Decime.`, false, { attribs: prevAttribs });
    }

    let saludo: string;
    if (stats.activeSleep) {
      const mins = Math.round(
        (Date.now() - new Date(stats.activeSleep.started_at).getTime()) / 60_000,
      );
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      const dur = h > 0 ? `${h}h${m > 0 ? ` ${m}min` : ''}` : `${mins} min`;
      saludo = `Hola. ${name} está durmiendo hace ${dur}. Hoy: ${stats.feedings} tomas y ${stats.diapers} pañales.`;
    } else {
      const ultima = stats.lastFeedingAt
        ? ` Última toma ${humanizeSince(stats.lastFeedingAt)}.`
        : '';
      saludo = `Hola. Hoy: ${stats.feedings} tomas y ${stats.diapers} pañales.${ultima}`;
    }
    return speak(`${saludo} ¿Qué querés anotar?`, false, { attribs: prevAttribs });
  }

  if (type !== 'IntentRequest' || !body.request.intent) {
    return speak('No entendí. Probá de nuevo.', false, { attribs: prevAttribs });
  }

  const intent = body.request.intent.name;
  const slots = body.request.intent.slots;

  // --- Built-ins ------------------------------------------------------------
  if (intent === 'AMAZON.StopIntent' || intent === 'AMAZON.CancelIntent') {
    return speak('Chau, cualquier cosa avisame.', true);
  }

  if (intent === 'AMAZON.HelpIntent') {
    return speak(
      'Podés decirme: "tomó pecho quince minutos", "le di ciento veinte ml", ' +
        '"hizo caca", "se durmió", "se despertó", "cómo va el día" o "cuándo comió".',
      false,
      { attribs: prevAttribs },
    );
  }

  if (intent === 'AMAZON.FallbackIntent') {
    const tip = target
      ? `Estoy escuchando para ${target.childName}. Podés decir "tomó pecho", "hizo caca", "se durmió" o "cómo va el día".`
      : 'No entendí. Podés decir "tomó pecho", "hizo caca" o "cómo va el día".';
    return speak(tip, false, { attribs: prevAttribs });
  }

  if (!target) {
    return speak('No hay perfil de bebé en Salu. Crealo desde la app primero.', true);
  }

  // --- Intents de dominio ---------------------------------------------------
  switch (intent) {
    case 'ResumenHoyIntent':
      return speak(await todaySummaryText(admin, target.childId), false, { attribs: prevAttribs });

    case 'UltimaTomaIntent':
      return speak(await lastFeedingText(admin, target.childId), false, { attribs: prevAttribs });

    case 'EstadoActualIntent':
      return speak(await currentStatus(admin, target), false, { attribs: prevAttribs });

    case 'RegistrarTomaIntent': {
      const r = await registerFeeding(admin, target, slots, prevAttribs);
      return speak(r.text, false, { attribs: r.attribs });
    }

    case 'RegistrarPanalIntent': {
      const r = await registerDiaper(admin, target, slots, prevAttribs);
      return speak(r.text, false, { attribs: r.attribs });
    }

    case 'RegistrarSuenoIntent': {
      const r = await registerSleepStart(admin, target);
      return speak(r.text, false, { attribs: r.attribs });
    }

    case 'RegistrarDespertarIntent': {
      const r = await registerSleepEnd(admin, target);
      return speak(r.text, false, { attribs: r.attribs });
    }

    case 'RepetirUltimoIntent': {
      const r = await repeatLastAction(admin, target, prevAttribs);
      return speak(r.text, false, { attribs: r.attribs });
    }

    case 'SaluLibreIntent':
      return handleFreeText(admin, target, slots?.texto?.value ?? '', prevAttribs);

    default:
      return speak('Esa todavía no la sé hacer. Decí "ayuda" para escuchar las opciones.', false, {
        attribs: prevAttribs,
      });
  }
}
