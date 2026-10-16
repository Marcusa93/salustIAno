/**
 * Respuesta táctil corta al confirmar una acción.
 *
 * - Android y navegadores con Vibration API: `navigator.vibrate`.
 * - iPhone (Safari 18+): no tiene Vibration API, pero dispara la háptica
 *   del sistema al cambiar un `<input type="checkbox" switch>`. Creamos uno
 *   oculto y lo togglear vía su label. Solo funciona dentro de un gesto.
 *
 * Si nada de eso existe, no hace nada: la háptica es un plus, no un requisito.
 */
export type HapticKind = 'tap' | 'success' | 'warning';

const PATTERNS: Record<HapticKind, number | number[]> = {
  tap: 10,
  success: [12, 50, 18],
  warning: [30, 60, 30],
};

export function haptic(kind: HapticKind = 'tap'): void {
  if (typeof window === 'undefined') return;

  if (typeof navigator.vibrate === 'function') {
    navigator.vibrate(PATTERNS[kind]);
    return;
  }

  const label = document.createElement('label');
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  label.append(input);
  label.style.display = 'none';
  document.body.append(label);
  label.click();
  label.remove();
}
