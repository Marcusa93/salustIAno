/**
 * Curvas de crecimiento de la OMS — WHO Child Growth Standards (2006).
 *
 * Datos LMS oficiales publicados en https://www.who.int/childgrowth/standards/
 * Cada punto: { ageDays, L, M, S }. Hardcoded para 0-24 meses (donde
 * Salu va a estar la mayor parte de su primer tracking).
 *
 * La fórmula LMS de Cole permite convertir un valor X (peso, talla,
 * perímetro) a un Z-score y de ahí a un percentil:
 *
 *   Z = ((X/M)^L - 1) / (L * S)        si L != 0
 *   Z = ln(X/M) / S                    si L == 0
 *
 * Después Z → percentil vía CDF normal.
 *
 * Fuente: WHO Child Growth Standards: Methods and development. WHO 2006.
 * Curvas usadas:
 *   - Weight-for-age boys / girls 0-24 months
 *   - Length-for-age boys / girls 0-24 months
 *   - Head circumference-for-age boys / girls 0-24 months
 *
 * Consideraciones:
 *   - Para edades fuera del rango 0-730 días, devolvemos null (no hay
 *     curva confiable hasta que la familia cargue otra fuente).
 *   - Para sexo 'other' o null, devolvemos null — no inventamos curva.
 *   - Interpolamos linealmente entre puntos cercanos (los datos LMS
 *     oficiales son granulares hasta cada día, pero hardcodeamos los
 *     puntos clave 0/30/61/91/122/152/183/244/304/365/426/487/548/
 *     609/670/730 días — la interpolación entre ellos tiene error
 *     <1% en peso/talla, suficiente para uso familiar).
 */

export type Sex = 'male' | 'female';
export type MeasurementKind = 'weight' | 'length' | 'head_circumference';

export interface LMSPoint {
  /** Edad en días. */
  ageDays: number;
  /** Box-Cox power. */
  L: number;
  /** Median (mediana). */
  M: number;
  /** Coefficient of variation. */
  S: number;
}

// =====================================================================
// BOYS — WHO Child Growth Standards
// =====================================================================

/** Weight-for-age, boys, 0-24 months (en kg). */
const WEIGHT_BOYS: ReadonlyArray<LMSPoint> = [
  { ageDays: 0, L: 0.3487, M: 3.3464, S: 0.14602 },
  { ageDays: 30, L: 0.2297, M: 4.4709, S: 0.13395 },
  { ageDays: 61, L: 0.197, M: 5.5675, S: 0.12385 },
  { ageDays: 91, L: 0.1738, M: 6.3762, S: 0.11727 },
  { ageDays: 122, L: 0.1553, M: 7.0023, S: 0.11316 },
  { ageDays: 152, L: 0.1395, M: 7.5105, S: 0.1108 },
  { ageDays: 183, L: 0.1257, M: 7.934, S: 0.10958 },
  { ageDays: 213, L: 0.1134, M: 8.297, S: 0.1091 },
  { ageDays: 244, L: 0.1021, M: 8.6151, S: 0.10903 },
  { ageDays: 274, L: 0.0917, M: 8.9014, S: 0.10925 },
  { ageDays: 305, L: 0.082, M: 9.1649, S: 0.10968 },
  { ageDays: 335, L: 0.073, M: 9.4122, S: 0.11027 },
  { ageDays: 365, L: 0.0644, M: 9.6479, S: 0.11097 },
  { ageDays: 426, L: 0.0485, M: 10.0945, S: 0.11261 },
  { ageDays: 487, L: 0.0339, M: 10.519, S: 0.11445 },
  { ageDays: 548, L: 0.0204, M: 10.9326, S: 0.11633 },
  { ageDays: 609, L: 0.0078, M: 11.3393, S: 0.11823 },
  { ageDays: 670, L: -0.0042, M: 11.7384, S: 0.12012 },
  { ageDays: 730, L: -0.0156, M: 12.118, S: 0.12198 },
];

/** Length-for-age, boys, 0-24 months (en cm, recumbent length 0-2 años). */
const LENGTH_BOYS: ReadonlyArray<LMSPoint> = [
  { ageDays: 0, L: 1, M: 49.8842, S: 0.03795 },
  { ageDays: 30, L: 1, M: 54.7244, S: 0.03557 },
  { ageDays: 61, L: 1, M: 58.4249, S: 0.03424 },
  { ageDays: 91, L: 1, M: 61.4292, S: 0.03328 },
  { ageDays: 122, L: 1, M: 63.886, S: 0.03257 },
  { ageDays: 152, L: 1, M: 65.9026, S: 0.03204 },
  { ageDays: 183, L: 1, M: 67.6236, S: 0.03165 },
  { ageDays: 213, L: 1, M: 69.1645, S: 0.03139 },
  { ageDays: 244, L: 1, M: 70.5994, S: 0.0312 },
  { ageDays: 274, L: 1, M: 71.9687, S: 0.03106 },
  { ageDays: 305, L: 1, M: 73.2812, S: 0.03097 },
  { ageDays: 335, L: 1, M: 74.5388, S: 0.0309 },
  { ageDays: 365, L: 1, M: 75.7488, S: 0.03083 },
  { ageDays: 426, L: 1, M: 78.0497, S: 0.0308 },
  { ageDays: 487, L: 1, M: 80.1799, S: 0.0308 },
  { ageDays: 548, L: 1, M: 82.1693, S: 0.03085 },
  { ageDays: 609, L: 1, M: 84.04, S: 0.03093 },
  { ageDays: 670, L: 1, M: 85.81, S: 0.03103 },
  { ageDays: 730, L: 1, M: 87.4906, S: 0.03114 },
];

/** Head-circumference-for-age, boys, 0-24 months (en cm). */
const HEAD_BOYS: ReadonlyArray<LMSPoint> = [
  { ageDays: 0, L: 1, M: 34.4618, S: 0.03686 },
  { ageDays: 30, L: 1, M: 37.2759, S: 0.03133 },
  { ageDays: 61, L: 1, M: 39.1285, S: 0.0285 },
  { ageDays: 91, L: 1, M: 40.5135, S: 0.02701 },
  { ageDays: 122, L: 1, M: 41.6317, S: 0.02611 },
  { ageDays: 152, L: 1, M: 42.5576, S: 0.02554 },
  { ageDays: 183, L: 1, M: 43.3306, S: 0.02516 },
  { ageDays: 213, L: 1, M: 43.9803, S: 0.02491 },
  { ageDays: 244, L: 1, M: 44.5302, S: 0.02473 },
  { ageDays: 274, L: 1, M: 45.0027, S: 0.0246 },
  { ageDays: 305, L: 1, M: 45.4118, S: 0.0245 },
  { ageDays: 335, L: 1, M: 45.7679, S: 0.02443 },
  { ageDays: 365, L: 1, M: 46.0828, S: 0.02437 },
  { ageDays: 426, L: 1, M: 46.6105, S: 0.02429 },
  { ageDays: 487, L: 1, M: 47.0418, S: 0.02425 },
  { ageDays: 548, L: 1, M: 47.4032, S: 0.02422 },
  { ageDays: 609, L: 1, M: 47.7137, S: 0.02421 },
  { ageDays: 670, L: 1, M: 47.9838, S: 0.02421 },
  { ageDays: 730, L: 1, M: 48.2206, S: 0.02421 },
];

// =====================================================================
// GIRLS — WHO Child Growth Standards
// =====================================================================

/** Weight-for-age, girls, 0-24 months (en kg). */
const WEIGHT_GIRLS: ReadonlyArray<LMSPoint> = [
  { ageDays: 0, L: 0.3809, M: 3.2322, S: 0.14171 },
  { ageDays: 30, L: 0.1714, M: 4.1873, S: 0.13724 },
  { ageDays: 61, L: 0.0962, M: 5.1282, S: 0.13 },
  { ageDays: 91, L: 0.0402, M: 5.8458, S: 0.12619 },
  { ageDays: 122, L: -0.005, M: 6.4237, S: 0.12402 },
  { ageDays: 152, L: -0.043, M: 6.8985, S: 0.1226 },
  { ageDays: 183, L: -0.0756, M: 7.297, S: 0.12174 },
  { ageDays: 213, L: -0.1039, M: 7.6422, S: 0.12116 },
  { ageDays: 244, L: -0.1288, M: 7.9487, S: 0.12076 },
  { ageDays: 274, L: -0.1507, M: 8.2254, S: 0.12047 },
  { ageDays: 305, L: -0.17, M: 8.48, S: 0.12025 },
  { ageDays: 335, L: -0.1872, M: 8.7192, S: 0.12008 },
  { ageDays: 365, L: -0.2024, M: 8.9481, S: 0.11995 },
  { ageDays: 426, L: -0.2278, M: 9.3848, S: 0.11978 },
  { ageDays: 487, L: -0.2484, M: 9.8061, S: 0.11969 },
  { ageDays: 548, L: -0.2654, M: 10.2188, S: 0.11969 },
  { ageDays: 609, L: -0.2795, M: 10.6258, S: 0.11975 },
  { ageDays: 670, L: -0.2914, M: 11.0274, S: 0.11984 },
  { ageDays: 730, L: -0.3015, M: 11.4244, S: 0.11997 },
];

const LENGTH_GIRLS: ReadonlyArray<LMSPoint> = [
  { ageDays: 0, L: 1, M: 49.1477, S: 0.0379 },
  { ageDays: 30, L: 1, M: 53.6872, S: 0.0364 },
  { ageDays: 61, L: 1, M: 57.0673, S: 0.03568 },
  { ageDays: 91, L: 1, M: 59.8029, S: 0.0352 },
  { ageDays: 122, L: 1, M: 62.0899, S: 0.03486 },
  { ageDays: 152, L: 1, M: 64.0301, S: 0.03463 },
  { ageDays: 183, L: 1, M: 65.7311, S: 0.03448 },
  { ageDays: 213, L: 1, M: 67.2873, S: 0.03441 },
  { ageDays: 244, L: 1, M: 68.749, S: 0.03439 },
  { ageDays: 274, L: 1, M: 70.1435, S: 0.03442 },
  { ageDays: 305, L: 1, M: 71.4818, S: 0.03447 },
  { ageDays: 335, L: 1, M: 72.771, S: 0.03455 },
  { ageDays: 365, L: 1, M: 74.0152, S: 0.03466 },
  { ageDays: 426, L: 1, M: 76.3817, S: 0.0349 },
  { ageDays: 487, L: 1, M: 78.605, S: 0.03517 },
  { ageDays: 548, L: 1, M: 80.7079, S: 0.03543 },
  { ageDays: 609, L: 1, M: 82.7036, S: 0.03568 },
  { ageDays: 670, L: 1, M: 84.6038, S: 0.0359 },
  { ageDays: 730, L: 1, M: 86.4153, S: 0.03611 },
];

const HEAD_GIRLS: ReadonlyArray<LMSPoint> = [
  { ageDays: 0, L: 1, M: 33.8787, S: 0.03496 },
  { ageDays: 30, L: 1, M: 36.5463, S: 0.03078 },
  { ageDays: 61, L: 1, M: 38.2521, S: 0.02855 },
  { ageDays: 91, L: 1, M: 39.5328, S: 0.02728 },
  { ageDays: 122, L: 1, M: 40.5817, S: 0.02645 },
  { ageDays: 152, L: 1, M: 41.459, S: 0.02588 },
  { ageDays: 183, L: 1, M: 42.1995, S: 0.02547 },
  { ageDays: 213, L: 1, M: 42.829, S: 0.02517 },
  { ageDays: 244, L: 1, M: 43.3671, S: 0.02495 },
  { ageDays: 274, L: 1, M: 43.8326, S: 0.02478 },
  { ageDays: 305, L: 1, M: 44.2418, S: 0.02464 },
  { ageDays: 335, L: 1, M: 44.6051, S: 0.02453 },
  { ageDays: 365, L: 1, M: 44.9298, S: 0.02444 },
  { ageDays: 426, L: 1, M: 45.4926, S: 0.02431 },
  { ageDays: 487, L: 1, M: 45.9648, S: 0.02421 },
  { ageDays: 548, L: 1, M: 46.3666, S: 0.02414 },
  { ageDays: 609, L: 1, M: 46.7141, S: 0.02408 },
  { ageDays: 670, L: 1, M: 47.0186, S: 0.02404 },
  { ageDays: 730, L: 1, M: 47.2873, S: 0.02401 },
];

// =====================================================================
// Lookup
// =====================================================================

const TABLES: Record<Sex, Record<MeasurementKind, ReadonlyArray<LMSPoint>>> = {
  male: { weight: WEIGHT_BOYS, length: LENGTH_BOYS, head_circumference: HEAD_BOYS },
  female: { weight: WEIGHT_GIRLS, length: LENGTH_GIRLS, head_circumference: HEAD_GIRLS },
};

/**
 * Devuelve la curva LMS completa para un sexo y tipo de medición
 * dado. Útil para renderizar las bandas de fondo del chart (p3, p15,
 * p50, p85, p97).
 */
export function lmsTableFor(sex: Sex, kind: MeasurementKind): ReadonlyArray<LMSPoint> {
  return TABLES[sex][kind];
}

/**
 * Interpola linealmente los parámetros L, M, S para una edad
 * arbitraria entre dos puntos LMS conocidos.
 */
function interpolateLMS(table: ReadonlyArray<LMSPoint>, ageDays: number): LMSPoint | null {
  if (table.length === 0) return null;
  const first = table[0];
  const last = table[table.length - 1];
  if (!first || !last) return null;
  if (ageDays < first.ageDays || ageDays > last.ageDays) return null;

  // Encontrar los dos puntos que rodean ageDays.
  for (let i = 0; i < table.length - 1; i++) {
    const p1 = table[i];
    const p2 = table[i + 1];
    if (!p1 || !p2) continue;
    if (ageDays >= p1.ageDays && ageDays <= p2.ageDays) {
      const t = (ageDays - p1.ageDays) / (p2.ageDays - p1.ageDays);
      return {
        ageDays,
        L: p1.L + (p2.L - p1.L) * t,
        M: p1.M + (p2.M - p1.M) * t,
        S: p1.S + (p2.S - p1.S) * t,
      };
    }
  }
  return null;
}

/**
 * Convierte un Z-score a percentil (0-100). Usa la aproximación de
 * Abramowitz & Stegun para la CDF normal — error <7.5e-8, más que
 * suficiente para mostrar a la familia.
 */
function zToPercentile(z: number): number {
  // CDF normal estándar.
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  // Aproximación A&S 7.1.26
  const t = 1 / (1 + 0.3275911 * x);
  const erf =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  const cdf = 0.5 * (1 + sign * erf);
  return Math.max(0.1, Math.min(99.9, cdf * 100));
}

/**
 * Calcula percentil OMS para una medición. Devuelve null si:
 *   - el sexo es 'other' o desconocido
 *   - la edad está fuera del rango cubierto (0-24 meses)
 *   - el valor es absurdo (negativo o cero)
 *
 * El llamador interpreta null como "no se pudo calcular" y muestra
 * solo el valor crudo.
 */
export function percentileForMeasurement(input: {
  sex: Sex | 'other' | null | undefined;
  kind: MeasurementKind;
  /** Valor en kg (peso) o cm (talla / perímetro). */
  value: number;
  /** Edad del bebé al momento de la medición, en días. */
  ageDays: number;
}): number | null {
  if (input.sex !== 'male' && input.sex !== 'female') return null;
  if (!Number.isFinite(input.value) || input.value <= 0) return null;
  if (!Number.isFinite(input.ageDays) || input.ageDays < 0) return null;

  const table = TABLES[input.sex][input.kind];
  const lms = interpolateLMS(table, input.ageDays);
  if (!lms) return null;

  const { L, M, S } = lms;
  let z: number;
  if (Math.abs(L) < 0.01) {
    z = Math.log(input.value / M) / S;
  } else {
    z = ((input.value / M) ** L - 1) / (L * S);
  }
  return zToPercentile(z);
}

/**
 * Inverso del cálculo: dado un percentil objetivo, devuelve qué valor
 * de la medición corresponde a esa edad. Útil para dibujar las bandas
 * p3 / p15 / p50 / p85 / p97 en el chart.
 */
export function valueAtPercentile(input: {
  sex: Sex;
  kind: MeasurementKind;
  ageDays: number;
  percentile: number;
}): number | null {
  const table = TABLES[input.sex][input.kind];
  const lms = interpolateLMS(table, input.ageDays);
  if (!lms) return null;
  const z = percentileToZ(input.percentile);
  const { L, M, S } = lms;
  if (Math.abs(L) < 0.01) {
    return M * Math.exp(z * S);
  }
  return M * (1 + L * S * z) ** (1 / L);
}

/**
 * Inversa simple de la CDF normal estándar, para los percentiles fijos
 * que usamos (3, 15, 50, 85, 97). Usamos valores tabulados — más rápido
 * y no requiere algoritmo de inversión iterativo.
 */
function percentileToZ(p: number): number {
  // Tabla con los percentiles que dibujamos como bandas.
  const KNOWN: Record<number, number> = {
    3: -1.881,
    15: -1.036,
    50: 0,
    85: 1.036,
    97: 1.881,
  };
  const direct = KNOWN[Math.round(p)];
  if (direct !== undefined) return direct;
  // Para otros valores, usamos aproximación de Beasley-Springer-Moro
  // simplificada (fine para mostrar UI).
  const q = p / 100;
  if (q <= 0) return -3.5;
  if (q >= 1) return 3.5;
  const t = Math.sqrt(-2 * Math.log(q < 0.5 ? q : 1 - q));
  const z =
    t -
    (2.515517 + 0.802853 * t + 0.010328 * t * t) /
      (1 + 1.432788 * t + 0.189269 * t * t + 0.001308 * t * t * t);
  return q < 0.5 ? -z : z;
}
