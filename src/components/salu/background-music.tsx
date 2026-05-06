'use client';

import { cn } from '@/lib/utils';
import { Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'salu:music-on';
const SRC = '/audio/en-mi-corazon-viviras.mp3';

/**
 * Música ambiente en loop ("En mi corazón vivirás" — Tarzán). Mounted en
 * el root layout para que el <audio> sobreviva la navegación entre rutas
 * (App Router preserva el layout). Botón flotante chico para mute/play.
 *
 * Por política de autoplay, no arranca sin gesto del usuario. Si el user
 * la dejó "on" en una sesión previa, intentamos retomar al cargar; si el
 * navegador lo bloquea, esperamos al primer click/tecla en cualquier lado.
 */
export function BackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const wantsOn = stored === '1';
    setEnabled(wantsOn);
    setReady(true);

    if (!wantsOn) return;
    const audio = audioRef.current;
    if (!audio) return;

    audio.play().catch(() => {
      const onFirstGesture = () => {
        audio.play().catch(() => {});
        window.removeEventListener('pointerdown', onFirstGesture);
        window.removeEventListener('keydown', onFirstGesture);
      };
      window.addEventListener('pointerdown', onFirstGesture, { once: true });
      window.addEventListener('keydown', onFirstGesture, { once: true });
    });
  }, []);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    const next = !enabled;
    setEnabled(next);
    localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
    if (next) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }

  if (!ready) return null;

  return (
    <>
      {/* biome-ignore lint/a11y/useMediaCaption: música ambiente decorativa, sin diálogo. */}
      <audio ref={audioRef} src={SRC} loop preload="auto" />
      <button
        type="button"
        onClick={toggle}
        aria-label={enabled ? 'Silenciar música' : 'Reproducir música'}
        aria-pressed={enabled}
        className={cn(
          // Sentado arriba del FloatingSalu (size-14 + bottom-4 en desktop;
          // safe-area + 76px en mobile por el bottom-nav). En landing donde
          // no hay FloatingSalu queda un poco más arriba — está bien.
          'fixed right-4 z-40 size-10 rounded-full',
          'bottom-[calc(env(safe-area-inset-bottom)+9.5rem)] md:bottom-20',
          'flex items-center justify-center',
          'border border-border bg-background/90 text-foreground/70 shadow-sm backdrop-blur',
          'transition-all duration-200 hover:text-foreground hover:shadow active:scale-95',
        )}
      >
        {enabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
      </button>
    </>
  );
}
