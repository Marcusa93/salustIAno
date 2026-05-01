'use server';

import {
  createDiaperAction,
  createFeedingAction,
  createSleepAction,
} from '@/app/(app)/cuidar/eventos/actions';
import { salustiaChat } from '@/lib/ai/agents';
import {
  type Proposal,
  proposalSchema,
  summarizeProposal,
} from '@/lib/ai/agents/salustia/proposals';
import { AIConfigError, AIError, AINetworkError, AIProviderError } from '@/lib/ai/errors';
import type { ChatMessage } from '@/lib/ai/types';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

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

  try {
    const result = await salustiaChat({ messages });
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
    const result = await createFeedingAction({
      occurred_at: new Date(proposal.occurred_at).toISOString(),
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
    return { ok: true, eventId: result.id, summary: summarizeProposal(proposal) };
  }

  if (proposal.kind === 'sleep') {
    const result = await createSleepAction({
      started_at: new Date(proposal.started_at).toISOString(),
      ended_at: proposal.ended_at ? new Date(proposal.ended_at).toISOString() : '',
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
    return { ok: true, eventId: result.id, summary: summarizeProposal(proposal) };
  }

  if (proposal.kind === 'diaper') {
    const result = await createDiaperAction({
      occurred_at: new Date(proposal.occurred_at).toISOString(),
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
    return { ok: true, eventId: result.id, summary: summarizeProposal(proposal) };
  }

  // proposal.kind === 'note' — insertamos inline para evitar el redirect
  // del createNoteAction (ese está pensado para el flow de la página /notas).
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
        ? new Date(proposal.occurred_at).toISOString()
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
  return { ok: true, eventId: noteData.id, summary: summarizeProposal(proposal) };
}
