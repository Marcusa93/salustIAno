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
    return {
      ok: true,
      reply: result.reply,
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
function babyifyMedicalDeflect(original: string): string {
  return [
    'Mami, eso es para preguntarle a la pediatra — yo soy un bebé y no puedo opinar de salud.',
    'Si querés te muestro lo que ya tenés anotado de mí.',
  ].join(' ');
}
