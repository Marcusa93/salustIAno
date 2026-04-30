'use server';

import { type DiaperAnalysis, analyzeDiaperPhoto } from '@/lib/ai/agents';
import {
  AIConfigError,
  AIError,
  AINetworkError,
  AIParseError,
  AIProviderError,
} from '@/lib/ai/errors';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_NOTES_LEN = 500;

export type AnalyzeDiaperResult =
  | { ok: true; analysis: DiaperAnalysis; latencyMs: number }
  | {
      ok: false;
      error: {
        type: 'validation' | 'config' | 'network' | 'provider' | 'parse';
        message: string;
      };
    };

/**
 * Recibe la foto del pañal vía FormData (campo `photo`) más un texto opcional
 * de contexto (`notes`). Valida tamaño + mime, convierte a data URL y llama
 * al agente diaper-vision.
 *
 * Importante: la imagen no se persiste en disco ni en Storage. Vive solo
 * en memoria del request mientras dura la inferencia. Cuando agreguemos
 * Supabase Storage en una sesión aparte, el path va a quedar en
 * `diaper_events.photo_path` con RLS por familia.
 */
export async function analyzeDiaperPhotoAction(formData: FormData): Promise<AnalyzeDiaperResult> {
  const file = formData.get('photo');
  const notesRaw = formData.get('notes');

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: { type: 'validation', message: 'Adjuntá una foto.' } };
  }
  if (file.size > MAX_FILE_SIZE) {
    return {
      ok: false,
      error: { type: 'validation', message: 'La foto no puede pesar más de 5 MB.' },
    };
  }
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return {
      ok: false,
      error: {
        type: 'validation',
        message: 'Formato no permitido. Usá JPG, PNG o WEBP.',
      },
    };
  }

  const notes =
    typeof notesRaw === 'string' && notesRaw.trim().length > 0
      ? notesRaw.trim().slice(0, MAX_NOTES_LEN)
      : undefined;

  const buffer = Buffer.from(await file.arrayBuffer());
  const dataUrl = `data:${file.type};base64,${buffer.toString('base64')}`;

  try {
    const startedAt = Date.now();
    const result = await analyzeDiaperPhoto({
      imageDataUrl: dataUrl,
      contextNotes: notes,
    });
    return { ok: true, analysis: result.analysis, latencyMs: Date.now() - startedAt };
  } catch (err) {
    if (err instanceof AIConfigError) {
      return {
        ok: false,
        error: { type: 'config', message: 'Falta configurar la IA. Avisale al admin.' },
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
        error: { type: 'provider', message: 'La IA tuvo un problema. Intentá de nuevo.' },
      };
    }
    if (err instanceof AIParseError) {
      return {
        ok: false,
        error: { type: 'parse', message: 'La IA devolvió algo raro. Probá con otra foto.' },
      };
    }
    if (err instanceof AIError) {
      return { ok: false, error: { type: 'provider', message: err.message } };
    }
    return {
      ok: false,
      error: { type: 'provider', message: 'Algo salió mal. Probá de nuevo.' },
    };
  }
}
