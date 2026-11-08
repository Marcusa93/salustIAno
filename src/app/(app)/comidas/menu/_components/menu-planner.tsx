'use client';

import { Skeleton } from '@/components/ui/skeleton';
import type { MenuTag } from '@/lib/ai/agents/solids-menu/schema';
import { haptic } from '@/lib/haptics';
import type {
  MenuDay,
  MenuMeal,
  MenuWarning,
  ShoppingGroup,
  ValidatedMenu,
} from '@/lib/solids/menu';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { Route } from 'next';
import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { type MenuErrorType, generateSolidsMenuAction } from '../actions';

// ---------------------------------------------------------------------------
// localStorage: el último menú y los tildes de la lista, por semana
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'salu:comidas:menu';
const STORAGE_VERSION = 1;
const AR_TZ = 'America/Argentina/Buenos_Aires';

interface StoredMenu {
  v: typeof STORAGE_VERSION;
  /** Primer día del menú ("YYYY-MM-DD"): la semana a la que pertenecen los tildes. */
  week: string;
  generatedAt: string;
  result: ValidatedMenu;
  /** id del ítem de la lista → ya está en la bolsa. */
  checks: Record<string, boolean>;
}

function readStored(): StoredMenu | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredMenu>;
    const menu = parsed.result?.menu;
    if (
      parsed.v !== STORAGE_VERSION ||
      typeof parsed.week !== 'string' ||
      !Array.isArray(menu?.days) ||
      !Array.isArray(menu?.shoppingList) ||
      !Array.isArray(parsed.result?.warnings)
    ) {
      return null;
    }
    return { ...(parsed as StoredMenu), checks: parsed.checks ?? {} };
  } catch {
    return null;
  }
}

function writeStored(value: StoredMenu): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* sin storage o lleno: el menú se ve igual, solo no se recuerda */
  }
}

/** "YYYY-MM-DD" de hoy en Argentina. */
function todayAr(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: AR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function generatedLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: AR_TZ,
  });
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

/** Errores en los que reintentar enseguida no sirve de nada. */
const NO_RETRY: ReadonlySet<MenuErrorType> = new Set([
  'auth',
  'no_child',
  'too_young',
  'rate_limit',
]);

interface MenuError {
  type: MenuErrorType;
  message: string;
}

/**
 * Arma el menú de la semana con IA, lo muestra por días con la lista de
 * compras y recuerda el último (y lo que ya se compró) en el celu.
 */
export function MenuPlanner({ firstName }: { firstName: string }) {
  const [stored, setStored] = useState<StoredMenu | null>(null);
  const [today, setToday] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<MenuError | null>(null);
  const [pending, startTransition] = useTransition();

  // Después del primer render: localStorage y la fecha son del navegador.
  useEffect(() => {
    setStored(readStored());
    setToday(todayAr());
    setHydrated(true);
  }, []);

  function generate() {
    setError(null);
    haptic('tap');
    startTransition(async () => {
      let res: Awaited<ReturnType<typeof generateSolidsMenuAction>>;
      try {
        res = await generateSolidsMenuAction();
      } catch {
        setError({
          type: 'network',
          message: 'No pudimos conectarnos. Revisá la conexión y probá de nuevo.',
        });
        haptic('warning');
        return;
      }
      if (!res.ok) {
        setError(res.error);
        haptic('warning');
        return;
      }

      // Si el menú anterior todavía corre, lo que ya compraron sigue tildado.
      const previous = readStored();
      const { menu } = res.result;
      const ids = new Set(menu.shoppingList.flatMap((g) => g.items.map((i) => i.id)));
      const carried =
        previous && previous.result.menu.endDate >= menu.startDate ? previous.checks : {};
      const next: StoredMenu = {
        v: STORAGE_VERSION,
        week: menu.startDate,
        generatedAt: res.generatedAt,
        result: res.result,
        checks: Object.fromEntries(
          Object.entries(carried).filter(([id, checked]) => checked && ids.has(id)),
        ),
      };
      writeStored(next);
      setStored(next);
      setToday(todayAr());
      haptic('success');
    });
  }

  function toggleItem(id: string) {
    if (!stored) return;
    const next = { ...stored, checks: { ...stored.checks, [id]: !stored.checks[id] } };
    writeStored(next);
    setStored(next);
  }

  if (!hydrated) return <Skeleton className="h-60 w-full rounded-[2rem]" />;

  return (
    <div className="flex flex-col gap-8">
      {error && <ErrorCard error={error} onRetry={generate} pending={pending} />}

      {pending ? (
        <MenuLoading firstName={firstName} />
      ) : stored ? (
        <MenuView stored={stored} today={today} onRegenerate={generate} onToggleItem={toggleItem} />
      ) : (
        <EmptyState firstName={firstName} onGenerate={generate} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Estados
// ---------------------------------------------------------------------------

const PRIMARY_BUTTON =
  'flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-solid font-medium text-base text-white shadow-[0_16px_32px_-20px_var(--elevation)] transition-transform active:scale-[0.98] disabled:opacity-60 dark:text-background';

function EmptyState({ firstName, onGenerate }: { firstName: string; onGenerate: () => void }) {
  return (
    <section className="flex flex-col gap-4 rounded-[2rem] bg-solid-soft p-6 ring-1 ring-solid/25">
      <span className="text-3xl tracking-[0.2em]" aria-hidden>
        🎃🥑🥩🍌
      </span>
      <div className="flex flex-col gap-1.5">
        <h2 className="font-display text-2xl text-solid-foreground leading-tight">
          Una semana, sin pensar qué darle.
        </h2>
        <p className="text-solid-foreground/80 text-sm">
          Con lo que ya probó {firstName}: hierro todos los días, 3 o 4 cosas nuevas bien
          espaciadas, los alérgenos de a uno y la lista para el súper.
        </p>
      </div>
      <button type="button" onClick={onGenerate} className={cn(PRIMARY_BUTTON, 'mt-1')}>
        <Sparkles className="size-5" aria-hidden />
        Armar el menú de la semana
      </button>
    </section>
  );
}

const LOADING_STEPS: readonly string[] = [
  'Mirando lo que ya probó…',
  'Buscando hierro para cada día…',
  'Espaciando lo nuevo, de a uno…',
  'Revisando los alérgenos…',
  'Armando la lista del súper…',
];

const LOADING_EMOJI: readonly string[] = ['🎃', '🥑', '🥩', '🍌', '🥦', '🍐'];

function MenuLoading({ firstName }: { firstName: string }) {
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setStep((s) => (s + 1) % LOADING_STEPS.length), 2400);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <section
        aria-live="polite"
        className="flex flex-col items-center gap-5 rounded-[2rem] bg-solid-soft px-6 py-10 text-center ring-1 ring-solid/25"
      >
        <div className="flex gap-2 text-3xl" aria-hidden>
          {LOADING_EMOJI.map((emoji, i) => (
            <motion.span
              key={emoji}
              animate={reduceMotion ? undefined : { y: [0, -10, 0] }}
              transition={{
                duration: 0.8,
                ease: 'easeInOut',
                repeat: Number.POSITIVE_INFINITY,
                repeatDelay: 0.9,
                delay: i * 0.12,
              }}
            >
              {emoji}
            </motion.span>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-display text-solid-foreground text-xl">
            Armando la semana de {firstName}
          </span>
          <div className="relative h-6">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={step}
                initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="text-solid-foreground/80 text-sm"
              >
                {LOADING_STEPS[step]}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
        <span className="text-solid-foreground/60 text-xs">Tarda unos segundos.</span>
      </section>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-32 w-full rounded-3xl" />
      ))}
    </div>
  );
}

function ErrorCard({
  error,
  onRetry,
  pending,
}: {
  error: MenuError;
  onRetry: () => void;
  pending: boolean;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-3xl bg-health-soft p-4 text-health-foreground ring-1 ring-health/30"
    >
      <p className="flex gap-2 text-sm">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        {error.message}
      </p>
      {!NO_RETRY.has(error.type) && (
        <button
          type="button"
          onClick={onRetry}
          disabled={pending}
          className="inline-flex h-10 items-center gap-1.5 self-start rounded-xl bg-card px-3 font-medium text-foreground text-sm ring-1 ring-foreground/[0.08] disabled:opacity-60"
        >
          <RefreshCw className="size-4" aria-hidden />
          Probar de nuevo
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// El menú
// ---------------------------------------------------------------------------

function MenuView({
  stored,
  today,
  onRegenerate,
  onToggleItem,
}: {
  stored: StoredMenu;
  today: string | null;
  onRegenerate: () => void;
  onToggleItem: (id: string) => void;
}) {
  const reduceMotion = useReducedMotion();
  const { menu, warnings } = stored.result;
  const stale = today !== null && today > menu.endDate;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="font-display text-2xl text-foreground leading-tight">
              {menu.rangeLabel}
            </h2>
            <span className="text-muted-foreground text-xs">
              Armado el {generatedLabel(stored.generatedAt)}
            </span>
          </div>
          <button
            type="button"
            onClick={onRegenerate}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-muted/70 px-3 font-medium text-foreground text-sm transition-colors hover:bg-muted"
          >
            <RefreshCw className="size-4" aria-hidden />
            Rehacer
          </button>
        </div>

        {stale && (
          <div className="flex flex-col gap-3 rounded-3xl bg-feed-soft p-4 text-feed-foreground ring-1 ring-feed/25">
            <p className="text-sm">
              Este menú ya terminó. Armá el de esta semana con lo que fue probando.
            </p>
            <button type="button" onClick={onRegenerate} className={PRIMARY_BUTTON}>
              <Sparkles className="size-5" aria-hidden />
              Armar el menú de la semana
            </button>
          </div>
        )}
      </section>

      {warnings.length > 0 && <Adjustments warnings={warnings} />}

      <ol className="flex flex-col gap-3" aria-label="Días del menú">
        {menu.days.map((day, i) => (
          <motion.li
            key={day.date}
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.35,
              delay: Math.min(i, 6) * 0.05,
              ease: [0.25, 0.1, 0.25, 1],
            }}
          >
            <DayCard day={day} isToday={day.date === today} />
          </motion.li>
        ))}
      </ol>

      <ShoppingList groups={menu.shoppingList} checks={stored.checks} onToggleItem={onToggleItem} />

      {menu.tips.length > 0 && (
        <section
          aria-labelledby="consejos"
          className="flex flex-col gap-3 rounded-[2rem] bg-card p-5 ring-1 ring-foreground/[0.06]"
        >
          <h2 id="consejos" className="flex items-center gap-2 font-medium text-foreground">
            <Sparkles className="size-4 text-primary" aria-hidden />
            Para esta semana
          </h2>
          <ul className="flex flex-col gap-2">
            {menu.tips.map((tip) => (
              <li key={tip} className="flex gap-2 text-muted-foreground text-sm">
                <span aria-hidden className="text-solid">
                  •
                </span>
                {tip}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Adjustments({ warnings }: { warnings: readonly MenuWarning[] }) {
  return (
    <section
      aria-labelledby="ajustes"
      className="flex flex-col gap-2 rounded-2xl bg-muted/50 px-4 py-3"
    >
      <h2 id="ajustes" className="flex items-center gap-2 font-medium text-foreground text-sm">
        <ShieldCheck className="size-4 text-solid-foreground" aria-hidden />
        Lo revisamos y ajustamos
      </h2>
      <ul className="flex flex-col gap-1.5 text-sm">
        {warnings.map((w) => (
          <li
            key={w.message}
            className={w.code === 'missing_iron' ? 'text-feed-foreground' : 'text-muted-foreground'}
          >
            {w.message}
          </li>
        ))}
      </ul>
    </section>
  );
}

const TAG_STYLE: Record<MenuTag, { label: string; className: string }> = {
  nuevo: { label: 'Nuevo', className: 'bg-solid-soft text-solid-foreground' },
  alergeno: { label: 'Alérgeno', className: 'bg-feed-soft text-feed-foreground' },
  hierro: { label: 'Hierro', className: 'bg-health-soft text-health-foreground' },
};

function DayCard({ day, isToday }: { day: MenuDay; isToday: boolean }) {
  return (
    <article
      className={cn(
        'flex flex-col gap-3 rounded-3xl bg-card p-4 ring-1',
        isToday ? 'ring-solid/40' : 'ring-foreground/[0.06]',
      )}
    >
      <header className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-medium text-foreground">
          {day.label}
          {isToday && (
            <span className="rounded-full bg-solid px-2 py-0.5 font-medium text-[11px] text-white dark:text-background">
              Hoy
            </span>
          )}
        </h3>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs ring-1',
            day.hasIron
              ? 'bg-solid-soft text-solid-foreground ring-solid/25'
              : 'bg-feed-soft text-feed-foreground ring-feed/30',
          )}
        >
          {day.hasIron ? <Check className="size-3" aria-hidden /> : <span aria-hidden>🩸</span>}
          {day.hasIron ? 'Hierro' : 'Falta hierro'}
        </span>
      </header>

      {day.meals.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Sin comida planeada: ofrecele algo que ya conoce y le gusta.
        </p>
      ) : (
        day.meals.map((meal, i) => (
          <MealBlock key={`${meal.name}-${i}`} meal={meal} divided={i > 0} />
        ))
      )}
    </article>
  );
}

function MealBlock({ meal, divided }: { meal: MenuMeal; divided: boolean }) {
  const firstKey = meal.foods.find((f) => f.key !== null)?.key;
  const anotarHref = (
    firstKey ? `/comidas/anotar?alimento=${encodeURIComponent(firstKey)}` : '/comidas/anotar'
  ) as Route;

  return (
    <div className={cn('flex flex-col gap-2', divided && 'border-foreground/[0.06] border-t pt-3')}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.22em]">
          {meal.name}
        </span>
        <Link
          href={anotarHref}
          className="inline-flex h-8 items-center gap-1 rounded-lg bg-solid-soft px-2.5 font-medium text-solid-foreground text-xs ring-1 ring-solid/25"
        >
          <Plus className="size-3.5" aria-hidden />
          Anotar
        </Link>
      </div>

      <ul className="flex flex-wrap gap-1.5">
        {meal.foods.map((food) => {
          const inner = (
            <>
              <span aria-hidden>{food.emoji}</span>
              <span className="text-foreground">{food.name}</span>
              {food.tags.map((tag) => (
                <span
                  key={tag}
                  className={cn(
                    'rounded-full px-1.5 py-px font-medium text-[10px]',
                    TAG_STYLE[tag].className,
                  )}
                >
                  {TAG_STYLE[tag].label}
                </span>
              ))}
            </>
          );
          const chip =
            'inline-flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-sm ring-1 ring-foreground/[0.08]';
          return (
            <li key={food.key ?? food.name}>
              {food.key ? (
                <Link href={`/comidas/alimento/${food.key}` as Route} className={chip}>
                  {inner}
                </Link>
              ) : (
                <span className={chip}>{inner}</span>
              )}
            </li>
          );
        })}
      </ul>

      <p className="text-muted-foreground text-sm">{meal.prep}</p>

      {meal.newAllergen && (
        <div className="flex flex-col gap-1 rounded-xl bg-feed-soft px-3 py-2 text-feed-foreground text-xs">
          <p>
            <strong className="font-medium">
              Primera vez con {meal.newAllergen.label.toLowerCase()}.
            </strong>{' '}
            Mejor temprano y como única novedad del día, y quedate atento a cómo está las 2 horas
            siguientes.
          </p>
          <Link
            href={'/comidas/guia#alergenos' as Route}
            className="inline-flex items-center gap-1 self-start font-medium underline-offset-2 hover:underline"
          >
            Qué mirar
            <ArrowRight className="size-3" aria-hidden />
          </Link>
        </div>
      )}
    </div>
  );
}

function ShoppingList({
  groups,
  checks,
  onToggleItem,
}: {
  groups: readonly ShoppingGroup[];
  checks: Record<string, boolean>;
  onToggleItem: (id: string) => void;
}) {
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const done = groups.reduce((n, g) => n + g.items.filter((i) => checks[i.id]).length, 0);
  if (total === 0) return null;

  return (
    <section aria-labelledby="compras" className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-2 px-1">
        <h2
          id="compras"
          className="font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.22em]"
        >
          Lista del súper
        </h2>
        <span className="text-muted-foreground text-xs tabular-nums">
          {done === total ? '¡Listo, ya está todo!' : `${done} de ${total} en la bolsa`}
        </span>
      </div>
      <div className="flex flex-col gap-4 rounded-3xl bg-card p-4 ring-1 ring-foreground/[0.06]">
        {groups.map((group) => (
          <div key={group.group} className="flex flex-col gap-1">
            <h3 className="text-muted-foreground text-sm">{group.label}</h3>
            <ul className="flex flex-col">
              {group.items.map((item) => {
                const checked = checks[item.id] === true;
                return (
                  <li key={item.id}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 py-1">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          haptic('tap');
                          onToggleItem(item.id);
                        }}
                        className="size-5 shrink-0 accent-solid"
                      />
                      <span aria-hidden>{item.emoji}</span>
                      <span
                        className={cn(
                          'flex-1 text-sm transition-colors',
                          checked ? 'text-muted-foreground line-through' : 'text-foreground',
                        )}
                      >
                        {item.name}
                      </span>
                      {item.quantity && (
                        <span className="text-right text-muted-foreground text-xs">
                          {item.quantity}
                        </span>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
