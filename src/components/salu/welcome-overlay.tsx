'use client';

import { Salu360Avatar } from '@/components/salu/salu-360-avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Baby,
  BookHeart,
  Camera,
  ChevronLeft,
  ChevronRight,
  Milk,
  Moon,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

interface WelcomeOverlayProps {
  /** ID del user — la flag de "ya vio el welcome" se guarda por user. */
  userId: string;
  /** Nombre del bebé para personalizar copy. */
  childName: string;
  /** Nombre de quien está viendo el overlay (Marco, Abril, etc.). */
  displayName: string | null;
}

const STORAGE_PREFIX = 'salu-welcome-seen-v1:';

/**
 * Overlay de bienvenida que aparece la PRIMERA vez que un user nuevo
 * entra a /home. Pensado para los miembros que llegan con código de
 * invitación o cuenta recién creada por un admin: aterrizan a una app
 * llena de información y necesitan 30 segundos de orientación.
 *
 * Decisiones:
 *   - localStorage flag por userId: una vez visto, no vuelve. Si el
 *     user limpia el browser, lo ve de nuevo (no es crítico).
 *   - 4 slides con swipe-like nav (botones prev/next + dots). Sin
 *     animaciones complejas — es un onboarding, no un demo reel.
 *   - Cierre con X arriba o "Entrar" en el último slide.
 *   - Solo en mobile/desktop visible: se hide en `print:`.
 *   - Avatar 360 vivo en el primer slide para que la persona vea YA
 *     al bebé real, no un placeholder.
 */
export function WelcomeOverlay({ userId, childName, displayName }: WelcomeOverlayProps) {
  const [open, setOpen] = useState(false);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const seen = localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
      if (!seen) setOpen(true);
    } catch {
      /* localStorage bloqueado: no mostramos para no atrapar al user */
    }
  }, [userId]);

  function close() {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${userId}`, String(Date.now()));
    } catch {
      /* noop */
    }
    setOpen(false);
  }

  if (!open) return null;

  const slides = buildSlides({ childName, displayName });
  const total = slides.length;
  const current = slides[slide];
  if (!current) return null;
  const isLast = slide === total - 1;

  return (
    <dialog
      open
      aria-modal="true"
      aria-label="Bienvenida a Salu"
      className="fixed inset-0 z-[70] m-0 flex h-full max-h-none w-full max-w-none items-center justify-center bg-foreground/40 p-4 text-foreground backdrop-blur-md print:hidden"
    >
      <div
        className={cn(
          'relative flex w-full max-w-md flex-col gap-6 overflow-hidden rounded-3xl border border-border/60 bg-card p-6 shadow-2xl',
          'animate-in fade-in zoom-in-95 duration-200',
        )}
      >
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={close}
          aria-label="Saltar bienvenida"
          className="absolute top-3 right-3 size-8"
        >
          <X className="size-4" aria-hidden />
        </Button>

        {/* Slide content */}
        <div className="flex min-h-[320px] flex-col items-center gap-5 pt-2 text-center">
          <SlideVisual variant={current.visual} />
          <div className="flex flex-col gap-2">
            <h2 className="font-display text-foreground text-2xl tracking-tight">
              {current.title}
            </h2>
            <p className="text-balance text-muted-foreground text-sm leading-relaxed">
              {current.body}
            </p>
          </div>
        </div>

        {/* Indicador + nav */}
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={() => setSlide((s) => Math.max(0, s - 1))}
            disabled={slide === 0}
            aria-label="Anterior"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Button>

          <div className="flex items-center gap-1.5" aria-hidden>
            {slides.map((_, i) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: orden estable.
                key={i}
                className={cn(
                  'rounded-full transition-all duration-200',
                  i === slide ? 'h-1.5 w-5 bg-primary' : 'size-1.5 bg-muted-foreground/30',
                )}
              />
            ))}
          </div>

          {isLast ? (
            <Button type="button" size="sm" onClick={close}>
              Entrar
            </Button>
          ) : (
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              onClick={() => setSlide((s) => Math.min(total - 1, s + 1))}
              aria-label="Siguiente"
            >
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          )}
        </div>
      </div>
    </dialog>
  );
}

// ============================================================================
// Slides
// ============================================================================

interface Slide {
  title: string;
  body: string;
  visual: 'avatar' | 'hub' | 'chat' | 'family';
}

function buildSlides({
  childName,
  displayName,
}: {
  childName: string;
  displayName: string | null;
}): Slide[] {
  const greeting = displayName ? `Bienvenida, ${displayName}.` : 'Bienvenida.';
  return [
    {
      title: greeting,
      body: `Acá vamos a guardar todo lo importante de ${childName} — tomas, pañales, sueños, fotos, recuerdos. Te llevo 30 segundos por la app.`,
      visual: 'avatar',
    },
    {
      title: 'El bebé está al centro.',
      body: 'En "Casa" vas a ver el avatar de Salu rodeado de chips. Tocá uno para anotar una toma, un sueño o un pañal en dos toques. El que está iluminado te dice qué está pasando ahora.',
      visual: 'hub',
    },
    {
      title: 'Decile a SaluIA.',
      body: 'En el chat (esquina inferior derecha) podés escribir, dictar con voz, o pegar el WhatsApp del día. SaluIA arma las cards y vos confirmás todas juntas con un tap.',
      visual: 'chat',
    },
    {
      title: 'Una sola familia, una sola pantalla.',
      body: 'Lo que carga cualquier miembro lo ven todos al instante. Pueden mandar fotos, anotar momentos y compartir el día sin pelearse con apps distintas.',
      visual: 'family',
    },
  ];
}

// ============================================================================
// Visual helpers — micro-ilustraciones para cada slide. Sin imágenes
// externas, todo CSS + iconos lucide.
// ============================================================================

function SlideVisual({ variant }: { variant: Slide['visual'] }) {
  if (variant === 'avatar') {
    return (
      <div className="relative flex h-32 items-center justify-center">
        <span
          aria-hidden
          className="-z-10 absolute inset-0 m-auto size-40 rounded-full bg-primary/10 blur-2xl"
        />
        <Salu360Avatar size={120} className="ring-2 ring-primary/30" />
      </div>
    );
  }

  if (variant === 'hub') {
    // Mock estático del hub: avatar al centro + 6 mini-chips en órbita.
    const orbit: Array<{ Icon: LucideIcon; label: string; angle: number; highlight?: boolean }> = [
      { Icon: Camera, label: 'Foto', angle: 90 },
      { Icon: Milk, label: 'Toma', angle: 30 },
      { Icon: Moon, label: 'Sueño', angle: -30, highlight: true },
      { Icon: Baby, label: 'Pañal', angle: -90 },
      { Icon: BookHeart, label: 'Nota', angle: -150 },
      { Icon: Sparkles, label: 'IA', angle: 150 },
    ];
    return (
      <div className="relative h-40 w-40">
        {/* Avatar al centro */}
        <span className="-translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2">
          <Salu360Avatar size={56} className="ring-1 ring-primary/30" />
        </span>
        {/* Anillo decorativo */}
        <span className="-translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2 size-20 rounded-full border border-dashed border-primary/30" />
        {/* Chips */}
        {orbit.map((o) => {
          const rad = (o.angle * Math.PI) / 180;
          const x = 50 + Math.cos(rad) * 38;
          const y = 50 - Math.sin(rad) * 38;
          return (
            <span
              key={o.label}
              className={cn(
                '-translate-x-1/2 -translate-y-1/2 absolute flex size-8 items-center justify-center rounded-md border bg-card shadow-sm',
                o.highlight
                  ? 'border-primary/50 bg-primary/[0.08] text-primary'
                  : 'border-border/60 text-muted-foreground',
              )}
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <o.Icon className="size-3.5" aria-hidden />
            </span>
          );
        })}
      </div>
    );
  }

  if (variant === 'chat') {
    return (
      <div className="flex w-full max-w-[280px] flex-col gap-2">
        {/* Mock de mensaje user */}
        <div className="self-end rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-primary-foreground text-xs leading-relaxed">
          Despierta 1:09 · Se duerme 2 am post mamadera 60ml
        </div>
        {/* Mock de mensaje assistant */}
        <div className="self-start rounded-2xl rounded-bl-sm border border-border/60 bg-card px-3 py-2 text-foreground text-xs leading-relaxed">
          Te dejo 3 cards: 1 mamadera, 1 sueño, 1 despertar.
        </div>
        {/* Mock card propuesta */}
        <div className="self-start rounded-xl border border-primary/30 bg-primary/[0.06] p-2.5">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Milk className="size-3" aria-hidden />
            </span>
            <span className="font-mono text-[10px] text-muted-foreground tracking-wider">
              ¿Anoto esta toma? · 1 / 3
            </span>
          </div>
        </div>
      </div>
    );
  }

  // family
  return (
    <div className="relative flex h-32 items-center justify-center gap-4">
      <span
        aria-hidden
        className="-z-10 absolute inset-0 m-auto size-40 rounded-full bg-accent/30 blur-2xl"
      />
      <span className="flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/20">
        <span className="font-medium text-sm">M</span>
      </span>
      <Users className="size-5 text-muted-foreground" aria-hidden />
      <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground ring-1 ring-accent/40">
        <span className="font-medium text-sm">A</span>
      </span>
      <Users className="size-5 text-muted-foreground" aria-hidden />
      <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/15">
        <Baby className="size-5" aria-hidden />
      </span>
    </div>
  );
}
