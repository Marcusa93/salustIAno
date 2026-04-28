/**
 * Errores tipados de la capa de IA.
 *
 * Se exportan como clases (no `import 'server-only'`) porque el discriminator
 * y los nombres se usan para distinguir errores tanto en server como en
 * tests, y los mensajes son seguros de mostrar fuera del server.
 */

export type AIErrorType = 'config' | 'network' | 'provider' | 'parse' | 'guardrail' | 'validation';

export class AIError extends Error {
  readonly type: AIErrorType;

  constructor(type: AIErrorType, message: string) {
    super(message);
    this.type = type;
    this.name = 'AIError';
  }
}

/** Configuración faltante o inválida (ej. OPENROUTER_API_KEY ausente). */
export class AIConfigError extends AIError {
  constructor(message: string) {
    super('config', message);
    this.name = 'AIConfigError';
  }
}

/** Error de red (timeout, DNS, conexión) antes de obtener una respuesta del provider. */
export class AINetworkError extends AIError {
  override readonly cause: unknown;

  constructor(message: string, cause: unknown) {
    super('network', message);
    this.cause = cause;
    this.name = 'AINetworkError';
  }
}

/** El provider respondió con error HTTP. body se trunca a 500 chars para no leakear payloads. */
export class AIProviderError extends AIError {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string) {
    const trimmed = body.length > 500 ? `${body.slice(0, 500)}…` : body;
    super('provider', `OpenRouter respondió con HTTP ${status}: ${trimmed}`);
    this.status = status;
    this.body = trimmed;
    this.name = 'AIProviderError';
  }
}

/** Falló el JSON.parse del contenido o el schema Zod del output del LLM. */
export class AIParseError extends AIError {
  constructor(message: string) {
    super('parse', message);
    this.name = 'AIParseError';
  }
}

/**
 * El output disparó un patrón peligroso (ej. dosis numérica en agente médico).
 *
 * No incluye el output completo en el mensaje — solo el patrón que matcheó —
 * para que los logs no terminen guardando fragmentos sensibles del LLM.
 */
export class AIGuardrailError extends AIError {
  readonly pattern: string;

  constructor(pattern: string) {
    super('guardrail', `Output rechazado por guardrail (patrón: ${pattern}).`);
    this.pattern = pattern;
    this.name = 'AIGuardrailError';
  }
}

/** Input del caller no cumple el schema Zod del agente. */
export class AIValidationError extends AIError {
  constructor(message: string) {
    super('validation', message);
    this.name = 'AIValidationError';
  }
}
