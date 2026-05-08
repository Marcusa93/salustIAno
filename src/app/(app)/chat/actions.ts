'use server';

import {
  createDiaperAction,
  createFeedingAction,
  createSleepAction,
} from '@/app/(app)/cuidar/eventos/actions';
import { salustiaChat } from '@/lib/ai/agents';
import { tagPhoto } from '@/lib/ai/agents/photo-tagger';
import { detectMedicalIntent } from '@/lib/ai/agents/salustia/medical-intent';
import {
  type Proposal,
  proposalSchema,
  summarizeProposal,
} from '@/lib/ai/agents/salustia/proposals';
import { AIConfigError, AIError, AINetworkError, AIProviderError } from '@/lib/ai/errors';
import { logStore } from '@/lib/ai/logger';
import type { ChatMessage } from '@/lib/ai/types';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

/**
 * Convierte un timestamp del agente a ISO UTC respetando timezone Argentina.
 *
 * Por qué importa: el prompt le pide al LLM "occurred_at en hora local de
 * Argentina (ej. 2026-05-06T15:30)". Sin sufijo Z ni offset, ECMA define
 * que "2026-05-06T15:30" se parsea como hora local del runtime. En dev
 * (Mac en Argentina) eso es UTC-3 y funciona. En Vercel (server UTC) se
 * interpreta como UTC y queda 3h adelantado. Resultado: el evento queda
 * en la hora "equivocada" y la familia no lo ve donde espera.
 *
 * Fix: si el string viene sin Z y sin offset explícito, asumimos
 * Argentina (UTC-3, sin DST desde 2009) y agregamos el offset antes de
 * pasarle a Date.
 *
 * Acepta:
 *   - "2026-05-06T15:30"           → 2026-05-06T18:30:00.000Z (asume AR)
 *   - "2026-05-06T15:30:00"        → 2026-05-06T18:30:00.000Z (asume AR)
 *   - "2026-05-06T15:30Z"          → 2026-05-06T15:30:00.000Z (UTC literal)
 *   - "2026-05-06T15:30-03:00"     → 2026-05-06T18:30:00.000Z (offset literal)
 *   - "2026-05-06T15:30+02:00"     → 2026-05-06T13:30:00.000Z (offset literal)
 *   - timestamp con ms             → idem
 */
const HAS_TIMEZONE_RE = /(?:Z|[+-]\d{2}:?\d{2})$/i;
function agentTimestampToUTC(input: string): string {
  const trimmed = input.trim();
  if (HAS_TIMEZONE_RE.test(trimmed)) {
    return new Date(trimmed).toISOString();
  }
  // Sin offset → asumimos Argentina UTC-3.
  return new Date(`${trimmed}-03:00`).toISOString();
}

/**
 * Sanity check: si el timestamp del agente está absurdamente lejos del
 * presente (>24h atrás o >1h en el futuro), lo loggeamos como warning
 * para debug. No bloqueamos — la familia puede haber querido cargar algo
 * de ayer o mañana — pero si pasa seguido es síntoma de mala interpretación
 * de hora por parte del LLM.
 */
function logTimestampSanity(kind: string, agentISO: string, utcISO: string): void {
  const eventMs = new Date(utcISO).getTime();
  const now = Date.now();
  const diffHours = (now - eventMs) / (60 * 60 * 1000);
  if (diffHours > 24 || diffHours < -1) {
    void logStore.record({
      agent: 'salustia-timestamp-sanity',
      model: '-',
      promptVersion: 'sanity-v1',
      error: `kind=${kind} agentISO="${agentISO}" utcISO="${utcISO}" diffHours=${diffHours.toFixed(1)}`,
    });
  }
}

export type ClientMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string };

export type SendMessageResult =
  | { ok: true; reply: string; proposals: Proposal[]; toolCallsMade: string[] }
  | {
      ok: false;
      error: {
        type: 'config' | 'network' | 'provider' | 'parse' | 'guardrail' | 'validation';
        message: string;
      };
    };

export type ExecuteProposalResult =
  | { ok: true; eventId: string; summary: string }
  | { ok: false; error: { type: 'validation' | 'provider'; message: string } };

const MAX_HISTORY = 30;
const MAX_INPUT_LEN = 2000;

/**
 * Action que el cliente llama cada vez que el user manda un mensaje.
 * Recibe el historial actual + el mensaje nuevo, devuelve la respuesta del
 * asistente.
 *
 * Nunca tira: siempre devuelve un `SendMessageResult` discriminado para
 * que la UI haga render por estado, sin try/catch encima.
 *
 * Validaciones server-side:
 *   - El último mensaje tiene que ser del user (defensa en profundidad).
 *   - Content no vacío y dentro del límite (anti-spam y anti-abuse).
 *   - Historia limitada a las últimas N entradas (no consumimos contexto
 *     infinito).
 */
export async function sendMessageAction(history: ClientMessage[]): Promise<SendMessageResult> {
  if (history.length === 0) {
    return {
      ok: false,
      error: { type: 'validation', message: 'No mandaste ningún mensaje.' },
    };
  }

  const last = history[history.length - 1];
  if (!last || last.role !== 'user') {
    return {
      ok: false,
      error: { type: 'validation', message: 'El último mensaje tiene que ser tuyo.' },
    };
  }

  for (const m of history) {
    if (typeof m.content !== 'string' || m.content.length === 0) {
      return {
        ok: false,
        error: { type: 'validation', message: 'Hay un mensaje vacío en el historial.' },
      };
    }
    if (m.content.length > MAX_INPUT_LEN) {
      return {
        ok: false,
        error: {
          type: 'validation',
          message: `El mensaje supera el máximo (${MAX_INPUT_LEN} caracteres).`,
        },
      };
    }
  }

  const trimmed = history.slice(-MAX_HISTORY);
  const messages: ChatMessage[] = trimmed.map((m) => ({ role: m.role, content: m.content }));

  // Resolvemos user + family_group_id para la persistencia. Si la sesión
  // no es válida, devolvemos error inmediatamente.
  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return { ok: false, error: { type: 'validation', message: 'Sesión expirada.' } };
  }
  const { data: membership } = await supabase
    .from('family_memberships')
    .select('family_group_id')
    .eq('user_id', userData.user.id)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();

  const lastUserContent = last.content;

  // Pre-LLM medical intent guardrail. Si matchea, devolvemos canned reply
  // sin pegar al modelo — y dejamos rastro en ai_logs para auditoría.
  const detection = detectMedicalIntent(lastUserContent);
  if (detection.matched) {
    await logStore.record({
      agent: 'salustia-medical-deflect',
      model: '-',
      promptVersion: 'medical-intent-v1',
      error: `pattern matched: ${detection.pattern}`,
    });
    if (membership?.family_group_id) {
      await persistMessages(supabase, userData.user.id, membership.family_group_id, [
        { role: 'user', content: lastUserContent },
        { role: 'assistant', content: detection.reply },
      ]);
    }
    return {
      ok: true,
      reply: detection.reply,
      proposals: [],
      toolCallsMade: [],
    };
  }

  try {
    const result = await salustiaChat({ messages });

    // Hallucination guard: si la familia pidió anotar algo y el agente
    // respondió "anotado/listo/ya está" pero NO llamó a ningún propose_*,
    // pisamos su reply con un mensaje claro para que vuelva a intentar.
    // Evita el bug "te dice anotado pero no se ve reflejado".
    const guarded = applyHallucinationGuard({
      userMessage: lastUserContent,
      reply: result.reply,
      proposalsCount: result.proposals.length,
      toolCallsMade: result.meta.toolCallsMade,
    });

    if (membership?.family_group_id) {
      await persistMessages(supabase, userData.user.id, membership.family_group_id, [
        { role: 'user', content: lastUserContent },
        { role: 'assistant', content: guarded.reply },
      ]);
    }
    return {
      ok: true,
      reply: guarded.reply,
      proposals: result.proposals,
      toolCallsMade: result.meta.toolCallsMade,
    };
  } catch (err) {
    if (err instanceof AIConfigError) {
      return {
        ok: false,
        error: { type: 'config', message: 'Falta configurar el modelo. Avisale al admin.' },
      };
    }
    if (err instanceof AINetworkError) {
      return {
        ok: false,
        error: { type: 'network', message: 'No pudimos conectar con la IA. Probá de nuevo.' },
      };
    }
    if (err instanceof AIProviderError) {
      return {
        ok: false,
        error: { type: 'provider', message: 'El asistente tuvo un problema. Intentá de nuevo.' },
      };
    }
    if (err instanceof AIError) {
      return { ok: false, error: { type: err.type, message: err.message } };
    }
    return {
      ok: false,
      error: { type: 'provider', message: 'Algo salió mal. Probá de nuevo.' },
    };
  }
}

/**
 * Confirma una propuesta de SalustIA y la persiste vía la action correspondiente
 * a su tipo. Re-valida con el schema (defensa en profundidad: el cliente
 * puede mandarnos cualquier cosa).
 *
 * Las actions reusadas (createFeeding/Sleep/Diaper/Note) ya hacen su propia
 * validación + RLS via supabase. Esta función es solo el switch + el adapter.
 */
export async function executeProposalAction(rawProposal: unknown): Promise<ExecuteProposalResult> {
  const parsed = proposalSchema.safeParse(rawProposal);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        type: 'validation',
        message: 'La propuesta tiene datos inválidos. Probá de nuevo.',
      },
    };
  }
  const proposal = parsed.data;

  if (proposal.kind === 'feeding') {
    const occurredUTC = agentTimestampToUTC(proposal.occurred_at);
    logTimestampSanity('feeding', proposal.occurred_at, occurredUTC);
    const result = await createFeedingAction({
      occurred_at: occurredUTC,
      type: proposal.type,
      side: proposal.side ?? '',
      duration_minutes: proposal.duration_minutes,
      amount_ml: proposal.amount_ml,
      foods: proposal.foods,
      reaction: proposal.reaction,
      notes: proposal.notes ?? '',
    });
    if (!result.ok) {
      return {
        ok: false,
        error: {
          type: 'provider',
          message: result.errors.root ?? 'No pudimos guardar la toma.',
        },
      };
    }
    await logProposalConfirm(proposal.kind, result.id);
    return { ok: true, eventId: result.id, summary: summarizeProposal(proposal) };
  }

  if (proposal.kind === 'sleep') {
    const startedUTC = agentTimestampToUTC(proposal.started_at);
    logTimestampSanity('sleep.start', proposal.started_at, startedUTC);
    const endedUTC = proposal.ended_at ? agentTimestampToUTC(proposal.ended_at) : '';
    if (endedUTC) logTimestampSanity('sleep.end', proposal.ended_at ?? '', endedUTC);
    const result = await createSleepAction({
      started_at: startedUTC,
      ended_at: endedUTC,
      quality: proposal.quality,
      is_nap: proposal.is_nap,
      notes: proposal.notes ?? '',
    });
    if (!result.ok) {
      return {
        ok: false,
        error: {
          type: 'provider',
          message: result.errors.root ?? 'No pudimos guardar el sueño.',
        },
      };
    }
    await logProposalConfirm(proposal.kind, result.id);
    return { ok: true, eventId: result.id, summary: summarizeProposal(proposal) };
  }

  if (proposal.kind === 'diaper') {
    const occurredUTC = agentTimestampToUTC(proposal.occurred_at);
    logTimestampSanity('diaper', proposal.occurred_at, occurredUTC);
    const result = await createDiaperAction({
      occurred_at: occurredUTC,
      type: proposal.type,
      notes: proposal.notes ?? '',
    });
    if (!result.ok) {
      return {
        ok: false,
        error: {
          type: 'provider',
          message: result.errors.root ?? 'No pudimos guardar el pañal.',
        },
      };
    }
    await logProposalConfirm(proposal.kind, result.id);
    return { ok: true, eventId: result.id, summary: summarizeProposal(proposal) };
  }

  if (proposal.kind === 'note') {
    // Insertamos inline para evitar el redirect del createNoteAction
    // (ese está pensado para el flow de la página /notas).
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return { ok: false, error: { type: 'validation', message: 'Sesión expirada.' } };
    }
    const { data: child } = await supabase
      .from('child_profiles')
      .select('id')
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!child) {
      return {
        ok: false,
        error: { type: 'validation', message: 'Todavía no hay un perfil de bebé.' },
      };
    }

    const { data: noteData, error: noteErr } = await supabase
      .from('notes')
      .insert({
        child_id: child.id,
        occurred_at: proposal.occurred_at
          ? agentTimestampToUTC(proposal.occurred_at)
          : new Date().toISOString(),
        category: proposal.category,
        content: proposal.content,
        created_by: userData.user.id,
      })
      .select('id')
      .single();

    if (noteErr || !noteData) {
      return {
        ok: false,
        error: { type: 'provider', message: 'No pudimos guardar la nota.' },
      };
    }
    revalidatePath('/home');
    revalidatePath('/timeline');
    await logProposalConfirm(proposal.kind, noteData.id);
    return { ok: true, eventId: noteData.id, summary: summarizeProposal(proposal) };
  }

  if (proposal.kind === 'memory') {
    // Memoria persistente — INSERT en family_memories. RLS exige
    // is_family_member + created_by = auth.uid().
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return { ok: false, error: { type: 'validation', message: 'Sesión expirada.' } };
    }

    const { data: memMembership } = await supabase
      .from('family_memberships')
      .select('family_group_id')
      .eq('user_id', userData.user.id)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();

    if (!memMembership?.family_group_id) {
      return {
        ok: false,
        error: { type: 'validation', message: 'No encontramos tu grupo familiar.' },
      };
    }

    // biome-ignore lint/suspicious/noExplicitAny: types stale hasta regenerar Supabase types con la migration 022.
    const sb = supabase as any;
    const { data: memoryData, error: memoryErr } = await sb
      .from('family_memories')
      .insert({
        family_group_id: memMembership.family_group_id,
        content: proposal.content,
        kind: proposal.category ?? null,
        private_to_user: proposal.scope === 'private' ? userData.user.id : null,
        created_by: userData.user.id,
      })
      .select('id')
      .single();

    if (memoryErr || !memoryData) {
      return {
        ok: false,
        error: {
          type: 'provider',
          message:
            'No pudimos guardar la memoria. Si recién aplicaste la migration, refrescá el chat.',
        },
      };
    }

    revalidatePath('/chat');
    await logProposalConfirm(proposal.kind, memoryData.id);
    return { ok: true, eventId: memoryData.id, summary: summarizeProposal(proposal) };
  }

  // proposal.kind === 'milestone' — turno médico, vacuna, control, etc.
  // Insert directo en medical_milestones. La RLS exige is_family_admin,
  // así que solo admins pueden agendar via chat (igual que el form de
  // /cuidar/calendario/nuevo).
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { ok: false, error: { type: 'validation', message: 'Sesión expirada.' } };
  }

  const { data: membership } = await supabase
    .from('family_memberships')
    .select('family_group_id')
    .eq('user_id', userData.user.id)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();

  if (!membership?.family_group_id) {
    return {
      ok: false,
      error: { type: 'validation', message: 'No encontramos tu grupo familiar.' },
    };
  }

  const dueUTC = agentTimestampToUTC(proposal.due_at);
  // Para milestones la "sanity" es distinta — pueden ser hasta 2 años en
  // el futuro (controles del año), o pasados (cargas retroactivas). No
  // logueamos warning.

  const { data: msData, error: msErr } = await supabase
    .from('medical_milestones')
    .insert({
      family_group_id: membership.family_group_id,
      title: proposal.title,
      category: proposal.category,
      due_at: dueUTC,
      description: proposal.description ?? null,
      notes: proposal.notes ?? null,
      created_by: userData.user.id,
    })
    .select('id')
    .single();

  if (msErr || !msData) {
    return {
      ok: false,
      error: {
        type: 'provider',
        message: 'No pudimos guardar el turno. Si no sos admin, pedile a un admin que lo cargue.',
      },
    };
  }

  revalidatePath('/home');
  revalidatePath('/cuidar/calendario');
  await logProposalConfirm(proposal.kind, msData.id);
  return { ok: true, eventId: msData.id, summary: summarizeProposal(proposal) };
}

/**
 * Audita confirmaciones humanas de propuestas. Útil para distinguir, en
 * ai_logs, qué accionó el LLM (propose_*) vs qué confirmó la familia.
 * El campo `error` se reusa como metadata legible — no es realmente un error.
 */
async function logProposalConfirm(kind: Proposal['kind'], eventId: string): Promise<void> {
  await logStore.record({
    agent: 'salustia-proposal-confirm',
    model: '-',
    promptVersion: 'salustia-v2-confirm',
    error: `kind=${kind} event_id=${eventId}`,
  });
}

/**
 * Auditoría cuando la familia descarta una propuesta del LLM. La UI llama
 * acá del lado cliente al hacer click en "No". No insertamos nada en la
 * base; solo dejamos rastro en ai_logs para detectar patrones (ej. el
 * modelo propone mucho y la familia rechaza casi todo → ajustar prompt).
 */
export async function logProposalDeclineAction(
  rawProposal: unknown,
): Promise<{ ok: true } | { ok: false }> {
  const parsed = proposalSchema.safeParse(rawProposal);
  if (!parsed.success) return { ok: false };
  await logStore.record({
    agent: 'salustia-proposal-decline',
    model: '-',
    promptVersion: 'salustia-v2-decline',
    error: `kind=${parsed.data.kind}`,
  });
  return { ok: true };
}

// ============================================================================
// Chat history persistence
// ============================================================================

const CHAT_HISTORY_LIMIT = 50;

/**
 * Persiste un par user→assistant en chat_messages. Best-effort: si falla
 * la insert, no bloqueamos la respuesta del chat — el user ya vio el
 * reply. Lo loggeamos para que se note si pasa seguido.
 *
 * Exportada para que el FloatingSalu (que comparte tabla con /chat) la
 * pueda reusar. La timeline es UNA por usuario, sin importar dónde se
 * escribió el mensaje.
 */
export async function persistMessages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  familyGroupId: string,
  messages: ReadonlyArray<{ role: 'user' | 'assistant'; content: string }>,
): Promise<void> {
  const rows = messages.map((m) => ({
    user_id: userId,
    family_group_id: familyGroupId,
    role: m.role,
    content: m.content,
  }));
  // biome-ignore lint/suspicious/noExplicitAny: types stale hasta regenerar Supabase types con la migration 20260501150000.
  const sb = supabase as any;
  const { error } = await sb.from('chat_messages').insert(rows);
  if (error) {
    await logStore.record({
      agent: 'salustia-persist',
      model: '-',
      promptVersion: 'chat-history-v1',
      error: `insert failed: ${error.message}`,
    });
  }
}

export type ChatHistoryEntry = { role: 'user' | 'assistant'; content: string };

/**
 * Devuelve los últimos N mensajes del usuario actual, ordenados
 * cronológicamente. La page de /chat lo invoca al server-render.
 */
export async function loadChatHistoryAction(): Promise<ChatHistoryEntry[]> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];

  // biome-ignore lint/suspicious/noExplicitAny: types stale hasta regenerar.
  const sb = supabase as any;
  const { data, error } = await sb
    .from('chat_messages')
    .select('role, content, created_at')
    .eq('user_id', userData.user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(CHAT_HISTORY_LIMIT);

  if (error || !data) return [];

  // Volvemos a orden cronológico ascendente para renderizar.
  return [...(data as Array<{ role: string; content: string }>)]
    .reverse()
    .map((r) => ({ role: r.role as 'user' | 'assistant', content: r.content }));
}

/**
 * Soft-delete de toda la conversación del usuario. No destruye audit
 * trail (ai_logs sigue intacto, los registros marcados con deleted_at
 * no se ven más en la UI pero quedan en la base).
 */
export async function clearChatHistoryAction(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { ok: false, error: 'Sesión expirada.' };
  }
  // biome-ignore lint/suspicious/noExplicitAny: types stale hasta regenerar.
  const sb = supabase as any;
  const { error } = await sb
    .from('chat_messages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('user_id', userData.user.id)
    .is('deleted_at', null);

  if (error) {
    return { ok: false, error: 'No pudimos limpiar la conversación.' };
  }
  return { ok: true };
}

/**
 * Detecta cuando el agente responde "anotado/listo/cargué/etc" pero NO
 * llamó a ningún propose_*. Eso es alucinación: el modelo cree que
 * persistió el evento pero el sistema nunca lo vio.
 *
 * Cuando se detecta:
 *   1. Se pisa el reply con un mensaje claro a la familia.
 *   2. Se loguea en ai_logs como warning para auditar tasa de hallucination.
 *
 * No es perfecto (regex de español rioplatense), pero atrapa el 90% de
 * los casos que la familia describe como "el chatbot dice anotado pero no
 * se ve reflejado".
 */
const ANNOTATION_INTENT_RE =
  /\b(?:anot[áa]|anota|registr[áa]|registra|cargu[ée]?|cargá|cargas?|sum[áa]|sumá|agreg[áa]|agrega|guard[áa]|guarda)\b/iu;
const HALLUCINATED_CONFIRM_RE =
  /\b(?:ya\s+(?:est[áa]|qued[óo])\s+(?:anotad[oa]|cargad[oa]|guardad[oa]|registrad[oa])|listo,?\s+(?:anotad[oa]|cargad[oa]|guardad[oa])|anotad[oa]\b|registrad[oa]\b|cargad[oa]\b|qued[óo]\s+anotad[oa]|los?\s+anot[ée]?\b|lo\s+cargu[ée]?\b|lo\s+guard[ée]?\b)/iu;

interface HallucinationGuardInput {
  userMessage: string;
  reply: string;
  proposalsCount: number;
  toolCallsMade: string[];
}

function applyHallucinationGuard(input: HallucinationGuardInput): { reply: string } {
  const userWantsAnnotation = ANNOTATION_INTENT_RE.test(input.userMessage);
  if (!userWantsAnnotation) return { reply: input.reply };

  const calledPropose = input.toolCallsMade.some((t) => t.startsWith('propose_'));
  // Si llamó propose_* y emitió proposals, todo OK — la card se va a mostrar.
  if (calledPropose && input.proposalsCount > 0) return { reply: input.reply };

  // No emitió proposals pero igual respondió. Si el reply afirma que anotó,
  // es alucinación. La pisamos.
  const claimsConfirmed = HALLUCINATED_CONFIRM_RE.test(input.reply);
  if (!claimsConfirmed) return { reply: input.reply };

  // Log para auditoría — no bloqueamos en error.
  void logStore.record({
    agent: 'salustia-hallucination-guard',
    model: '-',
    promptVersion: 'guard-v1',
    error: `claimed_confirm_without_propose: user="${input.userMessage.slice(0, 200)}" reply="${input.reply.slice(0, 200)}"`,
  });

  return {
    reply: [
      'Ah, perdón — lo dije pero todavía no apreté el botón. ¿Me lo decís de nuevo con más detalle? (qué fue, a qué hora) y te dejo abajo la card para confirmar.',
    ].join('\n'),
  };
}

// ============================================================================
// Photo upload via chat
// ============================================================================

/**
 * Configuración del upload de fotos por chat. Replicada de
 * `src/app/(app)/album/actions.ts` a propósito — son dos callers con el
 * mismo bucket pero distinto flow. Si aparece un tercer caller, vale la
 * pena extraer un helper compartido.
 */
const PHOTOS_BUCKET = 'photos';
const PHOTO_ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const PHOTO_VISION_FRIENDLY_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const PHOTO_MAX_BYTES = 20 * 1024 * 1024; // 20 MB
const PHOTO_MAX_TAGGABLE_BYTES = 8 * 1024 * 1024; // 8 MB

export type SendPhotoToChatResult =
  | {
      ok: true;
      photoUrl: string;
      albumName: string;
      tags: string[];
      assistantReply: string;
    }
  | { ok: false; error: string };

/**
 * Sube una foto desde el composer del chat (botón 📎). La foto se guarda
 * en el mismo bucket/álbum que /album: queda automáticamente en el álbum
 * mensual del mes en curso y se auto-etiqueta con el agente photo-tagger.
 *
 * Persiste un par user→assistant en `chat_messages` para que la
 * conversación tenga rastro. Devuelve los datos para que la UI pueda
 * insertar las burbujas localmente sin tener que rehidratar.
 */
export async function sendPhotoToChatAction(formData: FormData): Promise<SendPhotoToChatResult> {
  const file = formData.get('photo');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'No recibimos ninguna foto.' };
  }
  if (file.size > PHOTO_MAX_BYTES) {
    return { ok: false, error: 'La foto supera los 20 MB.' };
  }
  if (!PHOTO_ALLOWED_MIME.includes(file.type)) {
    return { ok: false, error: 'Formato no soportado. Probá con JPG, PNG o WebP.' };
  }

  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return { ok: false, error: 'Sesión expirada.' };
  }

  const { data: membership } = await supabase
    .from('family_memberships')
    .select('family_group_id')
    .eq('user_id', userData.user.id)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();

  if (!membership?.family_group_id) {
    return { ok: false, error: 'No encontramos tu grupo familiar.' };
  }
  const familyGroupId = membership.family_group_id as string;

  const { data: child } = await supabase
    .from('child_profiles')
    .select('id')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  const childId = (child?.id as string | undefined) ?? null;

  // 1. Upload al Storage.
  const ext =
    (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const rand = Math.random().toString(36).slice(2, 8);
  const storagePath = `${familyGroupId}/${Date.now()}-${rand}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadErr } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      cacheControl: '31536000',
      upsert: false,
    });
  if (uploadErr) {
    return { ok: false, error: 'No pudimos subir la foto. Probá de nuevo.' };
  }

  // 2. Resolver/crear el álbum mensual del momento.
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthName = now.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  const albumName = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  // biome-ignore lint/suspicious/noExplicitAny: types stale para albums/media_items.
  const sb = supabase as any;
  let albumId: string | null = null;
  const { data: existingAlbum } = await sb
    .from('albums')
    .select('id')
    .eq('family_group_id', familyGroupId)
    .eq('month_key', monthKey)
    .is('deleted_at', null)
    .maybeSingle();
  if (existingAlbum?.id) {
    albumId = existingAlbum.id as string;
  } else {
    const { data: createdAlbum } = await sb
      .from('albums')
      .insert({
        family_group_id: familyGroupId,
        child_id: childId,
        name: albumName,
        kind: 'monthly',
        month_key: monthKey,
        created_by: userData.user.id,
      })
      .select('id')
      .single();
    albumId = (createdAlbum?.id as string | undefined) ?? null;
  }

  // 3. Auto-tag (best-effort).
  const takenAtIso = new Date(file.lastModified || Date.now()).toISOString();
  let aiTags: string[] = [];
  let aiCaption: string | null = null;
  if (PHOTO_VISION_FRIENDLY_MIME.has(file.type) && file.size <= PHOTO_MAX_TAGGABLE_BYTES) {
    try {
      const dataUrl = `data:${file.type};base64,${Buffer.from(arrayBuffer).toString('base64')}`;
      const result = await tagPhoto(
        { imageDataUrl: dataUrl, takenAtIso },
        {
          familyGroupId,
          ...(childId ? { childId } : {}),
          actorUserId: userData.user.id,
        },
      );
      aiTags = result.tags;
      aiCaption = result.caption.length > 0 ? result.caption : null;
    } catch {
      // best-effort; si falla, dejamos tags=[] y caption=null.
    }
  }

  // 4. Insertar media_items.
  const { error: insertErr } = await sb.from('media_items').insert({
    child_id: childId,
    family_group_id: familyGroupId,
    album_id: albumId,
    storage_path: storagePath,
    mime_type: file.type,
    size_bytes: file.size,
    caption: aiCaption,
    tags: aiTags,
    taken_at: takenAtIso,
    created_by: userData.user.id,
  });
  if (insertErr) {
    // Si el insert falla, borramos el blob para no dejar huérfano.
    await supabase.storage.from(PHOTOS_BUCKET).remove([storagePath]);
    return { ok: false, error: 'Subimos la foto pero no pudimos guardarla en el álbum.' };
  }

  // 5. Signed URL para mostrar en el chat (1 hora, alcanza para el turno).
  const { data: signed } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .createSignedUrl(storagePath, 3600);
  const photoUrl = signed?.signedUrl ?? '';

  // 6. Persistir el par user→assistant en chat_messages.
  const userMessage = aiCaption ? `📷 Foto subida — "${aiCaption}"` : '📷 Foto subida';
  const tagsLine = aiTags.length > 0 ? ` Te puse tags: ${aiTags.slice(0, 5).join(', ')}.` : '';
  const assistantReply = `Listo, la guardé en el álbum **${albumName}**.${tagsLine} La podés ver y compartir desde /album.`;

  await persistMessages(supabase, userData.user.id, familyGroupId, [
    { role: 'user', content: userMessage },
    { role: 'assistant', content: assistantReply },
  ]);

  // Refrescar la grilla del álbum para que la nueva foto aparezca al
  // navegar.
  revalidatePath('/album');

  return {
    ok: true,
    photoUrl,
    albumName,
    tags: aiTags,
    assistantReply,
  };
}
