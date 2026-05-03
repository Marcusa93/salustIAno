'use server';

import { generateStory, storyInputSchema } from '@/lib/ai/agents';
import {
  AIConfigError,
  AIGuardrailError,
  AINetworkError,
  AIParseError,
  AIProviderError,
  AIValidationError,
} from '@/lib/ai/errors';
import { logStore } from '@/lib/ai/logger';
import { createClient } from '@/lib/supabase/server';
import type { StoryFormState } from './shared';

/**
 * Server Action que recibe el input crudo del formulario, valida con el
 * mismo schema Zod del agente y delega a `generateStory`. Mapea cada tipo
 * de error a un mensaje rioplatense para el toast del cliente.
 *
 * Nunca tira: siempre devuelve un `StoryFormState` discriminado para que
 * la UI haga render basado en el discriminador, sin try/catch encima.
 */
export async function createStoryAction(input: unknown): Promise<StoryFormState> {
  const parsed = storyInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: 'error',
      error: {
        type: 'validation',
        message: 'Revisá los datos del formulario.',
      },
    };
  }

  try {
    const result = await generateStory(parsed.data);

    // Persistir en biblioteca (best-effort, NO debe romper la respuesta
    // si la base/auth fallan o estamos en tests sin Supabase mockeado).
    void persistStory(parsed.data, result);

    return {
      status: 'success',
      story: result.output,
      meta: {
        model: result.meta.model,
        tokens: result.meta.tokens,
        latencyMs: result.meta.latencyMs,
        promptVersion: result.meta.promptVersion,
      },
    };
  } catch (err) {
    if (err instanceof AIValidationError) {
      return {
        status: 'error',
        error: { type: 'validation', message: 'Revisá los datos del formulario.' },
      };
    }
    if (err instanceof AIConfigError) {
      return {
        status: 'error',
        error: { type: 'config', message: 'Falta configurar el modelo de IA. Avisale al admin.' },
      };
    }
    if (err instanceof AINetworkError) {
      return {
        status: 'error',
        error: {
          type: 'network',
          message: 'No pudimos conectar con la IA. Probá de nuevo en un rato.',
        },
      };
    }
    if (err instanceof AIProviderError) {
      return {
        status: 'error',
        error: { type: 'provider', message: 'El generador tuvo un problema. Intentá de nuevo.' },
      };
    }
    if (err instanceof AIParseError) {
      return {
        status: 'error',
        error: {
          type: 'parse',
          message: 'La respuesta no vino como esperábamos. Probá generar otra vez.',
        },
      };
    }
    if (err instanceof AIGuardrailError) {
      return {
        status: 'error',
        error: {
          type: 'guardrail',
          message: 'El cuento generado no pasó nuestros filtros de seguridad. Generamos otro.',
        },
      };
    }
    return {
      status: 'error',
      error: { type: 'provider', message: 'Algo salió mal generando el cuento. Probá de nuevo.' },
    };
  }
}

/**
 * Persiste un cuento en la tabla `stories` best-effort. Si la base falla,
 * loguea pero no tira — el cuento ya fue generado y mostrado.
 */
async function persistStory(
  input: unknown,
  result: {
    output: { title: string; story: string; moralOrTheme: string; charactersUsed: string[] };
    meta: unknown;
  },
): Promise<void> {
  try {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data: membership } = await supabase
      .from('family_memberships')
      .select('family_group_id')
      .eq('user_id', userData.user.id)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();
    if (!membership?.family_group_id) return;

    const { data: child } = await supabase
      .from('child_profiles')
      .select('id')
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    // biome-ignore lint/suspicious/noExplicitAny: types stale hasta regenerar.
    const sb = supabase as any;
    const { error: insertErr } = await sb.from('stories').insert({
      child_id: child?.id ?? null,
      family_group_id: membership.family_group_id,
      title: result.output.title,
      story: result.output.story,
      moral_or_theme: result.output.moralOrTheme,
      characters_used: result.output.charactersUsed,
      input_meta: input,
      generation_meta: result.meta,
      created_by: userData.user.id,
    });
    if (insertErr) {
      await logStore.record({
        agent: 'story-persist',
        model: '-',
        promptVersion: 'story-persist-v1',
        error: `insert failed: ${insertErr.message}`,
        actorUserId: userData.user.id,
      });
    }
  } catch (err) {
    // Best-effort: si Supabase no responde, no rompemos el flow del user.
    await logStore.record({
      agent: 'story-persist',
      model: '-',
      promptVersion: 'story-persist-v1',
      error: `unexpected: ${err instanceof Error ? err.message : 'unknown'}`,
    });
  }
}

// ============================================================================
// Biblioteca
// ============================================================================

export interface StoryLibraryEntry {
  id: string;
  title: string;
  story: string;
  moralOrTheme: string;
  charactersUsed: string[];
  createdAt: string;
}

export async function listStoriesAction(): Promise<StoryLibraryEntry[]> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];

  // biome-ignore lint/suspicious/noExplicitAny: types stale hasta regenerar.
  const sb = supabase as any;
  const { data, error } = await sb
    .from('stories')
    .select('id, title, story, moral_or_theme, characters_used, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(60);

  if (error || !data) return [];
  return (data as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    title: r.title as string,
    story: r.story as string,
    moralOrTheme: (r.moral_or_theme as string) ?? '',
    charactersUsed: (r.characters_used as string[]) ?? [],
    createdAt: r.created_at as string,
  }));
}

export async function deleteStoryAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof id !== 'string' || id.length === 0) {
    return { ok: false, error: 'ID inválido.' };
  }
  const supabase = await createClient();
  // biome-ignore lint/suspicious/noExplicitAny: types stale.
  const sb = supabase as any;
  const { error } = await sb
    .from('stories')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { ok: false, error: 'No pudimos borrar el cuento.' };
  return { ok: true };
}
