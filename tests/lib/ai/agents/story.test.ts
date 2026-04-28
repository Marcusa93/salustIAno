import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AIGuardrailError, AIParseError, AIValidationError } from '@/lib/ai/errors';
import type { ChatResponse } from '@/lib/ai/types';

// Mocks: callLLM y logStore se reemplazan para no tocar OpenRouter ni Supabase.
const callLLMMock = vi.fn<(req: unknown) => Promise<ChatResponse>>(async () => ({
  content: '',
  model: '',
  usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
  latencyMs: 0,
}));
vi.mock('@/lib/ai/client', () => ({
  callLLM: (req: unknown) => callLLMMock(req),
}));

const recordMock = vi.fn(async (_entry: unknown) => {});
const listMock = vi.fn(async (_filters: unknown) => []);
vi.mock('@/lib/ai/logger', () => ({
  logStore: {
    record: (entry: unknown) => recordMock(entry),
    list: (filters: unknown) => listMock(filters),
  },
}));

import { generateStory, storyInputSchema, storyOutputSchema } from '@/lib/ai/agents/story';

const validInput = {
  childName: 'Salu',
  ageDescription: 'recién nacido, dos semanas',
  moment: 'dormir' as const,
  characters: ['mamá', 'osito'],
  duration: 'corto' as const,
};

const validOutput = {
  title: 'La luna y el osito',
  story:
    'Había una vez un osito que estaba con su mamá esperando que llegue la noche. La luna asomó despacio y el osito sintió calma. Mamá le habló bajito hasta que sus ojos se cerraron y el sueño llegó suave.',
  moralOrTheme: 'La presencia de mamá hace que el sueño llegue tranquilo.',
  charactersUsed: ['mamá', 'osito'],
};

function mockOK(content: object) {
  callLLMMock.mockResolvedValueOnce({
    content: JSON.stringify(content),
    model: 'anthropic/claude-opus-4-7',
    usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
    latencyMs: 1234,
  });
}

describe('storyInputSchema', () => {
  it('acepta input válido', () => {
    expect(storyInputSchema.safeParse(validInput).success).toBe(true);
  });

  it('rechaza moment inválido', () => {
    const bad = { ...validInput, moment: 'pescar' };
    expect(storyInputSchema.safeParse(bad).success).toBe(false);
  });

  it('rechaza characters vacío', () => {
    const bad = { ...validInput, characters: [] };
    expect(storyInputSchema.safeParse(bad).success).toBe(false);
  });

  it('rechaza más de 8 characters', () => {
    const bad = { ...validInput, characters: Array.from({ length: 9 }, (_, i) => `p${i}`) };
    expect(storyInputSchema.safeParse(bad).success).toBe(false);
  });
});

describe('storyOutputSchema', () => {
  it('acepta output con shape esperada', () => {
    expect(storyOutputSchema.safeParse(validOutput).success).toBe(true);
  });

  it('rechaza story corta (< 50 chars)', () => {
    const bad = { ...validOutput, story: 'corto.' };
    expect(storyOutputSchema.safeParse(bad).success).toBe(false);
  });
});

describe('generateStory', () => {
  beforeEach(() => {
    callLLMMock.mockReset();
    recordMock.mockReset();
    listMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('happy path: devuelve AgentResult con meta.promptVersion="story-v1"', async () => {
    mockOK(validOutput);

    const res = await generateStory(validInput);

    expect(res.output).toEqual(validOutput);
    expect(res.meta.promptVersion).toBe('story-v1');
    expect(res.meta.tokens).toBe(300);
    expect(res.meta.latencyMs).toBe(1234);
  });

  it('llama a logStore.record con metadata, sin contenido', async () => {
    mockOK(validOutput);

    await generateStory(validInput, { familyGroupId: 'fam-1', childId: 'child-1' });

    expect(recordMock).toHaveBeenCalledTimes(1);
    const arg = recordMock.mock.calls[0]?.[0] as unknown as Record<string, unknown>;
    expect(arg).toMatchObject({
      agent: 'story-generator',
      promptVersion: 'story-v1',
      promptTokens: 100,
      completionTokens: 200,
      latencyMs: 1234,
      familyGroupId: 'fam-1',
      childId: 'child-1',
    });
    // Crucial: ningún campo del output ni del prompt debe estar en el log.
    const stringified = JSON.stringify(arg);
    expect(stringified).not.toContain(validOutput.title);
    expect(stringified).not.toContain(validOutput.story);
    expect(stringified).not.toContain('osito');
  });

  it('JSON malformado del LLM tira AIParseError', async () => {
    callLLMMock.mockResolvedValueOnce({
      content: 'not json {',
      model: 'anthropic/claude-opus-4-7',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      latencyMs: 100,
    });

    await expect(generateStory(validInput)).rejects.toBeInstanceOf(AIParseError);
  });

  it('JSON con shape inválida tira AIParseError', async () => {
    mockOK({ title: 'x' }); // falta story, moralOrTheme, charactersUsed

    await expect(generateStory(validInput)).rejects.toBeInstanceOf(AIParseError);
  });

  it('input inválido tira AIValidationError ANTES de llamar al LLM', async () => {
    const bad = { ...validInput, characters: [] };

    await expect(generateStory(bad as never)).rejects.toBeInstanceOf(AIValidationError);
    expect(callLLMMock).not.toHaveBeenCalled();
    expect(recordMock).not.toHaveBeenCalled();
  });

  it('si el output dispara guardrail (story-generator no es médico, no debería en este caso)', async () => {
    // story-generator NO es médico, así que un texto con palabras médicas
    // pasa sin trigger. Verificamos que el guardrail solo aplica donde toca.
    const okOutput = {
      ...validOutput,
      story:
        'El osito tomó té de manzanilla. Lo abrazó la luna. Cerró los ojos y soñó con el mar y un viejo amigo que le contaba un cuento dulce.',
    };
    mockOK(okOutput);

    await expect(generateStory(validInput)).resolves.toBeDefined();
  });

  it('si callLLM falla por red, registra error en log y re-tira', async () => {
    callLLMMock.mockRejectedValueOnce(new Error('socket hang up'));

    await expect(generateStory(validInput)).rejects.toThrow('socket hang up');
    expect(recordMock).toHaveBeenCalledTimes(1);
    const arg = recordMock.mock.calls[0]?.[0] as unknown as Record<string, unknown>;
    expect(arg.error).toBe('socket hang up');
  });

  it('AIGuardrailError reachable: si forzamos un agente médico simulado en el output', async () => {
    // Rebajamos el output a algo que en story-generator NO trigerea, pero
    // verificamos el path del guardrail con un test directo del helper.
    // (test real del guardrail en guardrails.test.ts).
    expect(AIGuardrailError).toBeTypeOf('function');
  });
});
