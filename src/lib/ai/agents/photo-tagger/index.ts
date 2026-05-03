import 'server-only';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { callLLM } from '@/lib/ai/client';
import { AIParseError } from '@/lib/ai/errors';
import { extractJsonObject, truncateForLog } from '@/lib/ai/json';
import { logStore } from '@/lib/ai/logger';
import type { ChatMessage, ContentPart } from '@/lib/ai/types';
import { FALLBACK_TAG, type PhotoTags, photoTagsSchema } from './schema';

export { FALLBACK_TAG, photoTagsSchema } from './schema';
export type { PhotoTags } from './schema';

const AGENT_NAME = 'photo-tagger';
const MODEL = 'anthropic/claude-haiku-4-5';
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

interface AgentContext {
  familyGroupId?: string;
  childId?: string;
  actorUserId?: string;
}

/**
 * Etiqueta una foto con 3-5 tags y un caption corto, en castellano rioplatense.
 *
 * Pipeline calcado de diaper-vision:
 *   1. Construye el mensaje multimodal (texto + imagen).
 *   2. Llama al LLM con `responseFormat: 'json_object'`.
 *   3. Parsea + valida con Zod (AIParseError si falla).
 *   4. Loguea metadata en ai_logs (sin la imagen).
 *
 * Pensado para correr "best-effort" desde uploadPhotosAction. El caller debería
 * envolver la llamada en try/catch y caer al array vacío si algo explota — el
 * usuario puede tagear a mano siempre.
 */
export async function tagPhoto(
  input: PhotoTaggerInput,
  context: AgentContext = {},
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

  let response: Awaited<ReturnType<typeof callLLM>>;
  try {
    response = await callLLM({
      model: MODEL,
      messages,
      temperature: 0.3,
      maxTokens: 300,
      responseFormat: 'json_object',
    });
  } catch (err) {
    await logStore.record({
      agent: AGENT_NAME,
      model: MODEL,
      promptVersion: PROMPT_VERSION,
      error: err instanceof Error ? err.message : 'unknown',
      familyGroupId: context.familyGroupId ?? null,
      childId: context.childId ?? null,
      actorUserId: context.actorUserId ?? null,
    });
    throw err;
  }

  const json = extractJsonObject(response.content ?? '');
  const parseResult = json ? photoTagsSchema.safeParse(json) : null;
  if (!parseResult || !parseResult.success) {
    const reason = parseResult
      ? `schema mismatch: ${parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`
      : 'no se pudo extraer JSON del content';
    const snippet = truncateForLog(response.content ?? '');
    await logStore.record({
      agent: AGENT_NAME,
      model: response.model,
      promptVersion: PROMPT_VERSION,
      promptTokens: response.usage.promptTokens,
      completionTokens: response.usage.completionTokens,
      latencyMs: response.latencyMs,
      error: `parse failed (${reason}). raw: ${snippet}`,
      familyGroupId: context.familyGroupId ?? null,
      childId: context.childId ?? null,
      actorUserId: context.actorUserId ?? null,
    });
    throw new AIParseError('No pudimos interpretar las etiquetas de la foto.');
  }
  const parsed = parseResult.data;

  await logStore.record({
    agent: AGENT_NAME,
    model: response.model,
    promptVersion: PROMPT_VERSION,
    promptTokens: response.usage.promptTokens,
    completionTokens: response.usage.completionTokens,
    totalTokens: response.usage.totalTokens,
    latencyMs: response.latencyMs,
    familyGroupId: context.familyGroupId ?? null,
    childId: context.childId ?? null,
    actorUserId: context.actorUserId ?? null,
  });

  const cleanTags = normalizeTags(parsed.tags);

  return {
    tags: cleanTags,
    caption: parsed.caption.trim().slice(0, 160),
    meta: {
      model: response.model,
      promptVersion: PROMPT_VERSION,
      totalTokens: response.usage.totalTokens,
      latencyMs: response.latencyMs,
    },
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
