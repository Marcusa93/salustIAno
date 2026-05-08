/**
 * Ventanas de vigilia recomendadas (wake windows) por edad del bebé.
 *
 * Origen: rangos típicos de literatura pediátrica (AAP, Healthy Sleep
 * Habits, Happy Child de Marc Weissbluth, Taking Cara Babies). Son
 * ORIENTATIVOS — cada bebé es distinto y la propia familia pesa más que
 * cualquier tabla. Por eso el tracker muestra esto como "ventana sugerida"
 * y nunca como prescripción.
 *
 * Sin diagnóstico, sin alertas. Solo "después de dormir, le suele venir
 * sueño otra vez en X minutos". Si el bebé dura más, no es un problema.
 */

export interface WakeWindow {
  /** Inclusive — días de edad mínima del rango. */
  minDays: number;
  /** Exclusive — días de edad por encima del cual ya no aplica este rango. */
  maxDays: number;
  /** Etiqueta corta del rango etario. */
  ageLabel: string;
  /** Ventana de vigilia mínima recomendada, en minutos. */
  minMinutes: number;
  /** Ventana de vigilia máxima recomendada, en minutos. */
  maxMinutes: number;
}

const WAKE_WINDOWS: ReadonlyArray<WakeWindow> = [
  { minDays: 0, maxDays: 30, ageLabel: '0–1 mes', minMinutes: 45, maxMinutes: 60 },
  { minDays: 30, maxDays: 60, ageLabel: '1–2 meses', minMinutes: 60, maxMinutes: 90 },
  { minDays: 60, maxDays: 90, ageLabel: '2–3 meses', minMinutes: 75, maxMinutes: 105 },
  { minDays: 90, maxDays: 120, ageLabel: '3–4 meses', minMinutes: 75, maxMinutes: 120 },
  { minDays: 120, maxDays: 150, ageLabel: '4–5 meses', minMinutes: 90, maxMinutes: 135 },
  { minDays: 150, maxDays: 210, ageLabel: '5–7 meses', minMinutes: 120, maxMinutes: 150 },
  { minDays: 210, maxDays: 300, ageLabel: '7–10 meses', minMinutes: 150, maxMinutes: 180 },
  { minDays: 300, maxDays: 420, ageLabel: '10–14 meses', minMinutes: 180, maxMinutes: 240 },
  { minDays: 420, maxDays: 720, ageLabel: '14–24 meses', minMinutes: 240, maxMinutes: 360 },
];

export function wakeWindowFor(ageDays: number | null): WakeWindow | null {
  if (ageDays === null || ageDays < 0) return null;
  for (const w of WAKE_WINDOWS) {
    if (ageDays >= w.minDays && ageDays < w.maxDays) return w;
  }
  return null;
}

export interface NextSleepSuggestion {
  /** Inicio sugerido para volver a dormir (Date). */
  rangeStart: Date;
  /** Fin sugerido del rango (Date). */
  rangeEnd: Date;
  /** Ventana de referencia usada para calcular. */
  window: WakeWindow;
  /**
   * Cuántos minutos quedan hasta el inicio de la ventana sugerida. Negativo
   * si la ventana ya empezó. `null` si ya se pasó la ventana entera.
   */
  minutesUntilStart: number;
}

/**
 * Sugiere cuándo volver a dormir, dado:
 *   - la edad en días del bebé,
 *   - el momento del último despertar (cierre del sueño anterior).
 *
 * Devuelve `null` si no hay rango aplicable (recién nacido sin datos,
 * mayor de 24 meses, etc.) o si no hay despertar previo.
 */
export function suggestNextSleep(
  ageDays: number | null,
  lastWokeUpAt: string | Date | null,
  now: Date = new Date(),
): NextSleepSuggestion | null {
  if (lastWokeUpAt === null) return null;
  const window = wakeWindowFor(ageDays);
  if (!window) return null;

  const wokeAt = typeof lastWokeUpAt === 'string' ? new Date(lastWokeUpAt) : lastWokeUpAt;
  if (Number.isNaN(wokeAt.getTime())) return null;

  const rangeStart = new Date(wokeAt.getTime() + window.minMinutes * 60_000);
  const rangeEnd = new Date(wokeAt.getTime() + window.maxMinutes * 60_000);
  const minutesUntilStart = Math.round((rangeStart.getTime() - now.getTime()) / 60_000);

  return { rangeStart, rangeEnd, window, minutesUntilStart };
}
