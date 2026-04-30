import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AIParseError } from '@/lib/ai/errors';
import type { ChatResponse } from '@/lib/ai/types';

const callLLMMock = vi.fn<(req: unknown) => Promise<ChatResponse>>(async () => ({
  content: '',
  toolCalls: [],
  finishReason: 'stop',
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

import {
  KNOWN_COLORS,
  KNOWN_CONSISTENCIES,
  analyzeDiaperPhoto,
  diaperAnalysisSchema,
} from '@/lib/ai/agents/diaper-vision';

const validAnalysis = {
  color: 'amarillo mostaza',
  consistency: 'pastosa',
  observations:
    'Color amarillo mostaza homogéneo, consistencia pastosa propia de bebé que toma pecho.',
  alarm: false,
  alarm_reason: '',
  recommendation:
    'Probablemente sea normal. Si te quedás dudando, anotalo y comentale al pediatra.',
};

function mockLLMOK(content: object) {
  callLLMMock.mockResolvedValueOnce({
    content: JSON.stringify(content),
    toolCalls: [],
    finishReason: 'stop',
    model: 'anthropic/claude-haiku-4-5',
    usage: { promptTokens: 200, completionTokens: 100, totalTokens: 300 },
    latencyMs: 800,
  });
}

beforeEach(() => {
  callLLMMock.mockReset();
  recordMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('diaperAnalysisSchema', () => {
  it('acepta una respuesta bien formada', () => {
    expect(diaperAnalysisSchema.safeParse(validAnalysis).success).toBe(true);
  });

  it('rechaza si falta color', () => {
    const { color: _color, ...bad } = validAnalysis;
    expect(diaperAnalysisSchema.safeParse(bad).success).toBe(false);
  });

  it('rechaza alarm que no sea boolean', () => {
    expect(diaperAnalysisSchema.safeParse({ ...validAnalysis, alarm: 'true' }).success).toBe(false);
  });

  it('rechaza observations vacío', () => {
    expect(diaperAnalysisSchema.safeParse({ ...validAnalysis, observations: '' }).success).toBe(
      false,
    );
  });

  it('rechaza observations excesivamente larga', () => {
    const huge = 'x'.repeat(801);
    expect(diaperAnalysisSchema.safeParse({ ...validAnalysis, observations: huge }).success).toBe(
      false,
    );
  });

  it('exporta los enums KNOWN_COLORS y KNOWN_CONSISTENCIES', () => {
    expect(KNOWN_COLORS).toContain('amarillo mostaza');
    expect(KNOWN_COLORS).toContain('otro');
    expect(KNOWN_CONSISTENCIES).toContain('pastosa');
    expect(KNOWN_CONSISTENCIES).toContain('otra');
  });
});

describe('analyzeDiaperPhoto', () => {
  const dataUrl = 'data:image/jpeg;base64,/9j/4AAQ';

  it('parsea el JSON del LLM y lo devuelve estructurado', async () => {
    mockLLMOK(validAnalysis);
    const result = await analyzeDiaperPhoto({ imageDataUrl: dataUrl });
    expect(result.analysis.color).toBe('amarillo mostaza');
    expect(result.analysis.alarm).toBe(false);
    expect(result.meta.totalTokens).toBe(300);
    expect(result.meta.promptVersion).toBe('diaper-vision-v1');
  });

  it('arma el mensaje user como ContentPart[] con imagen + texto', async () => {
    mockLLMOK(validAnalysis);
    await analyzeDiaperPhoto({ imageDataUrl: dataUrl, contextNotes: 'recién empezó con avena' });
    const req = callLLMMock.mock.calls[0]?.[0] as {
      messages: Array<{ role: string; content: unknown }>;
    };
    const userMsg = req.messages.find((m) => m.role === 'user');
    expect(Array.isArray(userMsg?.content)).toBe(true);
    const parts = userMsg?.content as Array<{ type: string }>;
    expect(parts.some((p) => p.type === 'text')).toBe(true);
    expect(parts.some((p) => p.type === 'image_url')).toBe(true);
  });

  it('lanza AIParseError si el LLM devuelve JSON malformado', async () => {
    callLLMMock.mockResolvedValueOnce({
      content: 'no soy json',
      toolCalls: [],
      finishReason: 'stop',
      model: 'anthropic/claude-haiku-4-5',
      usage: { promptTokens: 200, completionTokens: 50, totalTokens: 250 },
      latencyMs: 500,
    });
    await expect(analyzeDiaperPhoto({ imageDataUrl: dataUrl })).rejects.toBeInstanceOf(
      AIParseError,
    );
  });

  it('lanza AIParseError si el JSON no respeta el schema', async () => {
    mockLLMOK({ color: 'verde' }); // faltan campos
    await expect(analyzeDiaperPhoto({ imageDataUrl: dataUrl })).rejects.toBeInstanceOf(
      AIParseError,
    );
  });

  it('loguea metadata en éxito (sin imagen ni texto)', async () => {
    mockLLMOK(validAnalysis);
    await analyzeDiaperPhoto(
      { imageDataUrl: dataUrl },
      { familyGroupId: 'fam-1', actorUserId: 'user-1' },
    );
    expect(recordMock).toHaveBeenCalled();
    const entry = recordMock.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(entry.agent).toBe('diaper-vision');
    expect(entry.familyGroupId).toBe('fam-1');
    expect(entry.actorUserId).toBe('user-1');
    expect(entry.promptTokens).toBe(200);
  });
});
