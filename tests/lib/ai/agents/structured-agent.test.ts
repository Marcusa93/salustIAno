import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { AIGuardrailError, AIParseError } from '@/lib/ai/errors';
import type { ChatRequest, ChatResponse } from '@/lib/ai/types';

const callLLMMock = vi.fn<(req: ChatRequest) => Promise<ChatResponse>>();
vi.mock('@/lib/ai/client', () => ({
  callLLM: (req: ChatRequest) => callLLMMock(req),
}));

const recordMock = vi.fn(async (_entry: unknown) => {});
vi.mock('@/lib/ai/logger', () => ({
  logStore: {
    record: (entry: unknown) => recordMock(entry),
    list: async () => [],
  },
}));

import { describeParseFailure, runStructuredAgent } from '@/lib/ai/agents/structured-agent';
import { modelProfileFor } from '@/lib/ai/models';

const schema = z.object({ text: z.string().min(1) });

function respond(content: string, finishReason = 'stop'): void {
  callLLMMock.mockResolvedValueOnce({
    content,
    toolCalls: [],
    finishReason,
    model: 'anthropic/claude-sonnet-5.5',
    usage: { promptTokens: 120, completionTokens: 80, totalTokens: 200 },
    latencyMs: 900,
  });
}

function run(agent = 'pattern-finder') {
  return runStructuredAgent({
    agent,
    promptVersion: 'test-v1',
    profile: modelProfileFor('pattern-finder'),
    messages: [{ role: 'user', content: 'datos privados del bebé' }],
    outputSchema: schema,
    parseErrorMessage: 'No pudimos.',
    context: { familyGroupId: 'fam-1', childId: 'child-1' },
  });
}

beforeEach(() => {
  callLLMMock.mockReset();
  recordMock.mockReset();
});

describe('runStructuredAgent', () => {
  it('manda el perfil del agente: modelo, tope y razonamiento sin devolverlo', async () => {
    respond('{"text":"hola"}');
    await run();

    const req = callLLMMock.mock.calls[0]?.[0];
    const profile = modelProfileFor('pattern-finder');
    expect(req).toMatchObject({
      model: profile.model,
      maxTokens: profile.maxTokens,
      reasoning: { effort: profile.effort, exclude: true },
      responseFormat: 'json_object',
    });
    expect(req?.temperature).toBeUndefined();
  });

  it('happy path: devuelve output + meta y loguea una vez solo metadata', async () => {
    respond('```json\n{"text":"un secreto de la familia"}\n```');
    const res = await run();

    expect(res.output).toEqual({ text: 'un secreto de la familia' });
    expect(res.meta).toEqual({
      model: 'anthropic/claude-sonnet-5.5',
      promptVersion: 'test-v1',
      totalTokens: 200,
      latencyMs: 900,
    });
    expect(recordMock).toHaveBeenCalledTimes(1);
    const entry = JSON.stringify(recordMock.mock.calls[0]?.[0]);
    expect(entry).not.toContain('secreto');
    expect(entry).not.toContain('datos privados');
    expect(recordMock.mock.calls[0]?.[0]).toMatchObject({
      agent: 'pattern-finder',
      promptVersion: 'test-v1',
      promptTokens: 120,
      completionTokens: 80,
      familyGroupId: 'fam-1',
      childId: 'child-1',
    });
  });

  it('parse fallido: AIParseError y log sin el contenido del modelo', async () => {
    respond('Lo siento, el bebé de Marco no puede...', 'length');
    await expect(run()).rejects.toBeInstanceOf(AIParseError);

    expect(recordMock).toHaveBeenCalledTimes(1);
    const entry = recordMock.mock.calls[0]?.[0] as { error: string };
    expect(entry.error).toContain('no se pudo extraer JSON');
    expect(entry.error).toContain('finish=length');
    expect(entry.error).not.toContain('Marco');
  });

  it('schema inválido: loguea rutas y códigos de Zod, no valores', async () => {
    respond('{"text":""}');
    await expect(run()).rejects.toBeInstanceOf(AIParseError);
    const entry = recordMock.mock.calls[0]?.[0] as { error: string };
    expect(entry.error).toContain('text: too_small');
  });

  it('aplica guardrails médicos según el nombre del agente', async () => {
    respond('{"text":"dale paracetamol cada 8 horas"}');
    await expect(run('pediatric-prep')).rejects.toBeInstanceOf(AIGuardrailError);
    expect(recordMock).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(recordMock.mock.calls[0]?.[0])).not.toContain('paracetamol cada');
  });

  it('agente no médico con el mismo texto pasa', async () => {
    respond('{"text":"dale paracetamol cada 8 horas"}');
    await expect(run('story-generator')).resolves.toBeDefined();
  });

  it('error de red: loguea el modelo pedido y re-tira', async () => {
    callLLMMock.mockRejectedValueOnce(new Error('socket hang up'));
    await expect(run()).rejects.toThrow('socket hang up');
    expect(recordMock.mock.calls[0]?.[0]).toMatchObject({
      model: modelProfileFor('pattern-finder').model,
      error: 'socket hang up',
    });
  });
});

describe('describeParseFailure', () => {
  it('sin issues explica que no hubo JSON', () => {
    expect(describeParseFailure(null, { content: 'abc', finishReason: null })).toBe(
      'parse failed (no se pudo extraer JSON) [finish=unknown, chars=3]',
    );
  });

  it('con issues lista ruta y código', () => {
    const msg = describeParseFailure(
      [
        { path: ['observations', 0], code: 'too_big' },
        { path: [], code: 'invalid_type' },
      ],
      { content: '{}', finishReason: 'stop' },
    );
    expect(msg).toBe(
      'parse failed (schema mismatch: observations.0: too_big; (raíz): invalid_type) [finish=stop, chars=2]',
    );
  });
});
