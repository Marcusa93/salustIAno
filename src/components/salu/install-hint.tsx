'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Share, X } from 'lucide-react';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'salu-install-hint-dismissed-at';
// Si la familia descartó el hint, no se lo mostramos por ~30 días.
const DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Banner discreto que recuerda a usuarios de iOS cómo instalar Salu como
 * PWA (iOS no tiene prompt automático: hay que tocar el botón Compartir →
 * "Agregar a la pantalla de inicio"). Se muestra:
 *  - Solo en iPhone/iPad
 *  - Solo si NO está corriendo ya como PWA standalone
 *  - Solo si no fue descartado en los últimos 30 días
 *
 * En Android Chrome ya hay prompt automático del browser, así que no nos
 * metemos en esa UX. Resto de browsers desktop tampoco lo necesitan.
 */
export function InstallHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. ¿Ya está instalado como PWA?
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // iOS exposes una propiedad propietaria en navigator.
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return;

    // 2. ¿Es iOS? (ipad nuevos reportan "Macintosh", chequeamos también touch)
    const ua = window.navigator.userAgent;
    const isIOS =
      /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1);
    if (!isIOS) return;

    // 3. ¿Lo descartó hace poco?
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const at = Number.parseInt(raw, 10);
      if (Number.isFinite(at) && Date.now() - at < DISMISS_TTL_MS) return;
    }

    // Pequeño delay para no aparecer simultáneo con otras toasts/animaciones.
    const t = setTimeout(() => setShow(true), 1200);
    return () => clearTimeout(t);
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      /* localStorage bloqueado (modo privado): igual ocultamos para esta sesión */
    }
    setShow(false);
  }

  if (!show) return null;

  return (
    <output
      className={cn(
        'fixed inset-x-2 bottom-[calc(env(safe-area-inset-bottom)+76px)] z-50 mx-auto max-w-sm',
        'animate-stagger-up rounded-2xl border border-border/60 bg-card/95 p-3 shadow-lg backdrop-blur-md',
        'flex items-start gap-3 md:hidden',
      )}
    >
      <span
        aria-hidden
        className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary"
      >
        <Share className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="font-medium text-foreground text-sm leading-tight">
          Instalá Salu en tu iPhone
        </p>
        <p className="text-muted-foreground text-xs leading-snug">
          Tocá el botón Compartir y elegí{' '}
          <span className="font-medium">Agregar a la pantalla de inicio</span> — abrís Salu sin la
          barra del navegador.
        </p>
      </div>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        onClick={dismiss}
        aria-label="Cerrar sugerencia"
        className="-mt-1 -mr-1 shrink-0"
      >
        <X className="size-4" aria-hidden />
      </Button>
    </output>
  );
}
