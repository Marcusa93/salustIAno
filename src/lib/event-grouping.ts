/**
 * Agrupado temporal de eventos para "Recientes" del home. Convierte una
 * lista ordenada (más nuevo primero) en bloques con título humano:
 *
 *   "Hace un rato"      — eventos de la última hora
 *   "Hoy"               — el resto de hoy
 *   "Ayer"              — eventos de ayer
 *   "Días anteriores"   — todo lo previo
 *
 * El "hoy" se mide en hora de Argentina (UTC-3, sin DST). En UTC, las
 * 22 hs de Argentina caen al día siguiente y el agrupado se rompería.
 */

const AR_OFFSET_HOURS = -3;

export type GroupKey = 'recent' | 'today' | 'yesterday' | 'older';

export interface GroupBucket<T> {
  key: GroupKey;
  label: string;
  items: T[];
}

const LABELS: Record<GroupKey, string> = {
  recent: 'Hace un rato',
  today: 'Hoy',
  yesterday: 'Ayer',
  older: 'Días anteriores',
};

function arDateKey(d: Date): string {
  const ar = new Date(d.getTime() + AR_OFFSET_HOURS * 60 * 60 * 1000);
  return ar.toISOString().slice(0, 10);
}

/**
 * Devuelve la clasificación de un evento dado el "ahora". Útil para
 * testear sin tener que pasar arrays.
 */
export function classifyEvent(eventISO: string, now: Date = new Date()): GroupKey {
  const eventMs = new Date(eventISO).getTime();
  const nowMs = now.getTime();
  if (nowMs - eventMs < 60 * 60 * 1000 && eventMs <= nowMs) return 'recent';

  const eventDay = arDateKey(new Date(eventISO));
  const todayDay = arDateKey(now);
  if (eventDay === todayDay) return 'today';

  const yesterdayMs = now.getTime() - 24 * 60 * 60 * 1000;
  const yesterdayDay = arDateKey(new Date(yesterdayMs));
  if (eventDay === yesterdayDay) return 'yesterday';

  return 'older';
}

/**
 * Agrupa una lista de eventos en buckets temporales. Mantiene el orden
 * relativo dentro de cada bucket (asume que `items` ya viene ordenada).
 * No incluye buckets vacíos.
 */
export function groupEventsByTime<T extends { occurred_at: string }>(
  items: ReadonlyArray<T>,
  now: Date = new Date(),
): Array<GroupBucket<T>> {
  const buckets: Record<GroupKey, T[]> = {
    recent: [],
    today: [],
    yesterday: [],
    older: [],
  };
  for (const it of items) {
    buckets[classifyEvent(it.occurred_at, now)].push(it);
  }
  const order: GroupKey[] = ['recent', 'today', 'yesterday', 'older'];
  return order
    .filter((k) => buckets[k].length > 0)
    .map((k) => ({ key: k, label: LABELS[k], items: buckets[k] }));
}

/**
 * Clave de día en hora AR ("YYYY-MM-DD"). Útil para agrupar eventos en
 * /timeline donde necesitamos un día calendario por sección, no buckets
 * relativos.
 */
export function arDayKeyFor(iso: string): string {
  return arDateKey(new Date(iso));
}

export interface DayGroup<T> {
  /** Clave de día en hora AR (`YYYY-MM-DD`). */
  key: string;
  /** Etiqueta humana: "Hoy", "Ayer", o "Lunes 6 de mayo". */
  label: string;
  items: T[];
}

/**
 * Agrupa eventos por día calendario AR (sin importar a qué hora UTC
 * pasen). Devuelve los días en orden descendente — el más reciente
 * primero — preservando el orden interno de cada día.
 */
export function groupEventsByDay<T extends { occurred_at: string }>(
  items: ReadonlyArray<T>,
  now: Date = new Date(),
): Array<DayGroup<T>> {
  const byDay = new Map<string, T[]>();
  for (const it of items) {
    const k = arDayKeyFor(it.occurred_at);
    const arr = byDay.get(k);
    if (arr) arr.push(it);
    else byDay.set(k, [it]);
  }
  const todayKey = arDateKey(now);
  const yesterdayKey = arDateKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));

  return Array.from(byDay.entries())
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([key, dayItems]) => ({
      key,
      label: dayHeaderLabel(key, todayKey, yesterdayKey),
      items: dayItems,
    }));
}

function dayHeaderLabel(dayKey: string, todayKey: string, yesterdayKey: string): string {
  if (dayKey === todayKey) return 'Hoy';
  if (dayKey === yesterdayKey) return 'Ayer';
  // dayKey es YYYY-MM-DD en hora AR. Lo formateamos como "Lunes 6 de mayo".
  // Construimos un Date a las 12:00 UTC del día para evitar saltar de día
  // por timezone.
  const d = new Date(`${dayKey}T12:00:00Z`);
  const raw = d.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
  // es-AR mete una coma entre weekday y día ("Lunes, 4 de mayo"). La
  // sacamos para que el header sea más limpio: "Lunes 4 de mayo".
  const noComma = raw.replace(/,\s*/, ' ');
  return noComma.charAt(0).toUpperCase() + noComma.slice(1);
}
