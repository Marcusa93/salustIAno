/**
 * Tipos compartidos de la capa de IA.
 *
 * Sin `import 'server-only'`: este archivo es solo tipos, no tiene runtime
 * y puede importarse desde cualquier lado para tipear inputs/outputs.
 */

export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  /**
   * Forzar respuesta JSON. Cuando se setea, el provider intenta devolver
   * un JSON parseable en el `content`.
   */
  responseFormat?: 'json_object' | 'text';
}

export interface ChatResponseUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ChatResponse {
  content: string;
  model: string;
  usage: ChatResponseUsage;
  /** Latencia medida del lado nuestro (ms entre request y response). */
  latencyMs: number;
}

/**
 * Contexto que el caller pasa al agente. Sirve para enriquecer logs y
 * guardrails sin que cada agente tenga que recibir los mismos parámetros.
 */
export interface AgentContext {
  agent: string;
  familyGroupId?: string;
  childId?: string;
  actorUserId?: string;
}

export interface AgentMeta {
  model: string;
  /** Suma de prompt_tokens + completion_tokens. */
  tokens: number;
  latencyMs: number;
  promptVersion: string;
}

export interface AgentResult<T> {
  output: T;
  meta: AgentMeta;
}

/**
 * Forma 1:1 con la tabla `public.ai_logs` pero en camelCase para uso desde
 * TypeScript. Las claves se mapean a snake_case dentro de SupabaseLogStore.
 */
export interface LogEntry {
  id: string;
  agent: string;
  model: string;
  promptVersion?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  latencyMs?: number | null;
  error?: string | null;
  familyGroupId?: string | null;
  childId?: string | null;
  actorUserId?: string | null;
  createdAt: string;
}

export interface ListLogFilters {
  agent?: string;
  familyGroupId?: string;
  /** Default 100, max 1000 enforzado por SupabaseLogStore. */
  limit?: number;
}

/**
 * Interface de persistencia de logs. SupabaseLogStore es la implementación
 * canónica. Si en el futuro queremos otro destino (S3, OTel), implementar
 * otra clase con la misma interface y swap del singleton en logger.ts.
 */
export interface LogStore {
  record(entry: Omit<LogEntry, 'id' | 'createdAt'>): Promise<void>;
  list(filters?: ListLogFilters): Promise<LogEntry[]>;
}
