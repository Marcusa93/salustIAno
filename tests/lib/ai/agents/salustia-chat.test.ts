import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChatRequest, ChatResponse, TextContentPart } from '@/lib/ai/types';

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

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));

import { chat } from '@/lib/ai/agents/salustia';
import { CLAUDE_MODELS } from '@/lib/ai/models';

// ---- Supabase falso ---------------------------------------------------------

interface QueryResult {
  data: unknown;
  error: null;
}

interface FakeQuery extends Promise<QueryResult> {
  select(): FakeQuery;
  is(): FakeQuery;
  eq(): FakeQuery;
  order(): FakeQuery;
  limit(): FakeQuery;
  gte(): FakeQuery;
  maybeSingle(): Promise<QueryResult>;
}

function query(data: unknown): FakeQuery {
  const result: QueryResult = { data, error: null };
  const builder: FakeQuery = Object.assign(Promise.resolve(result), {
    select: () => builder,
    is: () => builder,
    eq: () => builder,
    order: () => builder,
    limit: () => builder,
    gte: () => builder,
    maybeSingle: () => Promise.resolve(result),
  });
  return builder;
}

const DAY_MS = 86_400_000;
const birthDate = new Date(Date.now() - 154 * DAY_MS).toISOString().slice(0, 10);
const careRows = [
  {
    event_type: 'feeding',
    occurred_at: new Date(Date.now() - 30 * 60_000).toISOString(),
    payload: { type: 'bottle', amount_ml: 120 },
  },
];

const tables: Record<string, unknown> = {
  child_profiles: {
    id: 'child-1',
    name: 'Salustiano',
    birth_date: birthDate,
    sex: 'male',
    pediatrician_name: null,
    pediatrician_phone: null,
    blood_type: null,
    health_insurance: null,
    gestational_weeks_at_birth: null,
    is_preterm: false,
  },
  family_memberships: { family_group_id: 'fam-1' },
  family_memories: [],
  child_measurements: null,
  formula_stock: null,
  medication_doses: [],
};

const fakeSupabase = {
  from: (table: string) => query(tables[table] ?? null),
  rpc: async () => ({ data: careRows, error: null }),
};

const context = {
  auth: { supabase: fakeSupabase as never, userId: 'user-1' },
  familyGroupId: 'fam-1',
  actorUserId: 'user-1',
};

function reply(partial: Partial<ChatResponse>): void {
  callLLMMock.mockResolvedValueOnce({
    content: '',
    toolCalls: [],
    finishReason: 'stop',
    model: CLAUDE_MODELS.sonnet,
    usage: { promptTokens: 1000, completionTokens: 50, totalTokens: 1050 },
    latencyMs: 700,
    ...partial,
  });
}

beforeEach(() => {
  callLLMMock.mockReset();
  recordMock.mockReset();
});

describe('salustia chat', () => {
  it('chat de la app: Sonnet 5.5 con razonamiento bajo y sin temperature', async () => {
    reply({ content: 'Tomó 120 ml hace media hora.' });
    const out = await chat({ messages: [{ role: 'user', content: '¿Cuándo comió?' }] }, context);

    expect(out.reply).toBe('Tomó 120 ml hace media hora.');
    const req = callLLMMock.mock.calls[0]?.[0];
    expect(req?.model).toBe(CLAUDE_MODELS.sonnet);
    expect(req?.reasoning).toEqual({ effort: 'low' });
    expect(req?.temperature).toBeUndefined();
  });

  it("speed 'fast' (Alexa): Haiku 5.5 sin razonamiento", async () => {
    reply({ content: 'Anotado.', model: CLAUDE_MODELS.haiku });
    await chat(
      { messages: [{ role: 'user', content: 'hola' }], voice: 'baby', speed: 'fast' },
      context,
    );

    const req = callLLMMock.mock.calls[0]?.[0];
    expect(req?.model).toBe(CLAUDE_MODELS.haiku);
    expect(req?.reasoning).toEqual({ effort: 'none' });
  });

  it('system en dos partes: prompt estático cacheado y contexto del bebé aparte', async () => {
    reply({ content: 'ok' });
    await chat({ messages: [{ role: 'user', content: 'hola' }] }, context);

    const system = callLLMMock.mock.calls[0]?.[0].messages[0];
    expect(system?.role).toBe('system');
    const parts = system?.content as TextContentPart[];
    expect(parts).toHaveLength(2);
    expect(parts[0]?.cache_control).toEqual({ type: 'ephemeral' });
    expect(parts[0]?.text).toContain('SalustIA');
    expect(parts[0]?.text).not.toContain('Hora actual');

    const dynamic = parts[1]?.text ?? '';
    expect(parts[1]?.cache_control).toBeUndefined();
    expect(dynamic).toContain('Hora actual de Argentina');
    // 153 o 154 según la hora: la edad se cuenta en fecha de Argentina.
    expect(dynamic).toMatch(/- Edad: 5 meses( y \d+ días?)? \(15[34] días\)/);
    expect(dynamic).toContain('## Últimos cuidados');
    expect(dynamic).toContain('hace 30 min');
    expect(dynamic).toContain('mamadera 120 ml');
  });

  it('reenvía los reasoning_details junto a los tool calls en la siguiente iteración', async () => {
    const details = [{ type: 'reasoning.encrypted', data: 'opaque' }];
    reply({
      toolCalls: [
        {
          id: 'call_1',
          type: 'function',
          function: { name: 'get_today_summary', arguments: '{}' },
        },
      ],
      reasoningDetails: details,
      finishReason: 'tool_calls',
    });
    reply({ content: 'Hoy tomó una vez.' });

    const out = await chat({ messages: [{ role: 'user', content: '¿Cómo va el día?' }] }, context);

    expect(out.meta.iterations).toBe(2);
    expect(out.meta.toolCallsMade).toEqual(['get_today_summary']);
    const messages = callLLMMock.mock.calls[1]?.[0].messages ?? [];
    const assistant = messages.find((m) => m.role === 'assistant');
    expect(assistant?.reasoning_details).toEqual(details);
    expect(messages.at(-1)?.role).toBe('tool');
  });

  it('loguea una vez, con metadata y sin el texto de la respuesta', async () => {
    reply({ content: 'Respuesta con datos de Salustiano' });
    await chat({ messages: [{ role: 'user', content: 'pregunta privada' }] }, context);

    expect(recordMock).toHaveBeenCalledTimes(1);
    const entry = recordMock.mock.calls[0]?.[0];
    expect(entry).toMatchObject({
      agent: 'salustia',
      model: CLAUDE_MODELS.sonnet,
      promptVersion: 'salustia-v8',
      familyGroupId: 'fam-1',
    });
    const raw = JSON.stringify(entry);
    expect(raw).not.toContain('Salustiano');
    expect(raw).not.toContain('pregunta privada');
  });
});
