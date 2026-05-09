import { Salu360Avatar } from '@/components/salu/salu-360-avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { babyAgeFromBirth, durationLabel } from '@/lib/baby-age';
import { formatTimeAr } from '@/lib/format-ar';
import { dateLabel, greetingFor } from '@/lib/greeting';
import { cn } from '@/lib/utils';
import { suggestNextSleep } from '@/lib/wake-windows';
import { Moon, Sun } from 'lucide-react';
import type { ReactElement } from 'react';
import { CloseSleepSheet } from './close-sleep-sheet';

interface HomeHeroProps {
  displayName: string | null;
  childName: string;
  birthDate: string | null;
  active: { id: string; started_at: string; is_nap: boolean } | null;
  lastWokeUpAt: string | null;
  /**
   * Opcional: trigger custom para "Anotar siesta" cuando el bebé está
   * despierto. La page lo provee porque el SleepQuickAdd es un client
   * component que vive afuera del Server Component.
   */
  awakeCta?: ReactElement;
  /**
   * Modo madrugada (22h–6h AR). Cuando true, el card de estado usa una
   * paleta más sosegada y suma un microcopy "la madrugada es del sueño".
   * No esconde nada — sólo cambia tono.
   */
  lateNight?: boolean;
}

/**
 * Hero del /home: saludo + estado vivo del bebé.
 *
 * Estructura
 *   ┌──────────────────────────────────────────┐
 *   │ Eyebrow (fecha)                          │
 *   │ Hola, {nombre}.                          │
 *   │ {childName}, {edad}.                     │
 *   ├──────────────────────────────────────────┤
 *   │ [Avatar] {DURMIENDO|DESPIERTO}           │
 *   │         Detalle (desde / hasta)          │
 *   │                              [CTA]       │
 *   └──────────────────────────────────────────┘
 *
 * Si el bebé está dormido, muestra "Se despertó" (cierra la sesión).
 * Si está despierto, sugiere la próxima ventana de sueño cuando hay edad
 * y un último despertar.
 */
export function HomeHero({
  displayName,
  childName,
  birthDate,
  active,
  lastWokeUpAt,
  awakeCta,
  lateNight = false,
}: HomeHeroProps) {
  const greeting = greetingFor();
  const today = dateLabel();
  const age = babyAgeFromBirth(birthDate);
  const ageDays = age?.days ?? null;
  const suggestion = !active && lastWokeUpAt ? suggestNextSleep(ageDays, lastWokeUpAt) : null;

  return (
    <header className="animate-stagger-up flex flex-col gap-5" style={{ animationDelay: '0ms' }}>
      <div className="flex flex-col gap-2">
        <span className="font-medium text-muted-foreground/80 text-[11px] uppercase tracking-[0.22em]">
          {today}
        </span>
        <h1 className="font-display text-[clamp(2.25rem,5vw,3.5rem)] text-foreground leading-[1.05] tracking-tight">
          {greeting}
          {displayName ? `, ${displayName}` : ''}.
        </h1>
        <p className="max-w-md text-base text-muted-foreground sm:text-lg">
          {age?.unborn ? `Esperando a ${childName}.` : `${childName}, ${age?.label ?? '—'}.`}
        </p>
      </div>

      {/* Estado vivo */}
      {active ? (
        <Card
          className={cn(
            'relative flex flex-col gap-4 overflow-hidden border-primary/30 bg-gradient-to-br from-primary/[0.10] via-primary/[0.04] to-card p-5',
            'sm:flex-row sm:items-center sm:gap-5',
            // Madrugada: el azul-violeta del primary se vuelve aún más
            // protagónico — saca la mezcla cálida del to-card.
            lateNight &&
              'border-primary/40 from-primary/[0.18] via-primary/[0.08] to-primary/[0.04]',
          )}
        >
          {/* Glow sutil */}
          <span
            aria-hidden
            className="-top-12 -left-12 absolute size-40 rounded-full bg-primary/20 blur-3xl"
          />
          {/* Avatar 360 del bebé en loop. El badge Moon arriba indica
              estado (durmiendo) sin necesidad de leer el texto.
              `w-fit` evita que el wrapper crezca al ancho del flex item
              y empuje el badge fuera del avatar en mobile. */}
          <div className="relative w-fit shrink-0">
            <Salu360Avatar size={76} className="ring-primary/25" />
            <span
              aria-hidden
              className="-bottom-1 -right-1 absolute flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow ring-2 ring-card"
            >
              <Moon className="size-3 animate-breathe" />
            </span>
          </div>
          <div className="relative flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-medium text-foreground text-lg">
              {active.is_nap ? 'Está en la siesta' : 'Está durmiendo'}
            </span>
            <span className="text-muted-foreground text-sm">
              Empezó a las {formatTime(active.started_at)} · lleva{' '}
              <strong className="text-foreground">{durationLabel(active.started_at)}</strong>.
            </span>
          </div>
          <CloseSleepSheet
            sessionId={active.id}
            startedAt={active.started_at}
            trigger={
              <Button type="button" size="default" className="relative shrink-0">
                <Sun className="size-4" aria-hidden />
                Se despertó
              </Button>
            }
          />
        </Card>
      ) : (
        <Card
          className={cn(
            'relative flex flex-col gap-4 overflow-hidden border-border/60 bg-gradient-to-br from-card via-card to-accent/20 p-5 sm:flex-row sm:items-center sm:gap-5',
            // Madrugada despierto: paleta sosegada que se inclina al
            // azul-noche en vez del accent cálido.
            lateNight && 'border-primary/20 from-card via-primary/[0.04] to-primary/[0.08]',
          )}
        >
          {/* Avatar 360 + badge de estado (despierto = Sun, madrugada
              despierto = Moon). El bebé en loop le da vida al hero.
              `w-fit` evita que el wrapper crezca al ancho del flex item. */}
          <div className="relative w-fit shrink-0">
            <Salu360Avatar
              size={76}
              className={cn(lateNight ? 'ring-primary/20' : 'ring-accent/30')}
            />
            <span
              aria-hidden
              className={cn(
                '-bottom-1 -right-1 absolute flex size-6 items-center justify-center rounded-full shadow ring-2 ring-card',
                lateNight
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-accent text-accent-foreground',
              )}
            >
              {lateNight ? <Moon className="size-3 animate-breathe" /> : <Sun className="size-3" />}
            </span>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="font-medium text-foreground text-lg">
              {age?.unborn
                ? `${childName} está esperando.`
                : lateNight
                  ? 'Despierto a esta hora.'
                  : 'Está despierto.'}
            </span>
            {!age?.unborn && lastWokeUpAt ? (
              <span className="text-muted-foreground text-sm">
                Se despertó {durationLabel(lastWokeUpAt)} (a las {formatTime(lastWokeUpAt)}).
                {suggestion && (
                  <>
                    {' · '}
                    <span className="font-medium text-foreground">Próximo sueño:</span>{' '}
                    {formatTime(suggestion.rangeStart.toISOString())}
                    {' – '}
                    {formatTime(suggestion.rangeEnd.toISOString())}
                  </>
                )}
              </span>
            ) : (
              <span className="text-muted-foreground text-sm">
                {age?.unborn
                  ? 'Cuando llegue, este lugar va a contarte cómo durmió, comió y cómo viene su día.'
                  : 'Sin sueños cerrados todavía. Cuando duerma una siesta, anotala para empezar a ver el ritmo.'}
              </span>
            )}
            {lateNight && (
              <span className="mt-0.5 text-[11px] text-muted-foreground/70 italic">
                La madrugada es del sueño — sin apuro.
              </span>
            )}
          </div>
          {awakeCta}
        </Card>
      )}
    </header>
  );
}

function formatTime(iso: string): string {
  return formatTimeAr(iso);
}
