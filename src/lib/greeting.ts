/**
 * Saludo time-aware en español rioplatense, anclado a hora de Argentina
 * (UTC-3, sin DST). Vercel renderiza los Server Components en UTC; si
 * usáramos `now.getHours()` el saludo se desfasaría 3h respecto a la
 * familia. Por eso convertimos manualmente a hora AR.
 *
 * Cortes:
 *   05:00–11:59 → "Buen día"
 *   12:00–18:59 → "Buenas tardes"
 *   19:00–04:59 → "Buenas noches"
 */

const AR_OFFSET_HOURS = -3;

export function greetingFor(now: Date = new Date()): string {
  const utcHour = now.getUTCHours();
  const arHour = (utcHour + AR_OFFSET_HOURS + 24) % 24;
  if (arHour >= 5 && arHour < 12) return 'Buen día';
  if (arHour >= 12 && arHour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

/**
 * Madrugada en hora AR — ventana 22:00–05:59. Usado en /home para
 * activar un modo más sosegado: paleta cálida-oscura y copy que
 * enfatiza el descanso (en lugar del registro frenético del día).
 *
 * Pensado para los turnos nocturnos: la familia abre el home a las 3am
 * porque está dando una toma o cambiando un pañal. La app no tiene que
 * gritar — tiene que estar tranquila.
 */
export function isLateNightAr(now: Date = new Date()): boolean {
  const utcHour = now.getUTCHours();
  const arHour = (utcHour + AR_OFFSET_HOURS + 24) % 24;
  return arHour >= 22 || arHour < 6;
}

/**
 * Etiqueta de fecha completa en español ("Jueves, 8 de mayo"). Usa el
 * locale del runtime — Next la corre server-side, así que el resultado es
 * estable independientemente del browser del usuario. Sigue dependiendo
 * del timezone configurado del runtime; Vercel/UTC más AR offset cubre
 * el caso común.
 */
export function dateLabel(now: Date = new Date()): string {
  const ar = new Date(now.getTime() + AR_OFFSET_HOURS * 60 * 60 * 1000);
  const raw = ar.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}
