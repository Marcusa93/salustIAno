'use client';

import {
  deleteEventAction,
  logBottleFeedingAction,
  logDiaperAction,
} from '@/app/(app)/cuidar/eventos/actions';
import { DiaperQuickAdd } from '@/app/(app)/home/_components/diaper-quick-add';
import { FeedingQuickAdd } from '@/app/(app)/home/_components/feeding-quick-add';
import { useNow } from '@/hooks/useNow';
import { haptic } from '@/lib/haptics';
import { sinceLabel } from '@/lib/home-now';
import { cn } from '@/lib/utils';
import {
  Baby,
  BookHeart,
  Camera,
  Check,
  ChevronRight,
  Loader2,
  Milk,
  Pill,
  Plus,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ComponentProps, type ReactNode, useState, useTransition } from 'react';
import { toast } from 'sonner';

type DiaperType = 'wet' | 'dirty' | 'both';

const DIAPER_OPTIONS: { type: DiaperType; label: string }[] = [
  { type: 'wet', label: 'Pis' },
  { type: 'dirty', label: 'Caca' },
  { type: 'both', label: 'Ambos' },
];

const SHORTCUTS: { href: Route; label: string; Icon: LucideIcon }[] = [
  { href: '/notas/nuevo' as Route, label: 'Nota', Icon: BookHeart },
  { href: '/album' as Route, label: 'Foto', Icon: Camera },
  { href: '/cuidar/medicamentos' as Route, label: 'Remedio', Icon: Pill },
  { href: '/chat' as Route, label: 'SalustIA', Icon: Sparkles },
];

interface SolidsDock {
  lastAt: string | null;
  /** "zapallo, banana" — lo que comió la última vez. */
  lastFoods: string | null;
  /** Dos alimentos sugeridos para probar, como atajo. */
  quick: { key: string; name: string; emoji: string }[];
}

interface LogDockProps {
  feedingPresets: number[];
  lastFeedingAt: string | null;
  lastDiaperAt: string | null;
  /** null antes de la edad de los sólidos: la fila no se muestra. */
  solids: SolidsDock | null;
  renderedAt: string;
}

/**
 * "Anotar": lo que se carga veinte veces por día, a un toque y con una
 * mano. Cada botón registra al instante y ofrece "Deshacer"; lo menos
 * frecuente (pecho, seco, foto del pañal) queda en "Más".
 */
export function LogDock({
  feedingPresets,
  lastFeedingAt,
  lastDiaperAt,
  solids,
  renderedAt,
}: LogDockProps) {
  const now = useNow(30_000, renderedAt);

  return (
    <section aria-labelledby="anotar" className="flex flex-col gap-3">
      <h2
        id="anotar"
        className="px-1 font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.22em]"
      >
        Anotar
      </h2>

      <LogCard
        tone="feed"
        Icon={Milk}
        title="Toma"
        since={lastFeedingAt ? sinceLabel(lastFeedingAt, now) : 'sin registros'}
      >
        {feedingPresets.map((ml) => (
          <QuickChip
            key={ml}
            tone="feed"
            label={
              <>
                {ml}
                <span className="ml-0.5 font-normal text-xs opacity-70">ml</span>
              </>
            }
            ariaLabel={`Anotar mamadera de ${ml} ml ahora`}
            successLabel={`Mamadera de ${ml} ml anotada.`}
            table="feeding_events"
            run={() => logBottleFeedingAction(ml)}
          />
        ))}
        <FeedingQuickAdd
          trigger={<MoreChip tone="feed" ariaLabel="Otra toma (pecho, sólidos, otra cantidad)" />}
        />
      </LogCard>

      <LogCard
        tone="diaper"
        Icon={Baby}
        title="Pañal"
        since={lastDiaperAt ? sinceLabel(lastDiaperAt, now) : 'sin registros'}
      >
        {DIAPER_OPTIONS.map(({ type, label }) => (
          <QuickChip
            key={type}
            tone="diaper"
            label={label}
            ariaLabel={`Anotar pañal con ${label.toLowerCase()} ahora`}
            successLabel={`Pañal (${label.toLowerCase()}) anotado.`}
            table="diaper_events"
            run={() => logDiaperAction(type)}
          />
        ))}
        <DiaperQuickAdd
          trigger={<MoreChip tone="diaper" ariaLabel="Otro pañal (seco, con foto o notas)" />}
        />
      </LogCard>

      {solids && (
        <LogCard
          tone="solid"
          Icon={UtensilsCrossed}
          title="Comida"
          since={
            solids.lastAt
              ? `${sinceLabel(solids.lastAt, now)}${solids.lastFoods ? ` · ${solids.lastFoods}` : ''}`
              : 'todavía no comió'
          }
          href={'/comidas' as Route}
        >
          {solids.quick.map((f) => (
            <Link
              key={f.key}
              href={`/comidas/anotar?alimento=${f.key}` as Route}
              aria-label={`Anotar una comida con ${f.name.toLowerCase()}`}
              className={cn(
                'flex h-14 min-w-0 items-center justify-center gap-1.5 rounded-2xl px-2 font-medium text-sm ring-1 transition-transform active:scale-95',
                TONES.solid.chip,
              )}
            >
              <span aria-hidden>{f.emoji}</span>
              <span className="truncate">{f.name}</span>
            </Link>
          ))}
          <Link
            href={'/comidas/anotar' as Route}
            aria-label="Anotar una comida"
            className="flex h-14 items-center justify-center gap-1 rounded-2xl border border-dashed border-solid/40 font-medium text-muted-foreground text-sm transition-colors hover:text-solid-foreground active:scale-95"
          >
            <Plus className="size-4" aria-hidden />
            Anotar
          </Link>
        </LogCard>
      )}

      <nav aria-label="Atajos" className="grid grid-cols-4 gap-2">
        {SHORTCUTS.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center gap-1.5 rounded-2xl bg-card py-3 font-medium text-foreground/80 text-xs ring-1 ring-foreground/[0.06] transition-transform active:scale-95"
          >
            <Icon className="size-5 text-primary" aria-hidden />
            {label}
          </Link>
        ))}
      </nav>
    </section>
  );
}

type Tone = 'feed' | 'diaper' | 'solid';

const TONES: Record<Tone, { card: string; icon: string; chip: string }> = {
  feed: {
    card: 'ring-feed/25',
    icon: 'bg-feed-soft text-feed-foreground',
    chip: 'bg-feed-soft text-feed-foreground ring-feed/25',
  },
  diaper: {
    card: 'ring-diaper/25',
    icon: 'bg-diaper-soft text-diaper-foreground',
    chip: 'bg-diaper-soft text-diaper-foreground ring-diaper/25',
  },
  solid: {
    card: 'ring-solid/25',
    icon: 'bg-solid-soft text-solid-foreground',
    chip: 'bg-solid-soft text-solid-foreground ring-solid/25',
  },
};

function LogCard({
  tone,
  Icon,
  title,
  since,
  href,
  children,
}: {
  tone: Tone;
  Icon: LucideIcon;
  title: string;
  since: string;
  /** Si está, el título lleva a la sección completa. */
  href?: Route;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-[1.75rem] bg-card p-4 shadow-[0_16px_32px_-24px_var(--elevation)] ring-1',
        TONES[tone].card,
      )}
    >
      {href ? (
        <Link href={href} className="flex items-center gap-3">
          <LogCardHead tone={tone} Icon={Icon} title={title} since={since} />
          <ChevronRight className="ml-auto size-5 text-muted-foreground" aria-hidden />
        </Link>
      ) : (
        <div className="flex items-center gap-3">
          <LogCardHead tone={tone} Icon={Icon} title={title} since={since} />
        </div>
      )}
      <div className="grid auto-cols-fr grid-flow-col gap-2">{children}</div>
    </div>
  );
}

function LogCardHead({
  tone,
  Icon,
  title,
  since,
}: {
  tone: Tone;
  Icon: LucideIcon;
  title: string;
  since: string;
}) {
  return (
    <>
      <span
        className={cn('grid size-10 shrink-0 place-items-center rounded-full', TONES[tone].icon)}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="font-display text-foreground text-xl leading-tight">{title}</span>
        <span className="truncate text-muted-foreground text-xs">{since}</span>
      </span>
    </>
  );
}

function QuickChip({
  tone,
  label,
  ariaLabel,
  successLabel,
  table,
  run,
}: {
  tone: Tone;
  label: ReactNode;
  ariaLabel: string;
  successLabel: string;
  table: 'feeding_events' | 'diaper_events';
  run: () => Promise<{ ok: true; id: string } | { ok: false; error: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  const log = () => {
    haptic('tap');
    startTransition(async () => {
      const result = await run();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      haptic('success');
      setDone(true);
      window.setTimeout(() => setDone(false), 1400);
      toast.success(successLabel, {
        action: {
          label: 'Deshacer',
          onClick: async () => {
            const undone = await deleteEventAction(table, result.id);
            if (!undone.ok) toast.error(undone.error);
            router.refresh();
          },
        },
      });
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={log}
      disabled={pending}
      aria-label={ariaLabel}
      className={cn(
        'relative flex h-14 items-center justify-center overflow-hidden rounded-2xl font-medium text-base ring-1 transition-transform active:scale-95 disabled:opacity-80',
        TONES[tone].chip,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        {pending ? (
          <motion.span
            key="pending"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Loader2 className="size-5 animate-spin" aria-hidden />
          </motion.span>
        ) : done ? (
          <motion.span
            key="done"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
          >
            <Check className="size-6" aria-hidden />
          </motion.span>
        ) : (
          <motion.span
            key="label"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

// Recibe y reenvía las props que le pasa el SheetTrigger de Base UI
// (onClick, ref, aria-*): sin eso, el "Más" no abriría la hoja.
function MoreChip({
  tone,
  ariaLabel,
  className,
  ...props
}: ComponentProps<'button'> & { tone: Tone; ariaLabel: string }) {
  return (
    <button
      type="button"
      {...props}
      aria-label={ariaLabel}
      className={cn(
        className,
        'flex h-14 items-center justify-center gap-1 rounded-2xl border border-dashed font-medium text-muted-foreground text-sm transition-colors active:scale-95',
        tone === 'feed'
          ? 'border-feed/40 hover:text-feed-foreground'
          : 'border-diaper/40 hover:text-diaper-foreground',
      )}
    >
      <Plus className="size-4" aria-hidden />
      Más
    </button>
  );
}
