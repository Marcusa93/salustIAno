import { describe, expect, it } from 'vitest';

import { TOOL_DEFINITIONS, TOOL_HANDLERS } from '@/lib/ai/agents/salustia/tools';

describe('SalustIA tool definitions', () => {
  it('exporta cinco tools de read', () => {
    expect(TOOL_DEFINITIONS).toHaveLength(5);
    expect(TOOL_DEFINITIONS.map((t) => t.function.name)).toEqual([
      'get_today_summary',
      'get_child_info',
      'list_recent_events',
      'search_care_guides',
      'list_pending_milestones',
    ]);
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
