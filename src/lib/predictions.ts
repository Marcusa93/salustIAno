/**
 * Predicciones rule-based para el home — cuándo viene la próxima toma,
 * pañal o sueño basado en el ritmo reciente de la familia.
 *
 * NO es una recomendación clínica ni una alarma — es un complemento al
 * estado vivo del bebé. La copy en la UI debería marcarlo como
 * "estimación a partir del ritmo de los últimos días", nunca como
 * "tiene que pasar tal cosa".
 *
 * El método es deliberadamente simple: tomamos los intervalos entre
 * eventos consecutivos (ej. tiempo entre tomas) de los últimos N días,
 * sacamos la mediana, y proyectamos a partir del último evento. La
 * mediana es más robusta que el promedio cuando hay outliers (una toma
 * larga de 6 hs no debería romper la predicción del próximo intervalo).
 *
 * Si no hay suficientes datos (< 3 intervalos), devolvemos null — la UI
 * decide si mostrar "sin estimación todavía" o esconder la sección.
 */

export interface Prediction {
  /** Hora estimada del próximo evento. */
  expectedAt: Date;
  /** Mediana de los intervalos en minutos — útil para mostrar contexto. */
  medianIntervalMinutes: number;
  /** Cantidad de muestras usadas (> = 3). */
  samples: number;
}

/**
 * Calcula la mediana del array. Devuelve null si está vacío.
 *
 * Para arrays de longitud par, devuelve el promedio de los dos valores
 * centrales. Para impar, el central. Mutación-libre.
 */
function median(values: ReadonlyArray<number>): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    const a = sorted[mid - 1];
    const b = sorted[mid];
    if (a === undefined || b === undefined) return null;
    return (a + b) / 2;
  }
  const v = sorted[mid];
  return v ?? null;
}

/**
 * Calcula los intervalos en minutos entre eventos consecutivos. Asume
 * que `events` viene ordenado por timestamp ascendente. Si no, los
 * resultados pueden ser negativos — los filtramos defensivamente.
 */
function intervalsBetween(events: ReadonlyArray<string>): number[] {
  const intervals: number[] = [];
  for (let i = 1; i < events.length; i++) {
    const prev = events[i - 1];
    const curr = events[i];
    if (!prev || !curr) continue;
    const delta = (new Date(curr).getTime() - new Date(prev).getTime()) / 60_000;
    if (delta > 0) intervals.push(delta);
  }
  return intervals;
}

interface PredictNextOptions {
  /**
   * Filtros de sanidad para descartar intervalos absurdos.
   * Ej. para tomas: descarta intervalos < 15 min (probablemente fueron
   * la misma toma cargada dos veces) y > 8h (la familia se olvidó de
   * cargar y volvió mucho después).
   */
  minIntervalMinutes?: number;
  maxIntervalMinutes?: number;
  /** Mínimo de samples para devolver predicción. Default 3. */
  minSamples?: number;
}

/**
 * Genera una predicción del próximo evento, dado:
 *   - los timestamps históricos (ascendente),
 *   - el último evento (el ancla).
 *
 * Si no hay suficientes intervalos válidos, devuelve null.
 */
export function predictNextEvent(
  historyAscending: ReadonlyArray<string>,
  lastAt: string,
  options: PredictNextOptions = {},
): Prediction | null {
  const {
    minIntervalMinutes = 0,
    maxIntervalMinutes = Number.POSITIVE_INFINITY,
    minSamples = 3,
  } = options;

  const allIntervals = intervalsBetween(historyAscending);
  const validIntervals = allIntervals.filter(
    (m) => m >= minIntervalMinutes && m <= maxIntervalMinutes,
  );
  if (validIntervals.length < minSamples) return null;

  const med = median(validIntervals);
  if (med === null) return null;

  const lastMs = new Date(lastAt).getTime();
  if (Number.isNaN(lastMs)) return null;

  return {
    expectedAt: new Date(lastMs + med * 60_000),
    medianIntervalMinutes: med,
    samples: validIntervals.length,
  };
}

/**
 * Helper para tomas: descarta los intervalos < 30 min (re-cargas) y
 * > 6h (lapsos donde la familia probablemente se olvidó de cargar).
 */
export function predictNextFeeding(
  feedingsAscending: ReadonlyArray<string>,
  lastAt: string,
): Prediction | null {
  return predictNextEvent(feedingsAscending, lastAt, {
    minIntervalMinutes: 30,
    maxIntervalMinutes: 360,
  });
}

/**
 * Helper para pañales: descarta < 15 min (re-cargas) y > 8h.
 */
export function predictNextDiaper(
  diapersAscending: ReadonlyArray<string>,
  lastAt: string,
): Prediction | null {
  return predictNextEvent(diapersAscending, lastAt, {
    minIntervalMinutes: 15,
    maxIntervalMinutes: 480,
  });
}

/**
 * Format para UI: "16:30" ó "mañana 09:15" si está fuera del día.
 *
 * `toDateString()` y operaciones similares usan la TZ del runtime, lo
 * que en Vercel (UTC) da día equivocado para horarios AR. Convertimos
 * todo a hora AR antes de comparar día.
 */
export function formatPredictionTime(d: Date, now: Date = new Date()): string {
  // hour12:false + timeZone AR: la familia siempre quiere ver hora local
  // de Argentina aunque el server esté en UTC.
  const time = d.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Argentina/Buenos_Aires',
  });
  // Comparación de día en hora AR (no en TZ del runtime).
  const arDayKey = (date: Date) =>
    date.toLocaleDateString('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'America/Argentina/Buenos_Aires',
    });
  const dKey = arDayKey(d);
  const nowKey = arDayKey(now);
  if (dKey === nowKey) return time;
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (dKey === arDayKey(tomorrow)) return `mañana ${time}`;
  return `${d.toLocaleDateString('es-AR', { weekday: 'short', timeZone: 'America/Argentina/Buenos_Aires' })} ${time}`;
}

/**
 * Calcula promedio de eventos por día en un rango. Útil para el
 * "promedio últimos 7 días" en el dashboard.
 */
export function averagePerDay(eventCount: number, daysInWindow: number): number {
  if (daysInWindow <= 0) return 0;
  return eventCount / daysInWindow;
}
