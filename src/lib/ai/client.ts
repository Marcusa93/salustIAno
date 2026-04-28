import 'server-only';

import { env } from '@/lib/env';
import { AIConfigError, AINetworkError, AIProviderError } from './errors';
import type { ChatRequest, ChatResponse } from './types';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const REQUEST_TIMEOUT_MS = 60_000;

interface OpenRouterChoice {
  message?: { content?: string };
}

interface OpenRouterUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

interface OpenRouterResponse {
  choices?: OpenRouterChoice[];
  usage?: OpenRouterUsage;
  model?: string;
}

/**
 * Llama al endpoint de chat completions de OpenRouter y devuelve un
 * `ChatResponse` normalizado.
 *
 * Sin retry, sin streaming en este commit. Timeout de 60s vía AbortController.
 *
 * @throws {AIConfigError} si OPENROUTER_API_KEY no está seteada.
 * @throws {AINetworkError} si fetch falla (timeout, DNS, conexión cortada).
 * @throws {AIProviderError} si el provider respondió con status no-OK.
 */
export async function callLLM(request: ChatRequest): Promise<ChatResponse> {
  if (!env.OPENROUTER_API_KEY) {
    throw new AIConfigError(
      'OPENROUTER_API_KEY no está configurada. Agregala en .env.local antes de invocar callLLM.',
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const startedAt = Date.now();

  let response: Response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': env.NEXT_PUBLIC_APP_URL,
        'X-Title': 'Salu',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        response_format: request.responseFormat ? { type: request.responseFormat } : undefined,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    throw new AINetworkError(
      err instanceof Error
        ? `Fallo en fetch a OpenRouter: ${err.message}`
        : 'Fallo en fetch a OpenRouter.',
      err,
    );
  }
  clearTimeout(timeout);

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new AIProviderError(response.status, body);
  }

  const data = (await response.json()) as OpenRouterResponse;
  const latencyMs = Date.now() - startedAt;

  const content = data.choices?.[0]?.message?.content ?? '';
  const usage = data.usage ?? {};

  return {
    content,
    model: data.model ?? request.model,
    usage: {
      promptTokens: usage.prompt_tokens ?? 0,
      completionTokens: usage.completion_tokens ?? 0,
      totalTokens:
        usage.total_tokens ?? (usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0),
    },
    latencyMs,
  };
}
