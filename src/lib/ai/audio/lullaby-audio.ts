import 'server-only';

import { env } from '@/lib/env';
import type { LullabyOutput } from '../agents/lullaby-schema';
import { AIConfigError, AINetworkError, AIProviderError } from '../errors';
import { logStore } from '../logger';

/**
 * Generación de audio musical para las nanas de Salu vía AIMLAPI
 * (proxy multi-modelo que expone modelos de música tipo Suno).
 *
 * Modelo elegido: `minimax/music-1.5` — el más barato dentro de los
 * modernos que aceptan prompt + lyrics directos sin requerir upload
 * previo de voz/instrumental de referencia. Genera mp3 con voz
 * cantando la letra que le pasamos.
 *
 * El flujo es asíncrono:
 *   1. POST /v2/generate/audio devuelve generation_id
 *   2. polling cada N segundos a /v2/generate/audio?generation_id=X
 *   3. cuando status=completed devuelve audio.url (mp3 hosted en AIMLAPI)
 *
 * El URL del audio expira (típicamente en horas). Para persistirlo
 * permanentemente habría que descargarlo y subirlo a Supabase Storage —
 * eso queda para otra fase (igual que las fotos de pañal). Por ahora
 * el cliente tiene la URL fresca y puede descargar el mp3 si lo quiere
 * guardar.
 */

const AIMLAPI_BASE = 'https://api.aimlapi.com/v2/generate/audio';
const AGENT_NAME = 'lullaby-audio';
const MODEL = 'minimax/music-1.5';
const PROMPT_VERSION = 'lullaby-audio-v1';

const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 180_000; // 3 min — generación tarda 50-60s, margen.

interface GenerationStartResponse {
  id: string;
  status?: string;
}

interface GenerationStatusResponse {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | string;
  audio_file?: { url?: string };
  audio?: { url?: string } | string;
  result?: { audio_url?: string };
  error?: string | { message?: string };
}

export interface LullabyAudioResult {
  audioUrl: string;
  meta: {
    model: string;
    promptVersion: string;
    latencyMs: number;
    pollAttempts: number;
  };
}

/**
 * Convierte el output estructurado del agente lullaby a un bloque de
 * letra con tags [Verse] / [Chorus] que el modelo de música entiende
 * para diferenciar estrofas y estribillo.
 */
function lullabyToTaggedLyrics(
  lullaby: Pick<LullabyOutput, 'verses' | 'chorus' | 'closing'>,
): string {
  const parts: string[] = [];
  lullaby.verses.forEach((v, i) => {
    parts.push(`[Verse ${i + 1}]`);
    parts.push(v.trim());
  });
  if (lullaby.chorus?.trim()) {
    parts.push('[Chorus]');
    parts.push(lullaby.chorus.trim());
  }
  if (lullaby.closing?.trim()) {
    parts.push('[Outro]');
    parts.push(lullaby.closing.trim());
  }
  return parts.join('\n');
}

/**
 * Construye el prompt de estilo musical en función del mood.
 * Mantenemos los prompts simples y en inglés (el modelo los entiende mejor)
 * — la letra cantada queda en español rioplatense porque es lo que va
 * en el campo `lyrics`.
 */
function moodToStylePrompt(mood: LullabyOutput['mood']): string {
  switch (mood) {
    case 'dulce':
      return 'Soft acoustic lullaby in Spanish, gentle female vocals, warm piano and light strings, slow tempo, intimate and tender, suitable for a baby.';
    case 'jugueton':
      return 'Playful Spanish childrens song, bouncy rhythm, light percussion, cheerful female vocals, ukulele and bells, friendly and warm.';
    case 'calmo':
      return 'Calm Spanish lullaby, slow tempo, breathy female vocals, soft piano and ambient pads, peaceful and meditative.';
    case 'valiente':
      return 'Gentle but uplifting Spanish folk song, acoustic guitar, warm female vocals, light percussion, encouraging and steady.';
  }
}

async function aimlapiFetch(
  path: string,
  options: { method: 'GET' | 'POST'; body?: unknown } = { method: 'GET' },
): Promise<Response> {
  if (!env.AIMLAPI_API_KEY) {
    throw new AIConfigError('AIMLAPI_API_KEY no está configurada en el server.');
  }

  const url = path.startsWith('http')
    ? path
    : `${AIMLAPI_BASE}${path.startsWith('?') ? path : path === '' ? '' : `/${path.replace(/^\//, '')}`}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method,
      headers: {
        Authorization: `Bearer ${env.AIMLAPI_API_KEY}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch (err) {
    throw new AINetworkError(
      `No pudimos contactar AIMLAPI: ${err instanceof Error ? err.message : 'unknown'}`,
      err,
    );
  }

  return response;
}

/**
 * Genera audio musical a partir de una nana ya escrita por el agente
 * lullaby. Devuelve la URL del mp3 hosted o tira un error tipado.
 *
 * Costo: una sola generación al modelo más barato (~$0.05 USD).
 */
export async function generateLullabyAudio(
  lullaby: LullabyOutput,
  context: { actorUserId?: string | null; childId?: string | null } = {},
): Promise<LullabyAudioResult> {
  const startedAt = Date.now();
  const lyrics = lullabyToTaggedLyrics(lullaby);
  const stylePrompt = moodToStylePrompt(lullaby.mood);

  const startResponse = await aimlapiFetch('', {
    method: 'POST',
    body: {
      model: MODEL,
      prompt: stylePrompt,
      lyrics,
    },
  });

  if (!startResponse.ok) {
    const text = await startResponse.text().catch(() => '');
    await logStore.record({
      agent: AGENT_NAME,
      model: MODEL,
      promptVersion: PROMPT_VERSION,
      error: `start failed (${startResponse.status}): ${text.slice(0, 240)}`,
      actorUserId: context.actorUserId ?? null,
      childId: context.childId ?? null,
    });
    throw new AIProviderError(startResponse.status, text);
  }

  const startJson = (await startResponse
    .json()
    .catch(() => null)) as GenerationStartResponse | null;
  const generationId = startJson?.id;
  if (!generationId) {
    throw new AIProviderError(500, 'AIMLAPI no devolvió un id de generación.');
  }

  // Polling con timeout
  let pollAttempts = 0;
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    pollAttempts += 1;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const statusResponse = await aimlapiFetch(`?generation_id=${generationId}`, { method: 'GET' });
    if (!statusResponse.ok) {
      // 4xx/5xx temporal: seguimos intentando hasta el timeout.
      continue;
    }

    const statusJson = (await statusResponse
      .json()
      .catch(() => null)) as GenerationStatusResponse | null;
    if (!statusJson) continue;

    const status = statusJson.status;
    if (status === 'completed' || status === 'success') {
      const audioUrl =
        (typeof statusJson.audio === 'object' ? statusJson.audio?.url : undefined) ??
        statusJson.audio_file?.url ??
        statusJson.result?.audio_url ??
        (typeof statusJson.audio === 'string' ? statusJson.audio : undefined);
      if (!audioUrl) {
        throw new AIProviderError(500, 'AIMLAPI completó pero no devolvió URL del audio.');
      }
      const latencyMs = Date.now() - startedAt;

      await logStore.record({
        agent: AGENT_NAME,
        model: MODEL,
        promptVersion: PROMPT_VERSION,
        latencyMs,
        actorUserId: context.actorUserId ?? null,
        childId: context.childId ?? null,
      });

      return {
        audioUrl,
        meta: {
          model: MODEL,
          promptVersion: PROMPT_VERSION,
          latencyMs,
          pollAttempts,
        },
      };
    }

    if (status === 'failed' || status === 'error') {
      const reason =
        typeof statusJson.error === 'string'
          ? statusJson.error
          : (statusJson.error?.message ?? 'unknown');
      await logStore.record({
        agent: AGENT_NAME,
        model: MODEL,
        promptVersion: PROMPT_VERSION,
        error: `generation failed: ${reason}`,
        actorUserId: context.actorUserId ?? null,
        childId: context.childId ?? null,
      });
      throw new AIProviderError(500, `La generación de audio falló: ${reason}`);
    }
    // status queued/processing: seguir poleando
  }

  // Timeout
  await logStore.record({
    agent: AGENT_NAME,
    model: MODEL,
    promptVersion: PROMPT_VERSION,
    error: `polling timeout after ${pollAttempts} attempts`,
    actorUserId: context.actorUserId ?? null,
    childId: context.childId ?? null,
  });
  throw new AIProviderError(504, 'La generación tardó demasiado. Probá de nuevo.');
}
