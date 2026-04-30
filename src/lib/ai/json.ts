/**
 * Extracción tolerante de JSON desde respuestas de LLM.
 *
 * Aunque pedimos `response_format: 'json_object'`, en la práctica varios
 * proveedores (Anthropic vía OpenRouter, sobre todo en modo vision) a veces
 * devuelven el JSON envuelto en ```json … ``` o con un preludio en prosa.
 * Este helper recorta esos casos comunes antes de `JSON.parse`.
 *
 * No intenta reparar JSON inválido (comas colgantes, comillas curvadas,
 * etc.). Si el contenido no es JSON razonable, devuelve null y dejamos que
 * el caller registre AIParseError.
 */
export function extractJsonObject(raw: string): unknown {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  // Caso 1: el LLM devolvió JSON puro.
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return tryParse(trimmed);
  }

  // Caso 2: envuelto en fences markdown (```json … ``` o ``` … ```).
  const fenceMatch = /^```(?:json|JSON)?\s*([\s\S]*?)\s*```\s*$/.exec(trimmed);
  if (fenceMatch?.[1]) {
    return tryParse(fenceMatch[1].trim());
  }

  // Caso 3: preludio + JSON. Buscamos el primer `{` y el último `}` que
  // matchee. No es perfecto si el JSON contiene strings con `}` adentro,
  // pero para los outputs nuestros (objetos planos) es suficiente.
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first !== -1 && last > first) {
    return tryParse(trimmed.slice(first, last + 1));
  }

  return null;
}

function tryParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/**
 * Devuelve un snippet razonablemente legible del raw content para incluir
 * en logs cuando el parse falla. Trunca a 240 chars y colapsa whitespace
 * para no inundar `ai_logs.error`.
 */
export function truncateForLog(raw: string, maxLen = 240): string {
  if (typeof raw !== 'string') return '';
  const compact = raw.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLen) return compact;
  return `${compact.slice(0, maxLen)}…`;
}
