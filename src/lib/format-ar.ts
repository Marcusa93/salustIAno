/**
 * Formatters de fecha/hora forzados a hora de Argentina (UTC-3, sin DST).
 *
 * Por qué esto es un módulo separado: `Date.prototype.toLocaleTimeString`
 * y `toLocaleDateString` por default usan la timezone del entorno donde
 * corren. Eso es trampa en una app que renderiza Server Components:
 *
 *   - Local dev (Mac en Argentina): TZ del SO = AR. Funciona.
 *   - Vercel (Server Components): TZ del runtime = UTC. Una hora cargada
 *     a las 11:16 AR (= 14:16 UTC) se muestra como "14:16" en prod.
 *   - Client Components: TZ del browser. Si el usuario está en otro país,
 *     ve la hora de ese país en lugar de Argentina.
 *
 * Nada de eso es lo que queremos: Salu siempre dice "qué hora es ACÁ
 * en Argentina", sin importar dónde corre. La forma correcta es pasar
 * `timeZone: 'America/Argentina/Buenos_Aires'` a cada Intl call.
 *
 * Estos helpers centralizan ese parámetro. Si en el futuro Argentina
 * vuelve a tener DST o se muda la familia, se cambia un solo lugar.
 */

const AR_TZ = 'America/Argentina/Buenos_Aires';

/**
 * Devuelve el instante UTC que corresponde a las 00:00 de HOY en hora
 * de Argentina. Esencial para queries de "eventos del día": en Vercel
 * (server UTC) `new Date(); setHours(0,0,0,0)` da las 00:00 UTC, que
 * en AR son las 21:00 del día anterior — los counts del día salen
 * mal y "Cómo va el día" queda desincronizado.
 *
 * El truco: extraer YYYY-MM-DD en TZ AR vía Intl, y construir un
 * Date desde el ISO con offset explícito -03:00. ECMA garantiza que
 * `new Date('YYYY-MM-DDTHH:mm:ss-03:00')` da el instant UTC correcto
 * sin importar el TZ del runtime.
 */
export function startOfTodayAr(now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: AR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return new Date(`${get('year')}-${get('month')}-${get('day')}T00:00:00-03:00`);
}

/**
 * Como `startOfTodayAr` pero N días atrás. `daysAgo=0` → hoy 00:00 AR,
 * `daysAgo=7` → hace 7 días 00:00 AR.
 */
export function startOfDayArDaysAgo(daysAgo: number, now: Date = new Date()): Date {
  const today = startOfTodayAr(now);
  return new Date(today.getTime() - daysAgo * 24 * 60 * 60 * 1000);
}

/**
 * Final del día (23:59:59.999) en hora AR. Usado en queries con
 * `lte('occurred_at', endOfTodayAr().toISOString())` para incluir
 * eventos cargados hasta la medianoche AR.
 */
export function endOfTodayAr(now: Date = new Date()): Date {
  const start = startOfTodayAr(now);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

/**
 * Hora corta en formato 24h ("14:30"). Para mostrar al lado de eventos
 * ("Empezó a las 14:30").
 */
export function formatTimeAr(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: AR_TZ,
  });
}

/**
 * Fecha en castellano natural — el caller pasa las opciones que quiere
 * (weekday, day, month, year). Siempre en TZ AR.
 *
 * Ejemplos típicos:
 *   formatDateAr(iso, { day: 'numeric', month: 'long' })
 *     → "9 de mayo"
 *   formatDateAr(iso, { weekday: 'long', day: 'numeric', month: 'long' })
 *     → "viernes, 9 de mayo"
 */
export function formatDateAr(iso: string | Date, options: Intl.DateTimeFormatOptions): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleDateString('es-AR', { ...options, timeZone: AR_TZ });
}

/**
 * Fecha + hora juntas. Útil para timestamps de log o para "el martes a
 * las 14:30".
 */
export function formatDateTimeAr(
  iso: string | Date,
  options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  },
): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleString('es-AR', { ...options, timeZone: AR_TZ, hour12: false });
}
