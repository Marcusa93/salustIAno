import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import type { ListLogFilters, LogEntry, LogStore } from './types';

type AdminClient = ReturnType<typeof createAdminClient>;

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;

/**
 * LogStore que persiste en `public.ai_logs`.
 *
 * Se inicializa con un admin client inyectado (no importado al top del
 * archivo) para que los tests puedan reemplazarlo sin tocar Supabase real.
 *
 * NUNCA loguea contenido (ni prompts ni outputs). Solo metadata: agente,
 * modelo, tokens, latencia, errores. Esa restricción está documentada en
 * docs/06-privacidad.md y docs/04-agentes-llm.md.
 *
 * Si en el futuro queremos logs en otro destino (S3, OTel), implementar
 * otra clase con la misma interface y swap del singleton al final del
 * archivo.
 */
export class SupabaseLogStore implements LogStore {
  constructor(private readonly client: AdminClient) {}

  async record(entry: Omit<LogEntry, 'id' | 'createdAt'>): Promise<void> {
    const { error } = await this.client.from('ai_logs').insert({
      agent: entry.agent,
      model: entry.model,
      prompt_version: entry.promptVersion ?? null,
      prompt_tokens: entry.promptTokens ?? null,
      completion_tokens: entry.completionTokens ?? null,
      latency_ms: entry.latencyMs ?? null,
      error: entry.error ?? null,
      family_group_id: entry.familyGroupId ?? null,
      child_id: entry.childId ?? null,
      actor_user_id: entry.actorUserId ?? null,
    });

    if (error) {
      // No tirar: un log fallido no debe romper el flow del agente.
      // Solo dejar rastro para debugging operacional.
      console.error('[ai_logs] insert failed:', error.message);
    }
  }

  async list(filters: ListLogFilters = {}): Promise<LogEntry[]> {
    const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    let query = this.client
      .from('ai_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (filters.agent) {
      query = query.eq('agent', filters.agent);
    }
    if (filters.familyGroupId) {
      query = query.eq('family_group_id', filters.familyGroupId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[ai_logs] list failed:', error.message);
      return [];
    }

    return (data ?? []).map(
      (row): LogEntry => ({
        id: row.id,
        agent: row.agent,
        model: row.model,
        promptVersion: row.prompt_version,
        promptTokens: row.prompt_tokens,
        completionTokens: row.completion_tokens,
        totalTokens: row.total_tokens,
        latencyMs: row.latency_ms,
        error: row.error,
        familyGroupId: row.family_group_id,
        childId: row.child_id,
        actorUserId: row.actor_user_id,
        createdAt: row.created_at,
      }),
    );
  }
}

/**
 * Singleton de uso desde los agentes. Reemplazable en tests con
 * `vi.spyOn(logStore, 'record')`.
 */
export const logStore: LogStore = new SupabaseLogStore(createAdminClient());
