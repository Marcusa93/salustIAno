/**
 * Tipos compartidos de la capa de IA.
 *
 * Sin `import 'server-only'`: este archivo es solo tipos, no tiene runtime
 * y puede importarse desde cualquier lado para tipear inputs/outputs.
 */

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Llamada que el LLM quiere hacer a una tool. Devuelta dentro de un
 * `ChatMessage` con role 'assistant' cuando el modelo decide invocar
 * funciones.
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    /** JSON string con los argumentos. Hay que parsear antes de usar. */
    arguments: string;
  };
}

/**
 * Parte de un mensaje multimodal. Sigue la convención OpenAI/OpenRouter:
 * el campo `content` puede ser un string simple o un array de partes
 * cuando hay imágenes intercaladas con texto.
 */
export interface TextContentPart {
  type: 'text';
  text: string;
  /**
   * Breakpoint de prompt caching (Anthropic vía OpenRouter). Todo lo que
   * viene antes de esta parte, incluidas las tools, queda cacheado ~5 min.
   * Solo tiene sentido en texto estable: cualquier cambio de un byte
   * invalida el caché.
   */
  cache_control?: { type: 'ephemeral' };
}

export interface ImageContentPart {
  type: 'image_url';
  image_url: {
    /** URL https://... o data URL (`data:image/jpeg;base64,...`). */
    url: string;
    /** 'auto' por default. 'low' baja tokens, 'high' aumenta detalle. */
    detail?: 'auto' | 'low' | 'high';
  };
}

export type ContentPart = TextContentPart | ImageContentPart;

export interface ChatMessage {
  role: ChatRole;
  /**
   * Puede ser:
   *   - string: caso normal (texto plano).
   *   - ContentPart[]: caso multimodal (texto + imágenes).
   *   - null: cuando el assistant solo está invocando tools.
   */
  content: string | ContentPart[] | null;
  /** Solo presente en messages con role = 'assistant'. */
  tool_calls?: ToolCall[];
  /**
   * Bloques de razonamiento opacos que devolvió el modelo en un turno con
   * tool calls. Hay que reenviarlos tal cual en el mensaje assistant para
   * que Claude continúe el mismo razonamiento al recibir los resultados.
   * No se leen ni se loguean.
   */
  reasoning_details?: unknown[];
  /** Solo presente en messages con role = 'tool', linkea a una `ToolCall.id`. */
  tool_call_id?: string;
  /** Solo presente en messages con role = 'tool', nombre de la función. */
  name?: string;
}

/**
 * Definición de una tool que el LLM puede invocar. El formato sigue la
 * convención de OpenAI Chat Completions; OpenRouter lo traduce a la
 * representación nativa del modelo (Anthropic, Google, etc.).
 */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    /** JSON Schema (subset) describiendo los parámetros. */
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

/**
 * Esfuerzo de razonamiento (`reasoning.effort` de OpenRouter, que para
 * Claude se traduce a `output_config.effort`). 'none' apaga el
 * razonamiento y solo vale en modelos donde no es obligatorio (Haiku).
 */
export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high';

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  /**
   * Los modelos Claude 4.7+ / 5.x rechazan temperature: el cliente la
   * descarta para esos modelos. Ver `acceptsTemperature` en models.ts.
   */
  temperature?: number;
  /** Tope de tokens de salida. En modelos con razonamiento incluye el razonamiento. */
  maxTokens?: number;
  /**
   * Control del razonamiento. `exclude: true` hace que OpenRouter no
   * devuelva el texto ni los bloques de razonamiento (se cobran igual).
   * Los loops con tools tienen que dejarlo en false para poder reenviar
   * `reasoning_details`.
   */
  reasoning?: { effort: ReasoningEffort; exclude?: boolean };
  /**
   * Forzar respuesta JSON. Cuando se setea, el provider intenta devolver
   * un JSON parseable en el `content`.
   */
  responseFormat?: 'json_object' | 'text';
  /**
   * Tools que el LLM puede invocar. Si el modelo decide usar una, la
   * respuesta vendrá con `tool_calls` poblado y `content` posiblemente null.
   */
  tools?: ToolDefinition[];
}

export interface ChatResponseUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ChatResponse {
  /** Puede ser string vacío cuando el modelo solo invoca tools. */
  content: string;
  /** Tool calls que el modelo decidió hacer en este turno. */
  toolCalls: ToolCall[];
  /**
   * Razón por la cual el modelo terminó: 'stop' (respuesta normal),
   * 'tool_calls' (cortó para invocar tools), 'length' (max tokens), etc.
   */
  finishReason: string | null;
  model: string;
  usage: ChatResponseUsage;
  /**
   * Bloques de razonamiento opacos para reenviar en el próximo turno de un
   * loop con tools. Vacío o ausente si el request pidió `exclude: true`.
   */
  reasoningDetails?: unknown[];
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
