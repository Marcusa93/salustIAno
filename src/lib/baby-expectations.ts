/**
 * Rangos orientativos de carga de eventos por edad — para empujar a la
 * familia a no olvidarse de registrar tomas, pañales y horas de sueño.
 *
 * IMPORTANTE — qué medimos y qué NO medimos:
 *   - Esto NO es una herramienta clínica. Los rangos son ANCHOS y orientativos.
 *   - El framing es alrededor de la CARGA de datos, no de la conducta del bebé.
 *     Si el conteo está bajo, el copy sugiere "¿te faltó cargar alguna?",
 *     nunca "tu bebé está comiendo poco" o "está durmiendo poco".
 *   - El objetivo es ayudar a la familia a llevar registro completo, no
 *     diagnosticar.
 *
 * Fuentes:
 *   - American Academy of Pediatrics (AAP):
 *     - Sueño: HealthyChildren.org — "Healthy Sleep Habits: How Many Hours
 *       Does Your Child Need?"
 *       https://www.healthychildren.org/English/healthy-living/sleep/Pages/healthy-sleep-habits-how-many-hours-does-your-child-need.aspx
 *     - Pañales y tomas: HealthyChildren.org — "How Often and How Much
 *       Should Your Baby Eat?", "Newborn Diaper Changes".
 *   - American Academy of Pediatrics, "Caring for Your Baby and Young Child:
 *     Birth to Age 5" (7th ed., 2019) — referencia editorial.
 *
 * Cualquier ajuste a los rangos debería bajarse de fuente con cita explícita.
 */

export interface ExpectationRange {
  /** Mínimo razonable del rango. Inclusivo. */
  min: number;
  /** Máximo razonable del rango. Inclusivo. */
  max: number;
}

export interface AgeExpectations {
  /** Tomas (pecho/mamadera/sólidos) por día. */
  feedings: ExpectationRange;
  /** Pañales mojados por día (los más predecibles). */
  diapers: ExpectationRange;
  /** Horas totales de sueño en 24h, sumando siestas + nocturno. */
  sleepHours: ExpectationRange;
  /** Etiqueta humana del bracket etario. */
  ageLabel: string;
}

interface Bracket {
  /** Inclusive — días de edad mínima del bracket. */
  minDays: number;
  /** Exclusive — el bracket aplica si ageDays < maxDays. */
  maxDays: number;
  data: AgeExpectations;
}

/**
 * Tabla por bracket etario. Cada uno cubre un período donde los rangos
 * de carga típica son razonablemente estables.
 */
const BRACKETS: ReadonlyArray<Bracket> = [
  // Recién nacido — primeros 7 días, expectativas bajas porque la
  // familia recién está conociendo a su bebé. Pañales mojados van
  // creciendo día a día (regla del primer mes: tantos como días de vida,
  // máximo 6).
  {
    minDays: 0,
    maxDays: 7,
    data: {
      feedings: { min: 8, max: 12 },
      diapers: { min: 4, max: 6 },
      sleepHours: { min: 14, max: 17 },
      ageLabel: 'Primera semana',
    },
  },
  // 1 semana - 1 mes
  {
    minDays: 7,
    maxDays: 30,
    data: {
      feedings: { min: 8, max: 12 },
      diapers: { min: 6, max: 8 },
      sleepHours: { min: 14, max: 17 },
      ageLabel: '1–4 semanas',
    },
  },
  // 1 - 3 meses
  {
    minDays: 30,
    maxDays: 90,
    data: {
      feedings: { min: 7, max: 9 },
      diapers: { min: 6, max: 8 },
      sleepHours: { min: 14, max: 17 },
      ageLabel: '1–3 meses',
    },
  },
  // 3 - 6 meses
  {
    minDays: 90,
    maxDays: 180,
    data: {
      feedings: { min: 6, max: 8 },
      diapers: { min: 5, max: 7 },
      sleepHours: { min: 12, max: 16 },
      ageLabel: '3–6 meses',
    },
  },
  // 6 - 12 meses (intro de sólidos: bajan tomas líquidas)
  {
    minDays: 180,
    maxDays: 365,
    data: {
      feedings: { min: 5, max: 7 },
      diapers: { min: 4, max: 6 },
      sleepHours: { min: 12, max: 16 },
      ageLabel: '6–12 meses',
    },
  },
  // 12 - 24 meses
  {
    minDays: 365,
    maxDays: 730,
    data: {
      feedings: { min: 4, max: 6 },
      diapers: { min: 4, max: 6 },
      sleepHours: { min: 11, max: 14 },
      ageLabel: '1–2 años',
    },
  },
];

/**
 * Devuelve las expectativas para una edad en días. Fuera de rango (no
 * nacido o > 2 años) devuelve null — la card no debe mostrarse.
 */
export function expectationsFor(ageDays: number | null): AgeExpectations | null {
  if (ageDays === null || ageDays < 0) return null;
  for (const b of BRACKETS) {
    if (ageDays >= b.minDays && ageDays < b.maxDays) return b.data;
  }
  return null;
}

export type CompareStatus = 'low' | 'in_range' | 'high';

/**
 * Compara un valor con un rango. La fuente es siempre el conteo cargado
 * — si "low", probablemente la familia no anotó algo, no que el bebé
 * esté efectivamente bajo en lo medido. La UI debe expresar esa
 * ambigüedad sin alarmar.
 */
export function compareToRange(actual: number, range: ExpectationRange): CompareStatus {
  if (actual < range.min) return 'low';
  if (actual > range.max) return 'high';
  return 'in_range';
}

/**
 * Porcentaje de progreso para una barra visual: actual / max del rango.
 * Clamp a [0, 100]. Si el actual supera el max, igual queda en 100 — la
 * barra no crece más; el "más que lo habitual" se comunica con copy.
 */
export function progressPercent(actual: number, range: ExpectationRange): number {
  if (range.max <= 0) return 0;
  const raw = (actual / range.max) * 100;
  if (raw < 0) return 0;
  if (raw > 100) return 100;
  return raw;
}
