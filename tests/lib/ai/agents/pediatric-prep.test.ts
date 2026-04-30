import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AIParseError, AIValidationError } from '@/lib/ai/errors';
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
vi.mock('@/lib/ai/logger', () => ({
  logStore: {
    record: (entry: unknown) => recordMock(entry),
    list: vi.fn(),
  },
}));

import {
  generatePediatricPrep,
  pediatricInputSchema,
  pediatricSummarySchema,
} from '@/lib/ai/agents/pediatric-prep';

const validInput = {
  daysBack: 7,
  child: { name: 'Salu', birth_date: '2026-04-15', is_preterm: false },
  period: { fromIso: '2026-04-23T00:00:00Z', toIso: '2026-04-30T00:00:00Z' },
  feeding: {
    total: 12,
    by_type: { breastfeeding: 10, bottle: 2 },
    total_amount_ml: 180,
    sample: [
      {
        occurred_at: '2026-04-25T10:00:00Z',
        type: 'breastfeeding',
        amount_ml: null,
        duration_minutes: 15,
        side: 'left',
      },
    ],
  },
  sleep: {
    total: 23,
    total_minutes_estimated: 360,
    sample: [
      {
        started_at: '2026-04-25T14:00:00Z',
        ended_at: '2026-04-25T15:30:00Z',
        is_nap: true,
        quality: 'good',
      },
    ],
  },
  diaper: {
    total: 18,
    by_type: { wet: 10, both: 8 },
    notes_with_content: ['mucus visible'],
  },
  measurements: [],
  pending_milestones: [{ title: 'Control 1 mes', due_at: '2026-05-15', category: 'control' }],
};

const validSummary = {
  period_label: 'Últimos 7 días',
  headline: 'Buena alimentación con predominio de pecho, sueños cortos.',
  metrics: {
    feeding: '12 tomas en 7 días, ~1.7/día. Predominio pecho.',
    sleep: '23 sueños registrados, ~6h/día estimadas.',
    diaper: '18 pañales, mayoría pis y mixtos.',
    measurement: 'sin mediciones nuevas en este período',
  },
  observations: [
    'Las tomas se concentran a la mañana.',
    'Tres pañales con mucus mencionado en notas.',
  ],
  questions_for_pediatrician: [
    '¿Es esperable que las siestas sean tan cortas?',
    'Vimos pañales con mucus en notas — ¿conviene seguirlo?',
  ],
  pending_milestones: ['Control 1 mes — 15 de mayo'],
};

function mockOK(content: object) {
  callLLMMock.mockResolvedValueOnce({
    content: JSON.stringify(content),
    toolCalls: [],
    finishReason: 'stop',
    model: 'anthropic/claude-haiku-4-5',
    usage: { promptTokens: 1000, completionTokens: 400, totalTokens: 1400 },
    latencyMs: 2500,
  });
}

beforeEach(() => {
  callLLMMock.mockReset();
  recordMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('pediatricInputSchema', () => {
  it('acepta un input bien formado', () => {
    expect(pediatricInputSchema.safeParse(validInput).success).toBe(true);
  });

  it('rechaza daysBack fuera de rango', () => {
    expect(pediatricInputSchema.safeParse({ ...validInput, daysBack: 0 }).success).toBe(false);
    expect(pediatricInputSchema.safeParse({ ...validInput, daysBack: 100 }).success).toBe(false);
  });

  it('exige period.fromIso y toIso', () => {
    const bad = { ...validInput, period: { fromIso: '' } };
    expect(pediatricInputSchema.safeParse(bad).success).toBe(false);
  });
});

describe('pediatricSummarySchema', () => {
  it('acepta una respuesta bien formada', () => {
    expect(pediatricSummarySchema.safeParse(validSummary).success).toBe(true);
  });

  it('rechaza si falta headline', () => {
    const { headline: _h, ...bad } = validSummary;
    expect(pediatricSummarySchema.safeParse(bad).success).toBe(false);
  });

  it('rechaza más de 8 observations', () => {
    const bad = {
      ...validSummary,
      observations: Array.from({ length: 9 }, (_, i) => `obs ${i}`),
    };
    expect(pediatricSummarySchema.safeParse(bad).success).toBe(false);
  });

  it('acepta arrays vacíos en observations y questions', () => {
    const minimal = {
      ...validSummary,
      observations: [],
      questions_for_pediatrician: [],
      pending_milestones: [],
    };
    expect(pediatricSummarySchema.safeParse(minimal).success).toBe(true);
  });
});

describe('generatePediatricPrep', () => {
  it('valida input y devuelve summary parseado', async () => {
    mockOK(validSummary);
    const result = await generatePediatricPrep(validInput);
    expect(result.summary.headline).toContain('Buena alimentación');
    expect(result.meta.totalTokens).toBe(1400);
    expect(result.meta.promptVersion).toBe('pediatric-prep-v1');
  });

  it('lanza AIValidationError si el input no pasa el schema', async () => {
    const bad = { ...validInput, daysBack: -1 };
    await expect(generatePediatricPrep(bad)).rejects.toBeInstanceOf(AIValidationError);
  });

  it('parsea JSON aunque venga envuelto en fences markdown', async () => {
    callLLMMock.mockResolvedValueOnce({
      content: `\`\`\`json\n${JSON.stringify(validSummary)}\n\`\`\``,
      toolCalls: [],
      finishReason: 'stop',
      model: 'anthropic/claude-haiku-4-5',
      usage: { promptTokens: 1000, completionTokens: 400, totalTokens: 1400 },
      latencyMs: 2500,
    });
    const result = await generatePediatricPrep(validInput);
    expect(result.summary.headline).toBeTruthy();
  });

  it('lanza AIParseError si el LLM devuelve algo no JSON', async () => {
    callLLMMock.mockResolvedValueOnce({
      content: 'no soy json',
      toolCalls: [],
      finishReason: 'stop',
      model: 'anthropic/claude-haiku-4-5',
      usage: { promptTokens: 1000, completionTokens: 50, totalTokens: 1050 },
      latencyMs: 1200,
    });
    await expect(generatePediatricPrep(validInput)).rejects.toBeInstanceOf(AIParseError);
  });

  it('loguea el snippet del raw content cuando el parse falla', async () => {
    callLLMMock.mockResolvedValueOnce({
      content: 'tampoco soy json válido',
      toolCalls: [],
      finishReason: 'stop',
      model: 'anthropic/claude-haiku-4-5',
      usage: { promptTokens: 1000, completionTokens: 30, totalTokens: 1030 },
      latencyMs: 800,
    });
    await expect(generatePediatricPrep(validInput)).rejects.toBeInstanceOf(AIParseError);
    const entry = recordMock.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(entry.error).toContain('parse failed');
    expect(entry.error).toContain('tampoco soy json');
  });
});

describe('summaryAsPlainText', () => {
  it('arma un texto coherente con secciones', async () => {
    const { summaryAsPlainText } = await import(
      '@/app/(app)/cuidar/control/_components/summary-generator'
    );
    const text = summaryAsPlainText(validSummary);
    expect(text).toContain('ÚLTIMOS 7 DÍAS');
    expect(text).toContain('CÓMO VIENE LA COSA');
    expect(text).toContain('OBSERVACIONES');
    expect(text).toContain('PARA PREGUNTARLE A LA PEDIATRA');
    expect(text).toContain('PENDIENTES');
    expect(text).toContain('No reemplaza la consulta');
  });
});
