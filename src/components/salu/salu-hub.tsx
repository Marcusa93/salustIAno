'use client';

import { DiaperQuickAdd } from '@/app/(app)/home/_components/diaper-quick-add';
import { FeedingQuickAdd } from '@/app/(app)/home/_components/feeding-quick-add';
import { SleepQuickAdd } from '@/app/(app)/home/_components/sleep-quick-add';
import { Salu360Avatar } from '@/components/salu/salu-360-avatar';
import { Card } from '@/components/ui/card';
import { durationLabel } from '@/lib/baby-age';
import { formatTimeAr } from '@/lib/format-ar';
import { cn } from '@/lib/utils';
import { Baby, BookHeart, Camera, Milk, Moon, Sparkles, Sun } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';

interface Salu360HubProps {
  childName: string;
  childAgeLabel: string | null;
  greeting: string;
  displayName: string | null;
  /** Sueño en curso (si lo hay). */
  active: { id: string; started_at: string; is_nap: boolean } | null;
  lastWokeUpAt: string | null;
  lastFeedingAt: string | null;
  lastDiaperAt: string | null;
  todayCounts: { feeding: number; sleep: number; diaper: number };
  lateNight: boolean;
  predictedNextFeedingLabel: string | null;
}

/**
 * Hub spatial — avatar 360 en el centro, 6 acciones orbitando con líneas
 * conectoras estilo HUD/terminal.
 *
 * Layout (clockwise from 12):
 *   12: 📷 Foto       (link → composer del chat con foto)
 *    2: 🍼 Toma       (sheet QuickAdd)
 *    4: 🌙 Sueño     (sheet QuickAdd)
 *    6: 👶 Pañal      (sheet QuickAdd)
 *    8: 📓 Nota       (link → /notas/nuevo)
 *   10: ✨ SalustIA   (link → /chat)
 *
 * Cada chip muestra su icono + label + dato vivo (count del día / hora).
 * Las líneas conectoras son SVG dashed con flow animation + un text label
 * tipo `> tomas:3` que viaja con la línea.
 */
export function Salu360Hub({
  childName,
  childAgeLabel,
  greeting,
  displayName,
  active,
  lastWokeUpAt,
  lastFeedingAt,
  lastDiaperAt,
  todayCounts,
  lateNight,
  predictedNextFeedingLabel,
}: Salu360HubProps) {
  // Estado del sueño para el badge sobre el avatar.
  const isSleeping = !!active;
  const StatusIcon = isSleeping ? Moon : lateNight ? Moon : Sun;
  const statusBadgeTone = isSleeping
    ? 'bg-primary text-primary-foreground'
    : lateNight
      ? 'bg-primary/80 text-primary-foreground'
      : 'bg-accent text-accent-foreground';

  // Datos por chip — meta es la info "viva" mostrada bajo el label.
  // Los chips que abren un QuickAdd Sheet usan kind:'sheet' y un type
  // discriminator. Los demás son links.
  const chips: ChipDef[] = [
    {
      id: 'foto',
      slot: 0, // 12 o'clock
      Icon: Camera,
      label: 'Foto',
      meta: 'al álbum',
      codeLabel: '> media',
      kind: 'link',
      href: '/album' as Route,
    },
    {
      id: 'toma',
      slot: 1, // 2 o'clock
      Icon: Milk,
      label: 'Toma',
      meta:
        lastFeedingAt != null
          ? predictedNextFeedingLabel != null
            ? `últ. ${formatTimeAr(lastFeedingAt)} · prox. ~${predictedNextFeedingLabel}`
            : `${formatTimeAr(lastFeedingAt)} · ${todayCounts.feeding} hoy`
          : 'sin registros',
      codeLabel: `> tomas:${todayCounts.feeding}`,
      kind: 'sheet',
      sheet: 'feeding',
    },
    {
      id: 'sueno',
      slot: 2, // 4 o'clock
      Icon: Moon,
      label: isSleeping ? 'Durmiendo' : 'Sueño',
      meta: isSleeping
        ? `lleva ${durationLabel(active.started_at)}`
        : lastWokeUpAt != null
          ? `${formatTimeAr(lastWokeUpAt)} · ${todayCounts.sleep} hoy`
          : 'sin registros',
      codeLabel: `> sueños:${todayCounts.sleep}`,
      kind: 'sheet',
      sheet: 'sleep',
      highlight: isSleeping,
    },
    {
      id: 'panal',
      slot: 3, // 6 o'clock
      Icon: Baby,
      label: 'Pañal',
      meta:
        lastDiaperAt != null
          ? `${formatTimeAr(lastDiaperAt)} · ${todayCounts.diaper} hoy`
          : 'sin registros',
      codeLabel: `> pañales:${todayCounts.diaper}`,
      kind: 'sheet',
      sheet: 'diaper',
    },
    {
      id: 'nota',
      slot: 4, // 8 o'clock
      Icon: BookHeart,
      label: 'Nota',
      meta: 'momento',
      codeLabel: '> notes',
      kind: 'link',
      href: '/notas/nuevo' as Route,
    },
    {
      id: 'salu',
      slot: 5, // 10 o'clock
      Icon: Sparkles,
      label: 'SalustIA',
      meta: 'preguntale',
      codeLabel: '> ai.chat',
      kind: 'link',
      href: '/chat' as Route,
    },
  ];

  return (
    <section className="flex flex-col items-center gap-8">
      {/* Header textual sobre el hub */}
      <header className="flex flex-col items-center gap-1 text-center">
        <span className="font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.22em]">
          {greeting}
          {displayName ? `, ${displayName}` : ''}
        </span>
        <h1 className="font-display text-[clamp(1.75rem,4vw,2.75rem)] text-foreground leading-[1.05] tracking-tight">
          {childName}
          <span className="text-foreground/60">.</span>
        </h1>
        {childAgeLabel && <p className="text-muted-foreground text-sm">{childAgeLabel}</p>}
      </header>

      {/* HUB — la pieza central */}
      <div
        className={cn(
          'relative mx-auto w-full max-w-[420px] sm:max-w-[480px]',
          // Aspect-square + min-height para que se respete el layout en
          // contenedores flex.
          'aspect-square',
        )}
      >
        {/* Capa de glow ambiental detrás de todo */}
        <div
          aria-hidden
          className="-z-10 absolute inset-[-10%] rounded-full blur-3xl"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, oklch(0.6 0.085 235 / 0.12) 0%, transparent 60%)',
          }}
        />

        {/* SVG con las líneas conectoras — viewBox 0-100 para que coords
            sean en %. Stroke + dasharray crean el "flow" estilo HUD. */}
        <svg
          aria-hidden
          viewBox="0 0 100 100"
          className="absolute inset-0 size-full overflow-visible"
        >
          {chips.map((chip) => {
            const angle = SLOT_ANGLES[chip.slot] ?? 0;
            const inner = polar(angle, AVATAR_RADIUS_PCT + 1);
            const outer = polar(angle, CHIP_RADIUS_PCT - 8);
            return (
              <g
                key={chip.id}
                className={cn(
                  'text-primary/55 transition-colors duration-300',
                  chip.highlight && 'text-primary',
                )}
              >
                {/* Línea base con dash flow */}
                <line
                  x1={inner.x}
                  y1={inner.y}
                  x2={outer.x}
                  y2={outer.y}
                  stroke="currentColor"
                  strokeWidth="0.45"
                  strokeDasharray="1.4 1.6"
                  strokeLinecap="round"
                  className="animate-hud-flow"
                />
                {/* Punto al inicio (cerca del avatar) — anchor */}
                <circle cx={inner.x} cy={inner.y} r="0.7" fill="currentColor" />
                {/* Punto al final (cerca del chip) — donde "se conecta" */}
                <circle
                  cx={outer.x}
                  cy={outer.y}
                  r="0.55"
                  fill="currentColor"
                  className="opacity-65"
                />
              </g>
            );
          })}
        </svg>

        {/* Avatar centrado — "lentes" decorativos giratorios atrás */}
        <div className="-translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2">
          {/* Scan target: 4 corner brackets alrededor del avatar */}
          {/* Anillo de circuito decorativo */}
          <span
            aria-hidden
            className={cn(
              'absolute inset-0 m-auto rounded-full border border-dashed border-primary/30',
              'animate-spin-slow',
            )}
            style={{
              width: AVATAR_SIZE_PX + 32,
              height: AVATAR_SIZE_PX + 32,
              left: -16,
              top: -16,
            }}
          />
          {/* Anillo interno fino */}
          <span
            aria-hidden
            className="absolute inset-0 m-auto rounded-full ring-1 ring-primary/20"
            style={{
              width: AVATAR_SIZE_PX + 12,
              height: AVATAR_SIZE_PX + 12,
              left: -6,
              top: -6,
            }}
          />

          <div className="relative">
            <Salu360Avatar size={AVATAR_SIZE_PX} className="ring-primary/30" />
            {/* Badge de estado */}
            <span
              aria-hidden
              className={cn(
                '-bottom-1 -right-1 absolute flex size-7 items-center justify-center rounded-full shadow ring-2 ring-card',
                statusBadgeTone,
              )}
            >
              <StatusIcon className="size-3.5 animate-breathe" />
            </span>
          </div>
        </div>

        {/* Chips orbitando */}
        {chips.map((chip) => {
          const angle = SLOT_ANGLES[chip.slot] ?? 0;
          const pos = polar(angle, CHIP_RADIUS_PCT);
          return <ChipPositioned key={chip.id} chip={chip} left={pos.x} top={pos.y} />;
        })}
      </div>

      {/* Estado debajo del hub — solo cuando hay sueño activo. */}
      {isSleeping && (
        <Card
          className={cn(
            'flex w-full max-w-[480px] items-center gap-3 border-primary/30 bg-primary/[0.06] p-3',
            lateNight && 'border-primary/40 bg-primary/[0.10]',
          )}
        >
          <span className="font-mono text-[10px] text-primary/70 tracking-wider">▸</span>
          <p className="text-foreground text-sm">
            <span className="font-medium">Está {active.is_nap ? 'en siesta' : 'durmiendo'}</span>
            <span className="text-muted-foreground">
              {' '}
              · empezó {formatTimeAr(active.started_at)}
            </span>
          </p>
        </Card>
      )}
    </section>
  );
}

// ============================================================================
// Helpers + types
// ============================================================================

/** 6 ángulos en orden de slot (0=12 o'clock, 1=2 o'clock, …, 5=10 o'clock).
 *  Convención math: ángulo en grados desde east (3h), CCW. Y se invierte
 *  en `polar()` porque CSS y va para abajo. */
const SLOT_ANGLES: ReadonlyArray<number> = [90, 30, -30, -90, -150, 150];

/** Radio del avatar (% del container — usado para anchorar las líneas). */
const AVATAR_RADIUS_PCT = 16;

/** Distancia del centro a cada chip (% del container). */
const CHIP_RADIUS_PCT = 42;

/** Tamaño del avatar en px (fijo, escala via container). */
const AVATAR_SIZE_PX = 132;

function polar(angleDeg: number, radiusPct: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: 50 + Math.cos(rad) * radiusPct,
    y: 50 - Math.sin(rad) * radiusPct,
  };
}

type ChipDef = {
  id: string;
  slot: number;
  Icon: LucideIcon;
  label: string;
  meta: string;
  codeLabel: string;
  highlight?: boolean;
} & ({ kind: 'link'; href: Route } | { kind: 'sheet'; sheet: 'feeding' | 'sleep' | 'diaper' });

/** Wrapper que posiciona el chip absolutamente en el container del hub. */
function ChipPositioned({
  chip,
  left,
  top,
}: {
  chip: ChipDef;
  left: number;
  top: number;
}) {
  const inner = (
    <ChipBody
      Icon={chip.Icon}
      label={chip.label}
      meta={chip.meta}
      codeLabel={chip.codeLabel}
      highlight={!!chip.highlight}
    />
  );

  // Wrapper visual que va dentro del Link o del SheetTrigger. Recibe
  // toda la pinta de un botón "tap-able" sin <button> nativo (los
  // QuickAdd ya envuelven con su propio botón).
  const trigger = (
    <button
      type="button"
      className="block cursor-pointer rounded-2xl text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
    >
      {inner}
    </button>
  );

  const positionClass = '-translate-x-1/2 -translate-y-1/2 group/chip absolute';
  const positionStyle = { left: `${left}%`, top: `${top}%` };

  if (chip.kind === 'link') {
    return (
      <Link href={chip.href} className={positionClass} style={positionStyle}>
        {inner}
      </Link>
    );
  }

  // chip.kind === 'sheet' — montamos el QuickAdd correspondiente con
  // nuestro chip body como trigger. Cada QuickAdd se ocupa de abrir su
  // propio Sheet al tap; nosotros solo proveemos el trigger visible.
  return (
    <div className={positionClass} style={positionStyle}>
      {chip.sheet === 'feeding' && <FeedingQuickAdd trigger={trigger} />}
      {chip.sheet === 'sleep' && <SleepQuickAdd trigger={trigger} />}
      {chip.sheet === 'diaper' && <DiaperQuickAdd trigger={trigger} />}
    </div>
  );
}

function ChipBody({
  Icon,
  label,
  meta,
  codeLabel,
  highlight,
}: {
  Icon: LucideIcon;
  label: string;
  meta: string;
  codeLabel: string;
  highlight: boolean;
}) {
  return (
    <span
      className={cn(
        'flex w-[88px] flex-col items-center gap-1.5 rounded-2xl border border-border/60 bg-card/90 px-2 py-2.5 text-center backdrop-blur-md transition-all duration-200',
        'group-hover/chip:-translate-y-0.5 group-hover/chip:border-primary/40 group-hover/chip:bg-card group-hover/chip:shadow-md group-hover/chip:shadow-primary/10',
        'group-active/chip:scale-[0.96]',
        'sm:w-[100px]',
        highlight && 'border-primary/50 bg-primary/[0.08] ring-1 ring-primary/20',
      )}
    >
      <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/15 transition-transform group-hover/chip:scale-110 sm:size-10">
        <Icon className="size-4 sm:size-[18px]" aria-hidden />
      </span>
      <span className="flex flex-col gap-0.5 leading-tight">
        <span className="font-medium text-[11px] text-foreground sm:text-xs">{label}</span>
        <span className="font-mono text-[8.5px] text-muted-foreground/70 tracking-wider sm:text-[9px]">
          {codeLabel}
        </span>
        <span className="line-clamp-1 text-[9.5px] text-muted-foreground sm:text-[10px]">
          {meta}
        </span>
      </span>
    </span>
  );
}
