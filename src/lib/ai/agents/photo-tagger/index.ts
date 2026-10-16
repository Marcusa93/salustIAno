import 'server-only';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { type AgentLogContext, runStructuredAgent } from '@/lib/ai/agents/structured-agent';
import { modelProfileFor } from '@/lib/ai/models';
import type { ChatMessage, ContentPart } from '@/lib/ai/types';
import { FALLBACK_TAG, type PhotoTags, photoTagsSchema } from './schema';

export { FALLBACK_TAG, photoTagsSchema } from './schema';
export type { PhotoTags } from './schema';

const AGENT_NAME = 'photo-tagger';
const PROMPT_VERSION = 'photo-tagger-v1';

const SYSTEM_PROMPT = readFileSync(
  join(process.cwd(), 'src/lib/ai/agents/photo-tagger/prompt.md'),
  'utf8',
);

export interface PhotoTaggerInput {
  /**
   * Imagen a etiquetar. Aceptamos data URL (`data:image/jpeg;base64,…`) o
   * URL pública. El caller elige según si pasa el buffer en memoria o un
   * link firmado.
   */
  imageDataUrl: string;
  /**
   * Pista opcional sobre la fecha de la foto, usada solo para que el modelo
   * decida si tiene sentido marcar `bebe` o todavía estamos en `panza`.
   */
  takenAtIso?: string;
}

export interface PhotoTaggerOutput {
  tags: string[];
  caption: string;
  meta: {
    model: string;
    promptVersion: string;
    totalTokens: number;
    latencyMs: number;
  };
}

/**
 * Etiqueta una foto con 3-5 tags y un caption corto, en castellano rioplatense.
 *
 * Pipeline calcado de diaper-vision:
 *   1. Construye el mensaje multimodal (texto + imagen).
 *   2. Llama al LLM con `responseFormat: 'json_object'`.
 *   3. Parsea + valida con Zod (AIParseError si falla) y aplica guardrails.
 *   4. Loguea metadata en ai_logs (sin la imagen).
 *
 * Pensado para correr "best-effort" desde uploadPhotosAction. El caller debería
 * envolver la llamada en try/catch y caer al array vacío si algo explota — el
 * usuario puede tagear a mano siempre.
 */
export async function tagPhoto(
  input: PhotoTaggerInput,
  context: AgentLogContext = {},
): Promise<PhotoTaggerOutput> {
  const userParts: ContentPart[] = [
    {
      type: 'text',
      text: input.takenAtIso
        ? `Fecha aproximada de la foto: ${input.takenAtIso}. Etiquetá la imagen.`
        : 'Etiquetá esta imagen.',
    },
    {
      type: 'image_url',
      image_url: { url: input.imageDataUrl, detail: 'low' },
    },
  ];

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userParts },
  ];

  const { output, meta } = await runStructuredAgent({
    agent: AGENT_NAME,
    promptVersion: PROMPT_VERSION,
    profile: modelProfileFor(AGENT_NAME),
    messages,
    outputSchema: photoTagsSchema,
    parseErrorMessage: 'No pudimos interpretar las etiquetas de la foto.',
    context,
  });

  return {
    tags: normalizeTags(output.tags),
    caption: output.caption.trim().slice(0, 160),
    meta,
  };
}

/**
 * Normaliza tags: minúsculas, trim, sin duplicados, sin signos raros, máx 5.
 * Si después del filtro queda vacío, devolvemos el FALLBACK_TAG para que la
 * foto siempre tenga al menos uno y se pueda encontrar.
 */
function normalizeTags(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of raw) {
    const cleaned = t
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleaned.length === 0 || cleaned.length > 50) continue;
    if (seen.has(cleaned)) continue;
    seen.add(cleaned);
    out.push(cleaned);
    if (out.length >= 5) break;
  }
  return out.length > 0 ? out : [FALLBACK_TAG];
}
