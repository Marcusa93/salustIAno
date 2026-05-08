import { describe, expect, it } from 'vitest';

import { TOOL_DEFINITIONS, TOOL_HANDLERS } from '@/lib/ai/agents/salustia/tools';

describe('SalustIA tool definitions', () => {
  it('exporta read tools + propose tools', () => {
    const names = TOOL_DEFINITIONS.map((t) => t.function.name);
    // 7 read (recall_memories + search_chat_history) + 6 propose = 13
    expect(TOOL_DEFINITIONS).toHaveLength(13);
    expect(names).toEqual(
      expect.arrayContaining([
        'get_today_summary',
        'get_child_info',
        'list_recent_events',
        'search_care_guides',
        'list_pending_milestones',
        'recall_memories',
        'search_chat_history',
        'propose_feeding',
        'propose_sleep',
        'propose_diaper',
        'propose_note',
        'propose_milestone',
        'propose_memory',
      ]),
    );
  });

  it('cada tool tiene description y parameters JSON Schema', () => {
    for (const tool of TOOL_DEFINITIONS) {
      expect(tool.type).toBe('function');
      expect(tool.function.name).toBeTruthy();
      expect(tool.function.description.length).toBeGreaterThan(20);
      expect(tool.function.parameters.type).toBe('object');
    }
  });

  it('list_recent_events requiere `type`', () => {
    const tool = TOOL_DEFINITIONS.find((t) => t.function.name === 'list_recent_events');
    expect(tool?.function.parameters.required).toContain('type');
  });

  it('TOOL_HANDLERS tiene un handler por cada definición', () => {
    for (const def of TOOL_DEFINITIONS) {
      expect(TOOL_HANDLERS[def.function.name]).toBeTypeOf('function');
    }
    // Y no hay handlers huérfanos.
    const defNames = new Set(TOOL_DEFINITIONS.map((d) => d.function.name));
    for (const handlerName of Object.keys(TOOL_HANDLERS)) {
      expect(defNames.has(handlerName)).toBe(true);
    }
  });
});

describe('SalustIA tool handlers — error paths', () => {
  // Stub minimal del SupabaseClient: las queries devuelven null/error.
  // Los handlers deberían responder con jsonError o ok=true según corresponda.
  const noChildCtx = {
    supabase: {} as never,
    userId: 'user-1',
    childId: null,
    proposals: [],
  };

  it('get_today_summary devuelve error cuando no hay child', async () => {
    const result = await TOOL_HANDLERS.get_today_summary?.({}, noChildCtx);
    expect(result).toBeDefined();
    const parsed = JSON.parse(result as string);
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toMatch(/perfil/i);
  });

  it('get_child_info devuelve error cuando no hay child', async () => {
    const result = await TOOL_HANDLERS.get_child_info?.({}, noChildCtx);
    const parsed = JSON.parse(result as string);
    expect(parsed.ok).toBe(false);
  });

  it('list_recent_events rechaza type inválido', async () => {
    const result = await TOOL_HANDLERS.list_recent_events?.({ type: 'inventado' }, noChildCtx);
    const parsed = JSON.parse(result as string);
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toMatch(/type/);
  });

  it('list_recent_events sin type también falla', async () => {
    const result = await TOOL_HANDLERS.list_recent_events?.({}, noChildCtx);
    const parsed = JSON.parse(result as string);
    expect(parsed.ok).toBe(false);
  });

  it('search_chat_history rechaza query corta (< 2 chars)', async () => {
    const result = await TOOL_HANDLERS.search_chat_history?.({ query: 'a' }, noChildCtx);
    const parsed = JSON.parse(result as string);
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toMatch(/2 caracteres/);
  });

  it('search_chat_history rechaza query vacía', async () => {
    const result = await TOOL_HANDLERS.search_chat_history?.({ query: '   ' }, noChildCtx);
    const parsed = JSON.parse(result as string);
    expect(parsed.ok).toBe(false);
  });

  it('search_chat_history rechaza si no se pasa query', async () => {
    const result = await TOOL_HANDLERS.search_chat_history?.({}, noChildCtx);
    const parsed = JSON.parse(result as string);
    expect(parsed.ok).toBe(false);
  });

  it('search_chat_history acepta query válida y delega a supabase', async () => {
    // Stub mínimo de la cadena .from().select().eq().is().ilike().order().limit()
    const calls: { method: string; args: unknown[] }[] = [];
    const chain = {
      select: (...args: unknown[]) => {
        calls.push({ method: 'select', args });
        return chain;
      },
      eq: (...args: unknown[]) => {
        calls.push({ method: 'eq', args });
        return chain;
      },
      is: (...args: unknown[]) => {
        calls.push({ method: 'is', args });
        return chain;
      },
      ilike: (...args: unknown[]) => {
        calls.push({ method: 'ilike', args });
        return chain;
      },
      order: (...args: unknown[]) => {
        calls.push({ method: 'order', args });
        return chain;
      },
      limit: async (...args: unknown[]) => {
        calls.push({ method: 'limit', args });
        return {
          data: [{ role: 'user', content: 'qué obra social tengo', created_at: '2026-05-01' }],
          error: null,
        };
      },
    };
    const supabase = {
      from: (table: string) => {
        calls.push({ method: 'from', args: [table] });
        return chain;
      },
    } as never;
    const ctx = { supabase, userId: 'user-1', childId: 'child-1', proposals: [] };

    const result = await TOOL_HANDLERS.search_chat_history?.(
      { query: 'obra social', limit: 5 },
      ctx,
    );
    const parsed = JSON.parse(result as string);

    expect(parsed.ok).toBe(true);
    expect(parsed.data.count).toBe(1);
    expect(parsed.data.matches[0].content).toMatch(/obra social/);
    // Verificamos que la query usó la tabla y filtró por user.
    expect(calls.some((c) => c.method === 'from' && c.args[0] === 'chat_messages')).toBe(true);
    expect(
      calls.some((c) => c.method === 'eq' && c.args[0] === 'user_id' && c.args[1] === 'user-1'),
    ).toBe(true);
    expect(calls.some((c) => c.method === 'ilike')).toBe(true);
  });

  it('search_chat_history escapa wildcards LIKE en la query', async () => {
    let ilikeArg: string | null = null;
    const chain = {
      select: () => chain,
      eq: () => chain,
      is: () => chain,
      ilike: (_col: string, pattern: string) => {
        ilikeArg = pattern;
        return chain;
      },
      order: () => chain,
      limit: async () => ({ data: [], error: null }),
    };
    const supabase = { from: () => chain } as never;
    const ctx = { supabase, userId: 'user-1', childId: null, proposals: [] };

    await TOOL_HANDLERS.search_chat_history?.({ query: '50%_off' }, ctx);
    expect(ilikeArg).toBe('%50  off%');
  });

  it('search_chat_history clampa limit a 20', async () => {
    let limitArg: number | null = null;
    const chain = {
      select: () => chain,
      eq: () => chain,
      is: () => chain,
      ilike: () => chain,
      order: () => chain,
      limit: async (n: number) => {
        limitArg = n;
        return { data: [], error: null };
      },
    };
    const supabase = { from: () => chain } as never;
    const ctx = { supabase, userId: 'user-1', childId: null, proposals: [] };

    await TOOL_HANDLERS.search_chat_history?.({ query: 'algo', limit: 100 }, ctx);
    expect(limitArg).toBe(20);
  });
});

describe('SalustIA propose tools', () => {
  function makeCtx() {
    return {
      supabase: {} as never,
      userId: 'user-1',
      childId: 'child-1',
      proposals: [] as Array<{ kind: string }>,
    };
  }

  it('propose_feeding rechaza si no hay child', async () => {
    const ctx = { ...makeCtx(), childId: null };
    const result = await TOOL_HANDLERS.propose_feeding?.(
      { occurred_at: '2026-05-01T12:00', type: 'breastfeeding' },
      ctx as never,
    );
    const parsed = JSON.parse(result as string);
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toMatch(/perfil/i);
  });

  it('propose_feeding empuja un Proposal válido al buffer', async () => {
    const ctx = makeCtx();
    const result = await TOOL_HANDLERS.propose_feeding?.(
      {
        occurred_at: '2026-05-01T12:00',
        type: 'bottle',
        amount_ml: 90,
      },
      ctx as never,
    );
    const parsed = JSON.parse(result as string);
    expect(parsed.ok).toBe(true);
    expect(ctx.proposals).toHaveLength(1);
    expect(ctx.proposals[0]?.kind).toBe('feeding');
  });

  it('propose_feeding rebota args incoherentes (breastfeeding con amount_ml)', async () => {
    const ctx = makeCtx();
    const result = await TOOL_HANDLERS.propose_feeding?.(
      {
        occurred_at: '2026-05-01T12:00',
        type: 'breastfeeding',
        amount_ml: 90,
      },
      ctx as never,
    );
    const parsed = JSON.parse(result as string);
    expect(parsed.ok).toBe(false);
    expect(ctx.proposals).toHaveLength(0);
  });

  it('propose_sleep acepta sueño en curso (sin ended_at)', async () => {
    const ctx = makeCtx();
    const result = await TOOL_HANDLERS.propose_sleep?.(
      { started_at: '2026-05-01T14:00' },
      ctx as never,
    );
    const parsed = JSON.parse(result as string);
    expect(parsed.ok).toBe(true);
    expect(ctx.proposals).toHaveLength(1);
  });

  it('propose_sleep rebota ended_at anterior a started_at', async () => {
    const ctx = makeCtx();
    const result = await TOOL_HANDLERS.propose_sleep?.(
      { started_at: '2026-05-01T14:00', ended_at: '2026-05-01T13:00' },
      ctx as never,
    );
    const parsed = JSON.parse(result as string);
    expect(parsed.ok).toBe(false);
  });

  it('propose_diaper acepta args válidos', async () => {
    const ctx = makeCtx();
    const result = await TOOL_HANDLERS.propose_diaper?.(
      { occurred_at: '2026-05-01T15:00', type: 'both' },
      ctx as never,
    );
    const parsed = JSON.parse(result as string);
    expect(parsed.ok).toBe(true);
    expect(ctx.proposals[0]?.kind).toBe('diaper');
  });

  it('propose_note rechaza content vacío', async () => {
    const ctx = makeCtx();
    const result = await TOOL_HANDLERS.propose_note?.({ content: '' }, ctx as never);
    const parsed = JSON.parse(result as string);
    expect(parsed.ok).toBe(false);
  });

  it('propose_note acepta una nota memory', async () => {
    const ctx = makeCtx();
    const result = await TOOL_HANDLERS.propose_note?.(
      { content: 'Hoy se rió por primera vez' },
      ctx as never,
    );
    const parsed = JSON.parse(result as string);
    expect(parsed.ok).toBe(true);
    expect(ctx.proposals[0]?.kind).toBe('note');
  });

  it('propose_memory acepta content válido y default scope=family', async () => {
    const ctx = makeCtx();
    const result = await TOOL_HANDLERS.propose_memory?.(
      { content: 'Obra social: OSDE' },
      ctx as never,
    );
    const parsed = JSON.parse(result as string);
    expect(parsed.ok).toBe(true);
    const stored = ctx.proposals[0] as { kind: string; scope?: string; content?: string };
    expect(stored?.kind).toBe('memory');
    expect(stored?.scope).toBe('family');
    expect(stored?.content).toBe('Obra social: OSDE');
  });

  it('propose_memory rechaza content vacío', async () => {
    const ctx = makeCtx();
    const result = await TOOL_HANDLERS.propose_memory?.({ content: '' }, ctx as never);
    const parsed = JSON.parse(result as string);
    expect(parsed.ok).toBe(false);
    expect(ctx.proposals).toHaveLength(0);
  });

  it('propose_memory rechaza content > 500 chars', async () => {
    const ctx = makeCtx();
    const result = await TOOL_HANDLERS.propose_memory?.({ content: 'x'.repeat(501) }, ctx as never);
    const parsed = JSON.parse(result as string);
    expect(parsed.ok).toBe(false);
    expect(ctx.proposals).toHaveLength(0);
  });

  it('propose_memory funciona sin child (memoria de la familia, no del bebé)', async () => {
    const ctx = { ...makeCtx(), childId: null };
    const result = await TOOL_HANDLERS.propose_memory?.(
      { content: 'Pediatra: Dra. López' },
      ctx as never,
    );
    const parsed = JSON.parse(result as string);
    expect(parsed.ok).toBe(true);
    expect(ctx.proposals[0]?.kind).toBe('memory');
  });

  it('propose_memory acepta scope=private', async () => {
    const ctx = makeCtx();
    const result = await TOOL_HANDLERS.propose_memory?.(
      { content: 'Algo personal mío', scope: 'private' },
      ctx as never,
    );
    const parsed = JSON.parse(result as string);
    expect(parsed.ok).toBe(true);
    const stored = ctx.proposals[0] as { scope?: string };
    expect(stored?.scope).toBe('private');
  });
});
