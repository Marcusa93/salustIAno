import { SaluBotAvatar } from '@/components/salu/salu-bot-avatar';
import { formatDateAr, formatTimeAr } from '@/lib/format-ar';
import { FOOD_GROUP_LABELS } from '@/lib/solids/catalog';
import { GUIDE } from '@/lib/solids/guide';
import { ACCEPTANCE_EMOJI, ACCEPTANCE_LABELS } from '@/lib/solids/labels';
import {
  type AllergenState,
  FOOD_GOAL,
  type FoodSummary,
  REOFFER_TARGET,
  type SuggestionTag,
  allergenStatuses,
  arDateKey,
  dayNumber,
  ironFoods,
  mealsOnDay,
  mealsPerDayGuide,
  methodOf,
  reofferList,
  suggestNext,
} from '@/lib/solids/progress';
import type { AllergenKey, FoodGroup, Meal } from '@/lib/solids/types';
import { cn } from '@/lib/utils';
import { ArrowRight, Check, Info, Plus, Sparkles } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { MealCard } from './_components/meal-card';
import { loadSolidsData } from './data';

export const metadata: Metadata = {
  title: 'Comidas',
};

const ALLERGEN_EMOJI: Record<AllergenKey, string> = {
  huevo: '🥚',
  mani: '🥜',
  leche: '🥛',
  trigo: '🌾',
  pescado: '🐟',
  sesamo: '🌱',
  frutos_secos: '🌰',
  soja: '🫘',
  mariscos: '🦐',
};

const ALLERGEN_STATE: Record<AllergenState, { label: string; className: string }> = {
  pending: { label: 'Sin probar', className: 'bg-muted/60 text-muted-foreground ring-transparent' },
  introducing: { label: 'Sumándolo', className: 'bg-feed-soft text-feed-foreground ring-feed/25' },
  maintain: {
    label: 'Incorporado',
    className: 'bg-solid-soft text-solid-foreground ring-solid/30',
  },
  lapsed: { label: 'Volvé a darlo', className: 'bg-feed-soft text-feed-foreground ring-feed/40' },
  reaction: {
    label: 'Hubo reacción',
    className: 'bg-health-soft text-health-foreground ring-health/40',
  },
};

const TAG_LABELS: Record<SuggestionTag, string> = {
  inicio: 'Para empezar',
  hierro: 'Hierro',
  alergeno: 'Alérgeno',
  verdura: 'Verdura',
  variedad: 'Variedad',
};

const GROUP_ORDER: readonly FoodGroup[] = [
  'verduras',
  'frutas',
  'cereales',
  'carnes',
  'legumbres',
  'huevo_lacteos',
  'grasas',
];

const CHAT_PROMPTS: readonly string[] = [
  '¿Qué le puedo dar mañana para sumar hierro?',
  'Armame un menú para esta semana con lo que ya probó',
  '¿Qué alérgeno conviene sumar ahora y cómo?',
  '¿Cómo le preparo el huevo para que lo agarre?',
];

export default async function ComidasPage() {
  const data = await loadSolidsData();
  if (!data) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
        <p className="text-muted-foreground">Primero creá el perfil del bebé.</p>
      </div>
    );
  }

  const { firstName, meals, summaries, ageMonths, birthDate, detailAvailable } = data;
  const now = new Date();
  const today = mealsOnDay(meals, now);
  const ironToday = ironFoods(today);
  const day = dayNumber(meals, now);
  const { suggestions, allergenHold } = suggestNext(meals, summaries, { ageMonths, now });
  const reoffer = reofferList(summaries);
  const allergens = allergenStatuses(meals, now);
  const firstAtByKey = new Map(summaries.map((s) => [s.key, s.firstAt]));
  const firstTimeKeys = (meal: Meal) =>
    meal.tastings
      .filter((t) => firstAtByKey.get(t.foodKey) === meal.occurredAt)
      .map((t) => t.foodKey);
  const past = meals
    .filter((m) => arDateKey(m.occurredAt) !== arDateKey(now))
    .slice(-8)
    .reverse();
  const daysToBirthday = birthDate ? daysUntilFirstBirthday(birthDate, now) : null;
  const goalPct = Math.min(100, Math.round((summaries.length / FOOD_GOAL) * 100));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 sm:px-6">
      <header className="flex flex-col gap-2">
        <span className="font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.22em]">
          Alimentación{day ? ` · Día ${day}` : ''}
        </span>
        <h1 className="font-display text-[2.4rem] text-foreground leading-[1.05] tracking-tight">
          A la mesa, {firstName}.
        </h1>
        <p className="max-w-md text-muted-foreground">
          Qué comió, cómo le cayó y qué probar después. Con lo que recomiendan la OMS y la Sociedad
          Argentina de Pediatría.
        </p>
      </header>

      {!detailAvailable && (
        <p className="flex gap-2 rounded-2xl bg-feed-soft px-4 py-3 text-feed-foreground text-sm">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          Falta activar el detalle por alimento en la base (la migración de comidas). Mientras tanto
          se guardan las comidas, pero no cómo le fue con cada cosa.
        </p>
      )}

      {/* Resumen + anotar */}
      <section className="relative overflow-hidden rounded-[2rem] bg-solid-soft p-6 ring-1 ring-solid/25">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="font-display text-5xl text-solid-foreground tabular-nums leading-none">
              {summaries.length}
            </span>
            <span className="text-solid-foreground/80 text-sm">
              {summaries.length === 1 ? 'alimento probado' : 'alimentos probados'}
            </span>
          </div>
          <GoalRing pct={goalPct} />
        </div>
        <p className="mt-3 text-solid-foreground/80 text-sm">
          Meta opcional: {FOOD_GOAL} alimentos distintos antes del año
          {daysToBirthday !== null && daysToBirthday > 0 ? ` · faltan ${daysToBirthday} días` : ''}.
        </p>
        <Link
          href={'/comidas/anotar' as Route}
          className="mt-5 flex h-14 items-center justify-center gap-2 rounded-2xl bg-solid font-medium text-base text-white shadow-[0_16px_32px_-20px_var(--elevation)] transition-transform active:scale-[0.98] dark:text-background"
        >
          <Plus className="size-5" aria-hidden />
          Anotar una comida
        </Link>
      </section>

      {/* Hoy */}
      <section aria-labelledby="hoy" className="flex flex-col gap-3">
        <SectionTitle id="hoy" title="Hoy" />
        <div className="flex flex-wrap gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm ring-1',
              ironToday.length > 0
                ? 'bg-solid-soft text-solid-foreground ring-solid/25'
                : 'bg-muted/60 text-muted-foreground ring-transparent',
            )}
          >
            {ironToday.length > 0 ? <Check className="size-3.5" aria-hidden /> : '🩸'}
            {ironToday.length > 0
              ? `Hierro: ${ironToday.join(', ').toLowerCase()}`
              : 'Todavía sin hierro hoy'}
          </span>
          <span className="inline-flex items-center rounded-full bg-muted/60 px-3 py-1 text-muted-foreground text-sm">
            {today.length} {today.length === 1 ? 'comida' : 'comidas'} ·{' '}
            {mealsPerDayGuide(ageMonths)}
          </span>
        </div>
        {today.length === 0 ? (
          <p className="rounded-3xl border border-dashed px-4 py-6 text-center text-muted-foreground text-sm">
            Hoy todavía no anotaron comidas.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {today.map((meal) => (
              <MealCard
                key={meal.id}
                meal={meal}
                timeLabel={formatTimeAr(meal.occurredAt)}
                method={methodOf(meal)}
                firstTimeKeys={firstTimeKeys(meal)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Para probar */}
      <section aria-labelledby="probar" className="flex flex-col gap-3">
        <SectionTitle
          id="probar"
          title="Para probar"
          hint="Ofrecé algo nuevo en cada comida, junto a algo que ya conoce."
        />
        <div className="grid gap-3 sm:grid-cols-2">
          {suggestions.map(({ food, tag, why }) => (
            <article
              key={food.key}
              className="flex flex-col gap-3 rounded-3xl bg-card p-4 ring-1 ring-foreground/[0.06]"
            >
              <div className="flex items-start gap-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-solid-soft text-2xl">
                  {food.emoji}
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium text-foreground">{food.name}</h3>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 font-medium text-[11px]',
                        tag === 'alergeno'
                          ? 'bg-feed-soft text-feed-foreground'
                          : tag === 'hierro'
                            ? 'bg-health-soft text-health-foreground'
                            : 'bg-solid-soft text-solid-foreground',
                      )}
                    >
                      {TAG_LABELS[tag]}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-sm">{why}</p>
                </div>
              </div>
              <div className="mt-auto flex gap-2">
                <Link
                  href={`/comidas/alimento/${food.key}` as Route}
                  className="flex h-10 flex-1 items-center justify-center rounded-xl bg-muted/70 font-medium text-foreground text-sm transition-colors hover:bg-muted"
                >
                  Cómo prepararlo
                </Link>
                <Link
                  href={`/comidas/anotar?alimento=${food.key}` as Route}
                  className="flex h-10 flex-1 items-center justify-center gap-1 rounded-xl bg-solid-soft font-medium text-solid-foreground text-sm ring-1 ring-solid/25"
                >
                  <Plus className="size-4" aria-hidden />
                  Anotar
                </Link>
              </div>
            </article>
          ))}
        </div>
        {allergenHold && (
          <p className="flex gap-2 text-muted-foreground text-sm">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            {allergenHold}
          </p>
        )}
      </section>

      {/* Volvé a ofrecerle */}
      {reoffer.length > 0 && (
        <section aria-labelledby="reofrecer" className="flex flex-col gap-3">
          <SectionTitle
            id="reofrecer"
            title="Volvé a ofrecerle"
            hint="Un “no” no es para siempre: a veces hacen falta 8 a 15 intentos."
          />
          <ul className="flex flex-col gap-2">
            {reoffer.map((s) => (
              <ReofferRow key={s.key} summary={s} />
            ))}
          </ul>
        </section>
      )}

      {/* Alérgenos */}
      <section aria-labelledby="alergenos" className="flex flex-col gap-3">
        <SectionTitle
          id="alergenos"
          title="Alérgenos"
          hint="De a uno, temprano, y una vez que los tolera, al menos una vez por semana."
        />
        <ul className="grid grid-cols-3 gap-2">
          {allergens.map((a) => {
            const state = ALLERGEN_STATE[a.state];
            return (
              <li
                key={a.allergen}
                className={cn('flex flex-col gap-1 rounded-2xl px-3 py-3 ring-1', state.className)}
              >
                <span className="text-xl leading-none" aria-hidden>
                  {ALLERGEN_EMOJI[a.allergen]}
                </span>
                <span className="font-medium text-[13px] text-foreground leading-tight">
                  {a.label}
                </span>
                <span className="text-[11.5px] leading-tight">
                  {state.label}
                  {a.state === 'introducing' && ` (${a.exposures})`}
                  {a.state === 'lapsed' && a.daysSinceLast !== null && ` · ${a.daysSinceLast} d`}
                </span>
              </li>
            );
          })}
        </ul>
        <Link
          href={'/comidas/guia#alergenos' as Route}
          className="inline-flex items-center gap-1 self-start font-medium text-primary text-sm"
        >
          Cómo sumarlos y qué mirar
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </section>

      {/* Lo que ya probó */}
      {summaries.length > 0 && (
        <section aria-labelledby="probados" className="flex flex-col gap-4">
          <SectionTitle id="probados" title="Lo que ya probó" />
          {GROUP_ORDER.map((group) => {
            const items = summaries.filter((s) => s.food?.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group} className="flex flex-col gap-2">
                <h3 className="text-muted-foreground text-sm">
                  {FOOD_GROUP_LABELS[group]} · {items.length}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {items.map((s) => (
                    <FoodChip key={s.key} summary={s} />
                  ))}
                </div>
              </div>
            );
          })}
          {summaries.some((s) => !s.food) && (
            <div className="flex flex-col gap-2">
              <h3 className="text-muted-foreground text-sm">Otros</h3>
              <div className="flex flex-wrap gap-2">
                {summaries
                  .filter((s) => !s.food)
                  .map((s) => (
                    <FoodChip key={s.key} summary={s} />
                  ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Comidas anteriores */}
      {past.length > 0 && (
        <section aria-labelledby="anteriores" className="flex flex-col gap-3">
          <SectionTitle id="anteriores" title="Comidas anteriores" />
          <div className="flex flex-col gap-3">
            {past.map((meal) => (
              <MealCard
                key={meal.id}
                meal={meal}
                timeLabel={formatDateAr(meal.occurredAt, {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                }).concat(` · ${formatTimeAr(meal.occurredAt)}`)}
                method={methodOf(meal)}
                firstTimeKeys={firstTimeKeys(meal)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Guía */}
      <section aria-labelledby="guia" className="flex flex-col gap-3">
        <SectionTitle id="guia" title="Guía" hint="Lo esencial, corto y con fuentes." />
        <div className="grid gap-2 sm:grid-cols-2">
          {GUIDE.map((g) => (
            <Link
              key={g.id}
              href={`/comidas/guia#${g.id}` as Route}
              className="flex items-center gap-3 rounded-2xl bg-card p-3 ring-1 ring-foreground/[0.06] transition-transform active:scale-[0.99]"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted/70 text-lg">
                {g.emoji}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="font-medium text-foreground text-sm">{g.title}</span>
                <span className="truncate text-muted-foreground text-xs">{g.summary}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* SalustIA */}
      <section
        aria-labelledby="preguntar"
        className="flex flex-col gap-3 rounded-[2rem] bg-card p-5 ring-1 ring-foreground/[0.06]"
      >
        <div className="flex items-center gap-3">
          <SaluBotAvatar size={40} />
          <div className="flex flex-col">
            <h2 id="preguntar" className="font-medium text-foreground">
              Preguntale a SalustIA
            </h2>
            <span className="text-muted-foreground text-sm">
              Sabe lo que probó {firstName} y cómo le fue.
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {CHAT_PROMPTS.map((p) => (
            <Link
              key={p}
              href={`/chat?q=${encodeURIComponent(p)}` as Route}
              className="inline-flex items-center gap-1.5 rounded-full bg-muted/70 px-3 py-1.5 text-foreground/90 text-sm transition-colors hover:bg-muted"
            >
              <Sparkles className="size-3.5 text-primary" aria-hidden />
              {p}
            </Link>
          ))}
        </div>
      </section>

      <p className="text-muted-foreground text-xs">
        Es orientación general basada en la OMS, la SAP y el Ministerio de Salud. Ante cualquier
        duda, la pediatra de {firstName} tiene la última palabra.
      </p>
    </div>
  );
}

function SectionTitle({ id, title, hint }: { id: string; title: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5 px-1">
      <h2
        id={id}
        className="font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.22em]"
      >
        {title}
      </h2>
      {hint && <p className="text-muted-foreground text-sm">{hint}</p>}
    </div>
  );
}

function GoalRing({ pct }: { pct: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 64 64" className="size-16 -rotate-90" aria-hidden>
      <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" className="stroke-solid/20" />
      <circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct / 100)}
        className="stroke-solid"
      />
    </svg>
  );
}

function FoodChip({ summary }: { summary: FoodSummary }) {
  const face = summary.lastAcceptance ? ACCEPTANCE_EMOJI[summary.lastAcceptance] : null;
  const inner = (
    <>
      <span aria-hidden>{summary.food?.emoji ?? '🍽️'}</span>
      <span className="text-foreground">{summary.name}</span>
      {summary.exposures > 1 && (
        <span className="text-muted-foreground text-xs tabular-nums">×{summary.exposures}</span>
      )}
      {summary.status === 'reaction' ? (
        <span role="img" aria-label="Hubo reacción">
          ⚠️
        </span>
      ) : (
        face && (
          <span
            role="img"
            aria-label={summary.lastAcceptance ? ACCEPTANCE_LABELS[summary.lastAcceptance] : ''}
          >
            {face}
          </span>
        )
      )}
    </>
  );
  const className = cn(
    'inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-sm ring-1',
    summary.status === 'reaction' ? 'ring-health/40' : 'ring-foreground/[0.08]',
  );
  return summary.food ? (
    <Link href={`/comidas/alimento/${summary.key}` as Route} className={className}>
      {inner}
    </Link>
  ) : (
    <span className={className}>{inner}</span>
  );
}

function ReofferRow({ summary }: { summary: FoodSummary }) {
  const pct = Math.min(100, (summary.exposures / REOFFER_TARGET) * 100);
  return (
    <li>
      <Link
        href={(summary.food ? `/comidas/alimento/${summary.key}` : '/comidas') as Route}
        className="flex items-center gap-3 rounded-2xl bg-card p-3 ring-1 ring-foreground/[0.06]"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted/70 text-xl">
          {summary.food?.emoji ?? '🍽️'}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-foreground text-sm">{summary.name}</span>
            <span className="text-muted-foreground text-xs tabular-nums">
              {summary.exposures === 1 ? '1 intento' : `${summary.exposures} intentos`}
            </span>
          </div>
          <span className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
            <span className="block h-full rounded-full bg-feed" style={{ width: `${pct}%` }} />
          </span>
        </div>
        {summary.lastAcceptance && (
          <span
            className="text-xl"
            role="img"
            aria-label={ACCEPTANCE_LABELS[summary.lastAcceptance]}
          >
            {ACCEPTANCE_EMOJI[summary.lastAcceptance]}
          </span>
        )}
      </Link>
    </li>
  );
}

function daysUntilFirstBirthday(birthDate: string, now: Date): number {
  const [y, m, d] = birthDate.slice(0, 10).split('-').map(Number);
  const birthday = Date.UTC((y ?? 0) + 1, (m ?? 1) - 1, d ?? 1);
  const today = Date.parse(`${arDateKey(now)}T00:00:00Z`);
  return Math.round((birthday - today) / 86_400_000);
}
