import { afterEach, describe, expect, it, vi } from 'vitest';

// vi.hoisted lifta la creación de mocks para que estén disponibles cuando
// vi.mock se ejecuta (vi.mock se hoistea al top del archivo).
const mocks = vi.hoisted(() => {
  const insertMock = vi.fn();
  const fromMock = vi.fn();
  return { insertMock, fromMock };
});

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: mocks.fromMock,
  }),
}));

import { SupabaseLogStore } from '@/lib/ai/logger';
import { createAdminClient } from '@/lib/supabase/admin';

function makeStore() {
  return new SupabaseLogStore(createAdminClient());
}

describe('SupabaseLogStore.record', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('inserta con el shape snake_case correcto', async () => {
    mocks.insertMock.mockResolvedValueOnce({ error: null });
    mocks.fromMock.mockReturnValueOnce({ insert: mocks.insertMock });

    const store = makeStore();
    await store.record({
      agent: 'story-generator',
      model: 'anthropic/claude-haiku-4-5',
      promptVersion: 'story-v1',
      promptTokens: 12,
      completionTokens: 34,
      latencyMs: 567,
      familyGroupId: 'fam-1',
      childId: 'child-1',
      actorUserId: 'user-1',
    });

    expect(mocks.fromMock).toHaveBeenCalledWith('ai_logs');
    expect(mocks.insertMock).toHaveBeenCalledWith({
      agent: 'story-generator',
      model: 'anthropic/claude-haiku-4-5',
      prompt_version: 'story-v1',
      prompt_tokens: 12,
      completion_tokens: 34,
      latency_ms: 567,
      error: null,
      family_group_id: 'fam-1',
      child_id: 'child-1',
      actor_user_id: 'user-1',
    });
  });

  it('mapea undefined a null para todas las columnas opcionales', async () => {
    mocks.insertMock.mockResolvedValueOnce({ error: null });
    mocks.fromMock.mockReturnValueOnce({ insert: mocks.insertMock });

    const store = makeStore();
    await store.record({ agent: 'x', model: 'y' });

    expect(mocks.insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt_version: null,
        prompt_tokens: null,
        completion_tokens: null,
        latency_ms: null,
        error: null,
        family_group_id: null,
        child_id: null,
        actor_user_id: null,
      }),
    );
  });

  it('si DB devuelve error, console.error pero NO tira', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.insertMock.mockResolvedValueOnce({ error: { message: 'db down' } });
    mocks.fromMock.mockReturnValueOnce({ insert: mocks.insertMock });

    const store = makeStore();
    await expect(store.record({ agent: 'a', model: 'b' })).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('SupabaseLogStore.list', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('aplica filtro por agent y mapea a camelCase', async () => {
    const rows = [
      {
        id: '1',
        agent: 'story-generator',
        model: 'anthropic/claude-haiku-4-5',
        prompt_version: 'story-v1',
        prompt_tokens: 12,
        completion_tokens: 34,
        total_tokens: 46,
        latency_ms: 200,
        error: null,
        family_group_id: 'fam-1',
        child_id: null,
        actor_user_id: null,
        created_at: '2026-04-27T19:00:00.000Z',
      },
    ];

    // Cadena: from().select().order().limit().eq() → resuelve con data/error.
    const eqStep = vi.fn().mockResolvedValue({ data: rows, error: null });
    const limitStep = vi.fn().mockReturnValue({ eq: eqStep });
    const orderStep = vi.fn().mockReturnValue({ limit: limitStep });
    const selectStep = vi.fn().mockReturnValue({ order: orderStep });
    mocks.fromMock.mockReturnValueOnce({ select: selectStep });

    const store = makeStore();
    const result = await store.list({ agent: 'story-generator', limit: 10 });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: '1',
      agent: 'story-generator',
      promptVersion: 'story-v1',
      promptTokens: 12,
      completionTokens: 34,
      totalTokens: 46,
      latencyMs: 200,
      familyGroupId: 'fam-1',
    });
    expect(selectStep).toHaveBeenCalledWith('*');
    expect(orderStep).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(limitStep).toHaveBeenCalledWith(10);
    expect(eqStep).toHaveBeenCalledWith('agent', 'story-generator');
  });
});
