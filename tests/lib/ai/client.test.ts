import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AIConfigError, AINetworkError, AIProviderError } from '@/lib/ai/errors';

// Mockeamos env.ts para controlar OPENROUTER_API_KEY por test.
vi.mock('@/lib/env', () => ({
  env: {
    OPENROUTER_API_KEY: 'sk-test-key',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  },
}));

import { callLLM } from '@/lib/ai/client';
import { env as mockEnv } from '@/lib/env';

const okResponse = {
  ok: true,
  json: async () => ({
    model: 'anthropic/claude-haiku-4-5',
    choices: [{ message: { content: '{"hello":"world"}' } }],
    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
  }),
} as unknown as Response;

describe('callLLM', () => {
  beforeEach(() => {
    (mockEnv as { OPENROUTER_API_KEY?: string }).OPENROUTER_API_KEY = 'sk-test-key';
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('devuelve ChatResponse válido y latencyMs >= 0', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(okResponse);

    const res = await callLLM({
      model: 'anthropic/claude-haiku-4-5',
      messages: [{ role: 'user', content: 'hola' }],
    });

    expect(res.content).toBe('{"hello":"world"}');
    expect(res.usage).toEqual({ promptTokens: 10, completionTokens: 20, totalTokens: 30 });
    expect(res.latencyMs).toBeGreaterThanOrEqual(0);
    expect(res.model).toBe('anthropic/claude-haiku-4-5');
  });

  it('envía response_format para requests de solo texto', async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(okResponse);

    await callLLM({
      model: 'anthropic/claude-haiku-4-5',
      messages: [{ role: 'user', content: 'hola' }],
      responseFormat: 'json_object',
    });

    const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    const body = JSON.parse(init.body);
    expect(body.response_format).toEqual({ type: 'json_object' });
  });

  it('omite response_format cuando el request incluye imagen', async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(okResponse);

    await callLLM({
      model: 'anthropic/claude-haiku-4-5',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'analizá la foto' },
            {
              type: 'image_url',
              image_url: { url: 'data:image/jpeg;base64,/9j/4AAQ', detail: 'low' },
            },
          ],
        },
      ],
      responseFormat: 'json_object',
    });

    const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    const body = JSON.parse(init.body);
    expect(body.response_format).toBeUndefined();
  });

  it('mapea fetch.ok=false a AIProviderError con status', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => 'rate limited',
    } as unknown as Response);

    await expect(
      callLLM({
        model: 'anthropic/claude-haiku-4-5',
        messages: [{ role: 'user', content: 'hola' }],
      }),
    ).rejects.toMatchObject({
      name: 'AIProviderError',
      status: 429,
    });
  });

  it('mapea fetch que tira a AINetworkError', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new TypeError('socket hang up'),
    );

    const promise = callLLM({
      model: 'anthropic/claude-haiku-4-5',
      messages: [{ role: 'user', content: 'hola' }],
    });

    await expect(promise).rejects.toBeInstanceOf(AINetworkError);
  });

  it('tira AIConfigError si OPENROUTER_API_KEY no está configurada', async () => {
    (mockEnv as { OPENROUTER_API_KEY?: string }).OPENROUTER_API_KEY = undefined;

    await expect(
      callLLM({
        model: 'anthropic/claude-haiku-4-5',
        messages: [{ role: 'user', content: 'hola' }],
      }),
    ).rejects.toBeInstanceOf(AIConfigError);
  });

  it('AIProviderError trunca el body a 500 chars', async () => {
    const huge = 'x'.repeat(2000);
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => huge,
    } as unknown as Response);

    try {
      await callLLM({
        model: 'anthropic/claude-haiku-4-5',
        messages: [{ role: 'user', content: 'hola' }],
      });
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(AIProviderError);
      const provErr = err as AIProviderError;
      expect(provErr.body.length).toBeLessThanOrEqual(501); // 500 + ellipsis
    }
  });
});
