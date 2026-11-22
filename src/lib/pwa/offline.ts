export const OFFLINE_PATH = '/offline';

/**
 * A dónde ir al reintentar desde la página offline. El service worker la
 * sirve en la URL que la persona quería abrir, así que basta con recargar
 * (null). Solo si alguien abrió /offline a mano la mandamos al inicio.
 */
export function getRetryTarget(pathname: string): string | null {
  return pathname === OFFLINE_PATH ? '/home' : null;
}
