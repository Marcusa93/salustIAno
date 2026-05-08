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
