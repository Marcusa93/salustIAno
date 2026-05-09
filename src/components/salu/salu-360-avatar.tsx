'use client';

import { cn } from '@/lib/utils';
import { useEffect, useRef } from 'react';

interface Salu360AvatarProps {
  /** Tamaño del avatar en pixels (lado del círculo). Default 56. */
  size?: number;
  className?: string;
  /**
   * Si false, oculta el avatar. Útil cuando el componente se monta
   * pero querés esconderlo por feature flag o ruta.
   */
  enabled?: boolean;
}

/**
 * Avatar de Salustiano en loop — video MP4 360º grabado por la familia,
 * recortado en círculo para que parezca un avatar dinámico.
 *
 * Decisiones:
 *  - autoPlay + muted + playsInline: requisito de Safari iOS y Chrome
 *    para que el autoplay funcione sin gesto del user.
 *  - loop: el video es corto, queremos movimiento continuo.
 *  - preload="metadata": no descargamos los 9 MB enteros hasta que el
 *    componente está visible. Ayuda en /home con muchas cards.
 *  - object-cover + rounded-full + overflow-hidden: si el video tiene
 *    fondo de color (MP4 estándar no soporta alpha), el recorte
 *    circular lo disimula bastante. Para fondo realmente transparente
 *    haría falta convertir a WebM con VP9+alpha.
 *  - Pause cuando la pestaña no está visible: ahorra batería en mobile.
 */
export function Salu360Avatar({ size = 56, className, enabled = true }: Salu360AvatarProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!enabled) return;
    const video = videoRef.current;
    if (!video) return;
    function onVisibility() {
      if (!video) return;
      if (document.hidden) {
        video.pause();
      } else {
        // catch para iOS — autoplay puede fallar si la pestaña tardó.
        video.play().catch(() => {
          /* noop */
        });
      }
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [enabled]);

  if (!enabled) return null;

  return (
    <span
      className={cn(
        'relative inline-block shrink-0 overflow-hidden rounded-full ring-1 ring-primary/20',
        'bg-primary/10',
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {/* biome-ignore lint/a11y/useMediaCaption: avatar decorativo del bebé en loop, sin audio. */}
      <video
        ref={videoRef}
        src="/salu-360.mp4"
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        // El video puede traer fondo. Con object-cover + el contenedor
        // redondo, queda recortado limpio en cualquier viewport.
        className="size-full object-cover"
      />
    </span>
  );
}
