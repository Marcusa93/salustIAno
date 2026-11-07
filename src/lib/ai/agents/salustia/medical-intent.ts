/**
 * Detector pre-LLM de intent médico para SalustIA.
 *
 * Antes de pasar el último mensaje del usuario al modelo, lo chequeamos
 * contra una lista de patrones que claramente piden una opinión clínica
 * (síntomas, dosis, urgencias). Cuando matchea, devolvemos una respuesta
 * canned y NO llamamos al LLM. Esto evita dos riesgos:
 *
 *   1. Que el modelo se sienta tentado a "ayudar" con una recomendación
 *      médica aunque el system prompt se lo prohíba.
 *   2. Que la familia interprete una respuesta natural del LLM como
 *      consejo válido — la mediación humana de la pediatra es no
 *      negociable.
 *
 * Patrones conservadores: solo cosas que claramente piden interpretación
 * clínica. Evitamos falsos positivos en cosas como "60 ml" (puede ser
 * biberón) o "amarillo" (puede ser color de pañal). Cuando dudamos,
 * dejamos pasar al LLM — el system prompt del agente ya tiene
 * prohibiciones explícitas como segunda capa.
 */

const MEDICAL_PATTERNS: ReadonlyArray<RegExp> = [
  // Síntomas que requieren evaluación médica.
  /\bfiebre\b/,
  /\btemperatura\s+(alta|altisima|alta)\b/,
  /\bvomit/,
  /\bdiarrea\b/,
  /\bsangre\b/,
  /\bconvuls/,
  /\bahog/,
  /\bictericia\b/,
  /\bdeshidrat/,
  /\bdesmay/,

  // Dosis y medicación.
  /\bdosis\b/,
  /\bparacetamol\b/,
  /\bibuprofeno\b/,
  /\bantibioti/,
  /\bantipiret/,
  /\bjarabe\b.*\b(le|para|de|al)\b/,

  // Pedidos de juicio clínico.
  /\bes\s+grave\b/,
  /\bque\s+hago\s+si\b/,
  /\bdeber[ií]a\s+(ir|llamar|preocupar)/,

  // Urgencias / emergencias.
  /\bemergencia\b/,
  /\burgente\b/,
  /\bguardia\b/,
  /\bhospital\b/,
  /\b911\b/,
  /\b107\b/, // SAME / Buenos Aires
];

/**
 * "¿Cuánto le doy?" es dosis… salvo que hablen de comida ("¿cuánta papilla
 * le doy?", "le doy 2 cucharadas de zapallo"): la alimentación
 * complementaria la responde SalustIA. Los nombres de remedios se siguen
 * atajando con los patrones de arriba.
 */
const DOSE_PATTERNS: ReadonlyArray<RegExp> = [
  /\bcuant[oa]s?\s+le\s+doy\b/,
  /\bcuant[oa]s?\s+\w+\s+le\s+doy\b/,
  /\b(le|al)\s+doy\s+\d/,
];

const FOOD_CONTEXT =
  /\b(comida|comidas|comer|come|comio|papilla|papillas|pure|blw|solidos?|almuerzo|cena|desayuno|merienda|colacion|cucharadas?|porcion|plato|fruta|frutas|verdura|verduras|carne|pollo|pescado|huevo|banana|zapallo|palta|yogur|agua)\b/;

/**
 * Quita acentos y baja a minúsculas para que los patrones (sin tildes)
 * no se rompan con "fíebre", "FIEBRE", "fíEbre", etc.
 */
function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

export interface MedicalDeflection {
  matched: true;
  pattern: string;
  reply: string;
}

export interface NoMedicalIntent {
  matched: false;
}

/**
 * Detecta si el mensaje del usuario pisa un patrón médico claro.
 * Devuelve la respuesta canned a mostrar y el patrón que matcheó (para
 * logging). Si no matchea, devuelve `{ matched: false }`.
 */
export function detectMedicalIntent(message: string): MedicalDeflection | NoMedicalIntent {
  if (typeof message !== 'string' || message.trim().length === 0) {
    return { matched: false };
  }
  const normalized = normalize(message);
  const aboutFood = FOOD_CONTEXT.test(normalized);
  const patterns = aboutFood ? MEDICAL_PATTERNS : [...MEDICAL_PATTERNS, ...DOSE_PATTERNS];
  for (const pattern of patterns) {
    if (pattern.test(normalized)) {
      return {
        matched: true,
        pattern: pattern.source,
        reply: CANNED_REPLY,
      };
    }
  }
  return { matched: false };
}

const CANNED_REPLY =
  'Eso ya es conversación para la pediatra, no para mí. Si la cosa pinta urgente, llamá al 107 o andá a la guardia. Mientras tanto, si querés te muestro cómo viene el día.';
