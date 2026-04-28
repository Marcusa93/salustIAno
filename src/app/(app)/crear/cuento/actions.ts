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
