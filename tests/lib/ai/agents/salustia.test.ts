import { describe, expect, it } from 'vitest';

import { TOOL_DEFINITIONS, TOOL_HANDLERS } from '@/lib/ai/agents/salustia/tools';

describe('SalustIA tool definitions', () => {
  it('exporta read tools + propose tools', () => {
    const names = TOOL_DEFINITIONS.map((t) => t.function.name);
    // 5 read + 5 propose = 10
    expect(TOOL_DEFINITIONS).toHaveLength(10);
    expect(names).toEqual(
      expect.arrayContaining([
        'get_today_summary',
        'get_child_info',
        'list_recent_events',
        'search_care_guides',
        'list_pending_milestones',
        'propose_feeding',
        'propose_sleep',
        'propose_diaper',
        'propose_note',
        'propose_milestone',
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
});
