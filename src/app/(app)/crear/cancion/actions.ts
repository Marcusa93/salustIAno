'use server';

import { generateLullaby, lullabyInputSchema } from '@/lib/ai/agents';
import {
  AIConfigError,
  AIGuardrailError,
  AINetworkError,
  AIParseError,
  AIProviderError,
  AIValidationError,
} from '@/lib/ai/errors';
import type { LullabyFormState } from './shared';

/**
 * Server Action que recibe el input del form, valida con el mismo schema
 * Zod del agente y delega a `generateLullaby`. Mapea cada error a un
 * mensaje rioplatense para el toast del cliente.
 *
 * Nunca tira: siempre devuelve un `LullabyFormState` discriminado.
 */
export async function createLullabyAction(input: unknown): Promise<LullabyFormState> {
  const parsed = lullabyInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: 'error',
      error: { type: 'validation', message: 'Revisá los datos del formulario.' },
    };
  }

  try {
    const result = await generateLullaby(parsed.data);
    return {
      status: 'success',
      lullaby: result.output,
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
          message: 'La canción no vino como esperábamos. Probá generar otra vez.',
        },
      };
    }
    if (err instanceof AIGuardrailError) {
      return {
        status: 'error',
        error: {
          type: 'guardrail',
          message: 'La canción no pasó nuestros filtros. Generamos otra.',
        },
      };
    }
    return {
      status: 'error',
      error: { type: 'provider', message: 'Algo salió mal generando la canción. Probá de nuevo.' },
    };
  }
}
