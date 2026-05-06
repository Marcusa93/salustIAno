'use server';

import { salustiaChat } from '@/lib/ai/agents';
import { detectMedicalIntent } from '@/lib/ai/agents/salustia/medical-intent';
import type { Proposal } from '@/lib/ai/agents/salustia/proposals';
import { AIConfigError, AIError, AINetworkError, AIProviderError } from '@/lib/ai/errors';
import { logStore } from '@/lib/ai/logger';
import type { ChatMessage } from '@/lib/ai/types';
import { createClient } from '@/lib/supabase/server';

export type ClientMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string };

export type SendBabyMessageResult =
  | { ok: true; reply: string; proposals: Proposal[]; toolCallsMade: string[] }
  | {
      ok: false;
      error: {
        type: 'config' | 'network' | 'provider' | 'parse' | 'guardrail' | 'validation';
        message: string;
      };
    };

const MAX_HISTORY = 20;
const MAX_INPUT_LEN = 1500;

/**
 * Action que el FloatingSaluChat usa cada turno. Diferencias contra
 * `sendMessageAction` del /chat principal:
 *
 *   1. **Voz `baby`**: el agente habla como Salu en primera persona.
 *   2. **Sin persistencia de historial**: el floating widget es ephemeral —
 *      la conversación vive solo mientras el sheet está abierto. Si la
 *      familia quiere historial persistente, /chat sigue funcionando.
 *   3. **Misma capacidad de proposals + executeProposalAction**: las
 *      acciones se persisten igual que en /chat. La voz solo cambia la
 *      forma del texto, no la mecánica de tools.
 */
export async function sendBabyMessageAction(
  history: ClientMessage[],
): Promise<SendBabyMessageResult> {
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

  // Sesión: no insistimos con persistencia, pero sí necesitamos estar
  // logueados para que las tools puedan resolver familyGroupId.
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { ok: false, error: { type: 'validation', message: 'Sesión expirada.' } };
  }

  // Pre-LLM medical intent guardrail. Si matchea, devolvemos canned reply
  // adaptada a la voz baby (mantiene el deflect, lo dice cariñoso).
  const detection = detectMedicalIntent(last.content);
  if (detection.matched) {
    await logStore.record({
      agent: 'salustia-baby-medical-deflect',
      model: '-',
      promptVersion: 'medical-intent-v1',
      error: `pattern matched: ${detection.pattern}`,
    });
    return {
      ok: true,
      reply: babyifyMedicalDeflect(detection.reply),
      proposals: [],
      toolCallsMade: [],
    };
  }

  try {
    const result = await salustiaChat({ messages, voice: 'baby' });

    // Mismo guard de alucinación que /chat: si Salu (voz baby) dice "ya
    // quedó anotado" pero no llamó a propose_*, pisamos su reply para
    // que la familia pueda corregir el rumbo en lugar de creer que
    // funcionó. Implementación duplicada acá a propósito — no queremos
    // crear una dep transversal entre _floating-salu y /chat por una
    // función chiquita.
    const guarded = applyBabyHallucinationGuard({
      userMessage: last.content,
      reply: result.reply,
      proposalsCount: result.proposals.length,
      toolCallsMade: result.meta.toolCallsMade,
    });

    return {
      ok: true,
      reply: guarded,
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
 * El deflect médico viene escrito en voz "asistente". Lo retocamos suave
 * para que suene como Salu (primera persona, cariñoso) sin cambiar el
 * núcleo del mensaje (que sigue siendo "no soy médico, andá al pediatra").
 */
function babyifyMedicalDeflect(_original: string): string {
  return [
    'Mami, eso es para preguntarle a la pediatra — yo soy un bebé y no puedo opinar de salud.',
    'Si querés te muestro lo que ya tenés anotado de mí.',
  ].join(' ');
}

/**
 * Hallucination guard para el FloatingSalu. Detecta cuando Salu (voz baby)
 * dice "ya quedó anotado" pero no llamó a ningún propose_*. En ese caso,
 * pisamos el reply con uno honesto en primera persona para que la familia
 * vea que tiene que volver a pedirlo.
 */
const ANNOTATION_INTENT_RE_BABY =
  /\b(?:anot[áa]|anota|registr[áa]|registra|cargu[ée]?|cargá|cargas?|sum[áa]|sumá|agreg[áa]|agrega|guard[áa]|guarda)\b/iu;
const HALLUCINATED_CONFIRM_RE_BABY =
  /\b(?:ya\s+(?:est[áa]|qued[óo])\s+(?:anotad[oa]|cargad[oa]|guardad[oa]|registrad[oa])|listo,?\s+(?:anotad[oa]|cargad[oa]|guardad[oa])|anotad[oa]\b|registrad[oa]\b|cargad[oa]\b|qued[óo]\s+anotad[oa]|los?\s+anot[ée]?\b|lo\s+cargu[ée]?\b|lo\s+guard[ée]?\b)/iu;

interface BabyGuardInput {
  userMessage: string;
  reply: string;
  proposalsCount: number;
  toolCallsMade: string[];
}

function applyBabyHallucinationGuard(input: BabyGuardInput): string {
  const wantsAnnotation = ANNOTATION_INTENT_RE_BABY.test(input.userMessage);
  if (!wantsAnnotation) return input.reply;

  const calledPropose = input.toolCallsMade.some((t) => t.startsWith('propose_'));
  if (calledPropose && input.proposalsCount > 0) return input.reply;

  const claimsConfirmed = HALLUCINATED_CONFIRM_RE_BABY.test(input.reply);
  if (!claimsConfirmed) return input.reply;

  void logStore.record({
    agent: 'salustia-baby-hallucination-guard',
    model: '-',
    promptVersion: 'guard-v1',
    error: `claimed_confirm_without_propose: user="${input.userMessage.slice(0, 200)}" reply="${input.reply.slice(0, 200)}"`,
  });

  // Reply en voz baby. La familia tiene que volver a pedirlo con un poco
  // más de detalle.
  return 'Ah, ¿sabés qué? Lo dije pero todavía no tocaste el botón para que quede. Decime de nuevo qué pasó (qué fue, a qué hora) y te muestro la card abajo para confirmar.';
}
