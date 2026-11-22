/**
 * Detección de plataforma para la capa PWA (instalación y push).
 *
 * Todo lo que decide es puro y recibe el user agent por parámetro, así se
 * testea sin navegador. `readDeviceInfo` es lo único que toca `window`.
 */

export type PwaPlatform = 'ios' | 'android' | 'other';

export interface IosVersion {
  major: number;
  minor: number;
}

export interface DeviceInfo {
  platform: PwaPlatform;
  iosVersion: IosVersion | null;
  /** Abierta desde el ícono (PWA instalada), sin la barra del navegador. */
  standalone: boolean;
}

export function detectPlatform(userAgent: string, maxTouchPoints: number): PwaPlatform {
  if (/iPad|iPhone|iPod/.test(userAgent)) return 'ios';
  // iPadOS 13+ se presenta como Safari de Mac; lo delata la pantalla táctil.
  if (userAgent.includes('Macintosh') && maxTouchPoints > 1) return 'ios';
  if (/Android/i.test(userAgent)) return 'android';
  return 'other';
}

/**
 * Versión de iOS/iPadOS. iPhone trae "OS 17_4" en el UA; el iPad con UA de
 * Mac solo trae la versión de Safari ("Version/17.4"), que va a la par.
 */
export function getIosVersion(userAgent: string): IosVersion | null {
  const match = /OS (\d+)[_.](\d+)/.exec(userAgent) ?? /Version\/(\d+)\.(\d+)/.exec(userAgent);
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]) };
}

/** Web push en iPhone llegó con iOS 16.4, y solo para apps instaladas. */
export function iosSupportsWebPush(version: IosVersion): boolean {
  return version.major > 16 || (version.major === 16 && version.minor >= 4);
}

export function readDeviceInfo(): DeviceInfo {
  const { userAgent, maxTouchPoints } = window.navigator;
  const platform = detectPlatform(userAgent, maxTouchPoints ?? 0);
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    // Safari de iOS expone una propiedad propia en navigator.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return {
    platform,
    iosVersion: platform === 'ios' ? getIosVersion(userAgent) : null,
    standalone,
  };
}

// ---------------------------------------------------------------------------
// Sugerencia de instalación
// ---------------------------------------------------------------------------

export const INSTALL_HINT_STORAGE_KEY = 'salu-install-hint-dismissed-at';
/** Si la familia descartó la sugerencia, no insistimos por ~30 días. */
export const INSTALL_HINT_DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type InstallHintKind = 'ios' | 'prompt' | null;

export function isInstallHintDismissed(rawDismissedAt: string | null, now: number): boolean {
  if (!rawDismissedAt) return false;
  const at = Number.parseInt(rawDismissedAt, 10);
  return Number.isFinite(at) && now - at < INSTALL_HINT_DISMISS_TTL_MS;
}

/**
 * Qué sugerencia mostrar:
 *  - 'prompt': el navegador ofreció instalar (`beforeinstallprompt`, Android
 *    y Chromium de escritorio) → botón "Instalar".
 *  - 'ios': iPhone/iPad sin instalar → pasos de Compartir → Agregar a inicio
 *    (iOS no tiene prompt propio).
 *  - null: ya está instalada, la descartaron hace poco o no aplica.
 */
export function getInstallHintKind(input: {
  device: DeviceInfo;
  canPrompt: boolean;
  dismissedAt: string | null;
  now: number;
}): InstallHintKind {
  if (input.device.standalone) return null;
  if (isInstallHintDismissed(input.dismissedAt, input.now)) return null;
  if (input.canPrompt) return 'prompt';
  if (input.device.platform === 'ios') return 'ios';
  return null;
}
