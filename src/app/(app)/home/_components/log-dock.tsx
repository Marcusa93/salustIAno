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
import { Baby, BookHeart, Camera, Check, Loader2, Milk, Pill, Plus, Sparkles } from 'lucide-react';
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

interface LogDockProps {
  feedingPresets: number[];
  lastFeedingAt: string | null;
  lastDiaperAt: string | null;
  renderedAt: string;
}

/**
 * "Anotar": lo que se carga veinte veces por día, a un toque y con una
 * mano. Cada botón registra al instante y ofrece "Deshacer"; lo menos
 * frecuente (pecho, seco, foto del pañal) queda en "Más".
 */
export function LogDock({ feedingPresets, lastFeedingAt, lastDiaperAt, renderedAt }: LogDockProps) {
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

type Tone = 'feed' | 'diaper';

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
};

function LogCard({
  tone,
  Icon,
  title,
  since,
  children,
}: {
  tone: Tone;
  Icon: LucideIcon;
  title: string;
  since: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-[1.75rem] bg-card p-4 shadow-[0_16px_32px_-24px_var(--elevation)] ring-1',
        TONES[tone].card,
      )}
    >
      <div className="flex items-center gap-3">
        <span className={cn('grid size-10 place-items-center rounded-full', TONES[tone].icon)}>
          <Icon className="size-5" aria-hidden />
        </span>
        <span className="flex flex-col">
          <span className="font-display text-foreground text-xl leading-tight">{title}</span>
          <span className="text-muted-foreground text-xs">{since}</span>
        </span>
      </div>
      <div className="grid auto-cols-fr grid-flow-col gap-2">{children}</div>
    </div>
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
