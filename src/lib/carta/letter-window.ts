/**
 * Cartas que aparecen solas en el inicio durante una ventana de fechas.
 * Fuera de la ventana la carta sigue accesible por su URL, pero nadie se
 * la cruza — así la sorpresa no se arruina antes de tiempo.
 */
interface ScheduledLetter {
  slug: string;
  /** Instantes con offset explícito de Argentina. `until` es exclusivo. */
  from: string;
  until: string;
}

const SCHEDULED_LETTERS: readonly ScheduledLetter[] = [
  // Día de la Madre 2026 (tercer domingo de octubre) y la semana siguiente.
  { slug: 'mama-2026', from: '2026-10-18T00:00:00-03:00', until: '2026-10-26T00:00:00-03:00' },
];

export function scheduledLetterAt(
  now: Date = new Date(),
  letters: readonly ScheduledLetter[] = SCHEDULED_LETTERS,
): string | null {
  const time = now.getTime();
  const active = letters.find(
    (letter) => time >= Date.parse(letter.from) && time < Date.parse(letter.until),
  );
  return active?.slug ?? null;
}
