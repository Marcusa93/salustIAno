'use client';

import { DiaperQuickAdd } from '@/app/(app)/home/_components/diaper-quick-add';
import { FeedingQuickAdd } from '@/app/(app)/home/_components/feeding-quick-add';
import { SleepQuickAdd } from '@/app/(app)/home/_components/sleep-quick-add';
import { Salu360Avatar } from '@/components/salu/salu-360-avatar';
import { durationLabel } from '@/lib/baby-age';
import { formatTimeAr } from '@/lib/format-ar';
import { cn } from '@/lib/utils';
import { Baby, BookHeart, Camera, Milk, Moon, Sparkles, Sun } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { useId } from 'react';

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
}: Salu360HubProps) {
  const gradientId = useId();

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
          ? `${formatTimeAr(lastFeedingAt)} · ${todayCounts.feeding} hoy`
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

  // Telemetría tipo terminal: estado actual del sistema "salu". Cambia
  // según si hay sueño activo o si es madrugada — el copy se siente vivo
  // sin gritar.
  const sysStatus = isSleeping
    ? lateNight
      ? 'sleeping · night_mode'
      : 'sleeping · nap_mode'
    : lateNight
      ? 'awake · late_night'
      : 'awake · active';

  return (
    <section className="flex flex-col items-center gap-6">
      {/* Status bar técnica arriba del hub — vibe terminal/IDE. */}
      <div className="flex w-full max-w-[480px] items-center justify-between gap-2 border-border/40 border-y bg-card/40 px-3 py-1.5 font-mono text-[10px] text-muted-foreground tracking-[0.08em] backdrop-blur-sm">
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 animate-breathe rounded-full bg-emerald-500/80" />
          <span className="text-foreground/70">salu/sys</span>
          <span className="text-muted-foreground/50">::</span>
          <span>{sysStatus}</span>
        </span>
        <span className="text-muted-foreground/60">v2.7</span>
      </div>

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
        {childAgeLabel && (
          <p className="font-mono text-muted-foreground text-xs tracking-wider">
            <span className="text-primary/60">▸</span> uptime: {childAgeLabel}
          </p>
        )}
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

        {/* Grid blueprint de fondo — feel CAD/IDE, líneas finas cada 10%
            con un círculo guía en el centro. Solo decorativo. */}
        <svg
          aria-hidden
          viewBox="0 0 100 100"
          className="absolute inset-0 size-full opacity-30"
          preserveAspectRatio="none"
        >
          <defs>
            <pattern
              id={`${gradientId}-grid`}
              x="0"
              y="0"
              width="10"
              height="10"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 10 0 L 0 0 0 10"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.15"
                className="text-primary/30"
              />
            </pattern>
          </defs>
          <rect width="100" height="100" fill={`url(#${gradientId}-grid)`} />
          {/* Círculo guía concéntrico */}
          <circle
            cx="50"
            cy="50"
            r={CHIP_RADIUS_PCT - 8}
            fill="none"
            stroke="currentColor"
            strokeWidth="0.15"
            strokeDasharray="0.5 1"
            className="text-primary/40"
          />
          <circle
            cx="50"
            cy="50"
            r={AVATAR_RADIUS_PCT + 4}
            fill="none"
            stroke="currentColor"
            strokeWidth="0.15"
            strokeDasharray="0.5 1"
            className="text-primary/30"
          />
        </svg>

        {/* Corner brackets en las 4 esquinas del hub — vibe IDE/HUD. */}
        <CornerBracket position="top-left" />
        <CornerBracket position="top-right" />
        <CornerBracket position="bottom-left" />
        <CornerBracket position="bottom-right" />

        {/* SVG con las líneas conectoras — viewBox 0-100 para que coords
            sean en %. Stroke + dasharray crean el "flow" estilo HUD. */}
        <svg
          aria-hidden
          viewBox="0 0 100 100"
          className="absolute inset-0 size-full overflow-visible"
        >
          <defs>
            <linearGradient id={`${gradientId}-fade`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.05" />
              <stop offset="40%" stopColor="currentColor" stopOpacity="0.4" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.6" />
            </linearGradient>
          </defs>
          {chips.map((chip, i) => {
            const angle = SLOT_ANGLES[chip.slot] ?? 0;
            const inner = polar(angle, AVATAR_RADIUS_PCT + 1);
            const outer = polar(angle, CHIP_RADIUS_PCT - 8);
            // Punto medio para colocar el ID numérico, ligeramente
            // desplazado perpendicular a la línea para que no la pise.
            const midX = (inner.x + outer.x) / 2;
            const midY = (inner.y + outer.y) / 2;
            const id = `[${String(i + 1).padStart(2, '0')}]`;
            return (
              <g
                key={chip.id}
                className={cn(
                  'text-primary/70 transition-colors duration-300',
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
                  strokeWidth="0.5"
                  strokeDasharray="1.5 1.8"
                  strokeLinecap="round"
                  className="animate-hud-flow"
                />
                {/* Anchor del avatar (cuadrado tipo nodo de circuito) */}
                <rect
                  x={inner.x - 0.7}
                  y={inner.y - 0.7}
                  width="1.4"
                  height="1.4"
                  fill="currentColor"
                />
                {/* Punto al final (cerca del chip) */}
                <circle
                  cx={outer.x}
                  cy={outer.y}
                  r="0.6"
                  fill="currentColor"
                  className="opacity-60"
                />
                {/* ID numérico flotando en la línea — feel debugger/blueprint */}
                <text
                  x={midX}
                  y={midY}
                  fontSize="2"
                  fontFamily="ui-monospace, SFMono-Regular, monospace"
                  fill="currentColor"
                  className="opacity-50"
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {id}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Avatar centrado — "lentes" decorativos giratorios atrás */}
        <div className="-translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2">
          {/* Scan target: 4 corner brackets alrededor del avatar */}
          {(['tl', 'tr', 'bl', 'br'] as const).map((p) => (
            <AvatarScanCorner key={p} position={p} avatarSize={AVATAR_SIZE_PX} />
          ))}

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

      {/* Telemetry strip — pseudo-output de logs con el último heartbeat
          y dato vivo. Estética terminal. */}
      <div className="flex w-full max-w-[480px] flex-col gap-1 border-primary/30 border-l-2 bg-card/40 px-3 py-2 font-mono text-[10.5px] text-muted-foreground tracking-wider backdrop-blur-sm">
        {isSleeping ? (
          <span>
            <span className="text-primary">▸</span>{' '}
            <span className="text-foreground/85">{active.is_nap ? 'NAP' : 'SLEEP'}</span>
            <span className="text-muted-foreground/60"> · </span>
            <span>started @ {formatTimeAr(active.started_at)}</span>
            <span className="text-muted-foreground/60"> · </span>
            <span className="text-foreground/70">{durationLabel(active.started_at)} elapsed</span>
          </span>
        ) : (
          <span>
            <span className="text-emerald-500/90">▸</span>{' '}
            <span className="text-foreground/85">AWAKE</span>
            <span className="text-muted-foreground/60"> · </span>
            <span>last_input @ {lastFeedingAt ? formatTimeAr(lastFeedingAt) : '—'}</span>
            <span className="text-muted-foreground/60"> · </span>
            <span className="text-foreground/70">
              tomas:{todayCounts.feeding} pañales:{todayCounts.diaper} sueños:{todayCounts.sleep}
            </span>
          </span>
        )}
        <span className="opacity-70">
          <span className="text-primary/80">▸</span>{' '}
          <span className="animate-pulse text-foreground/60">_</span>
        </span>
      </div>
    </section>
  );
}

/**
 * Corner bracket estilo HUD — 4 instancias enmarcan el container del hub
 * con esquinas L-shaped. Vibe IDE/blueprint sin agregar contenido.
 */
function CornerBracket({
  position,
}: {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}) {
  const sideClass = {
    'top-left': '-top-1 -left-1 border-t-2 border-l-2 rounded-tl-sm',
    'top-right': '-top-1 -right-1 border-t-2 border-r-2 rounded-tr-sm',
    'bottom-left': '-bottom-1 -left-1 border-b-2 border-l-2 rounded-bl-sm',
    'bottom-right': '-bottom-1 -right-1 border-b-2 border-r-2 rounded-br-sm',
  }[position];
  return <span aria-hidden className={cn('absolute size-4 border-primary/50', sideClass)} />;
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
        'relative flex w-[88px] flex-col items-center gap-1.5 rounded-md border border-border/60 bg-card/90 px-2 py-2.5 text-center backdrop-blur-md transition-all duration-200',
        'group-hover/chip:-translate-y-0.5 group-hover/chip:border-primary/40 group-hover/chip:bg-card group-hover/chip:shadow-md group-hover/chip:shadow-primary/10',
        'group-active/chip:scale-[0.96]',
        'sm:w-[100px]',
        highlight && 'border-primary/50 bg-primary/[0.08] ring-1 ring-primary/20',
      )}
    >
      {/* Corner ticks tipo HUD — 4 esquinas con tic chiquito en primary */}
      <ChipCorner position="tl" highlight={highlight} />
      <ChipCorner position="tr" highlight={highlight} />
      <ChipCorner position="bl" highlight={highlight} />
      <ChipCorner position="br" highlight={highlight} />

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

/**
 * Corner bracket grande alrededor del avatar — visual "scan target".
 * 4 instancias se posicionan en cada esquina de un cuadrado imaginario
 * que rodea el avatar circular.
 */
function AvatarScanCorner({
  position,
  avatarSize,
}: {
  position: 'tl' | 'tr' | 'bl' | 'br';
  avatarSize: number;
}) {
  const offset = avatarSize / 2 + 28; // distancia del centro del avatar
  const baseStyles: Record<typeof position, CSSProperties> = {
    tl: { left: -offset, top: -offset },
    tr: { right: -offset - 18, top: -offset },
    bl: { left: -offset, bottom: -offset - 18 },
    br: { right: -offset - 18, bottom: -offset - 18 },
  };
  const sideClass = {
    tl: 'border-t-2 border-l-2',
    tr: 'border-t-2 border-r-2',
    bl: 'border-b-2 border-l-2',
    br: 'border-b-2 border-r-2',
  }[position];
  return (
    <span
      aria-hidden
      className={cn('absolute size-3 border-primary/60', sideClass)}
      style={baseStyles[position]}
    />
  );
}

/** Tick L-shaped en una esquina del chip — refuerza la estética HUD. */
function ChipCorner({
  position,
  highlight,
}: {
  position: 'tl' | 'tr' | 'bl' | 'br';
  highlight: boolean;
}) {
  const sideClass = {
    tl: 'top-1 left-1 border-t border-l',
    tr: 'top-1 right-1 border-t border-r',
    bl: 'bottom-1 left-1 border-b border-l',
    br: 'bottom-1 right-1 border-b border-r',
  }[position];
  return (
    <span
      aria-hidden
      className={cn(
        'absolute size-1.5',
        sideClass,
        highlight ? 'border-primary/70' : 'border-primary/40',
      )}
    />
  );
}
