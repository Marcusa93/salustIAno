import { babyAgeFromBirth } from '@/lib/baby-age';
import { formatDateAr, formatTimeAr } from '@/lib/format-ar';
import { FORMAT_LABELS, REACTION_LABELS } from '@/lib/solids/labels';
import type { AllergenState } from '@/lib/solids/progress';
import {
  GAG_WINDOW_DAYS,
  type ReportFood,
  type ReportReaction,
  buildSolidsReport,
  joinEs,
  monthsLabel,
} from '@/lib/solids/report';
import type { FoodFormat } from '@/lib/solids/types';
import { cn } from '@/lib/utils';
import { AlertTriangle, ArrowLeft, Check } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { loadSolidsData } from '../data';
import { PrintButton } from './print-button';

export const metadata: Metadata = {
  title: 'Informe de alimentación',
};

/**
 * Al imprimir, los colores pasan a negro sobre blanco aunque la app esté en
 * modo oscuro: el PDF se lee bien y no gasta tinta en fondos.
 */
const PRINT_PALETTE = [
  'print:[--background:#fff]',
  'print:[--card:#fff]',
  'print:[--foreground:#000]',
  'print:[--muted-foreground:#444]',
  'print:[--muted:#f2f2f2]',
  'print:[--border:#bbb]',
  'print:[--primary:#000]',
  'print:[--solid:#333]',
  'print:[--solid-soft:#fff]',
  'print:[--solid-foreground:#000]',
  'print:[--health:#000]',
  'print:[--health-soft:#fff]',
  'print:[--health-foreground:#000]',
  'print:[--feed:#555]',
  'print:[--feed-soft:#fff]',
  'print:[--feed-foreground:#000]',
].join(' ');

const ALLERGEN_STATE_LABELS: Record<AllergenState, string> = {
  pending: 'Sin probar',
  introducing: 'Sumándolo',
  maintain: 'Incorporado',
  lapsed: 'Sin darlo hace un tiempo',
  reaction: 'Hubo reacción',
};

const FORMAT_ORDER: readonly FoodFormat[] = ['puree', 'mashed', 'preloaded', 'finger'];
const MAX_GAG_ROWS = 12;

export default async function InformeComidasPage() {
  const data = await loadSolidsData();
  if (!data) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
        <p className="text-muted-foreground">Primero creá el perfil del bebé.</p>
      </div>
    );
  }

  const { childName, firstName, meals, ageMonths, birthDate } = data;
  const now = new Date();
  // Sin fecha de nacimiento, ageMonths es un 6 supuesto: no armamos preguntas con eso.
  const report = buildSolidsReport({ meals, ageMonths: birthDate ? ageMonths : 0, birthDate, now });
  const age = babyAgeFromBirth(birthDate, now);
  const today = formatDateAr(now, { day: 'numeric', month: 'long', year: 'numeric' });
  const { start, totals, allergens, reactions, acceptance, textures, gagging, iron, questions } =
    report;

  return (
    <div
      className={cn(
        'mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 sm:px-6 print:max-w-none print:gap-6 print:px-0',
        PRINT_PALETTE,
      )}
    >
      {/* Controles de pantalla: no salen en el papel. */}
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link
          href={'/comidas' as Route}
          className="inline-flex items-center gap-1 text-muted-foreground text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Volver a Comidas
        </Link>
        <PrintButton />
      </div>

      <header className="flex flex-col gap-2 border-border border-b pb-5 print:pb-3">
        <span className="font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.22em]">
          Alimentación complementaria · Para la pediatra
        </span>
        <h1 className="font-display text-[2.2rem] text-foreground leading-[1.05] tracking-tight print:text-3xl">
          Informe de alimentación
        </h1>
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">{childName}</span>
          {age && !age.unborn ? ` · ${age.label}` : ''} · {today}
        </p>
      </header>

      {/* Resumen */}
      <Section id="resumen" title="Resumen">
        {!start ? (
          <EmptyNote>Todavía no hay comidas anotadas en Comidas.</EmptyNote>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 rounded-3xl bg-solid-soft p-5 ring-1 ring-solid/25 sm:grid-cols-4 print:break-inside-avoid print:grid-cols-4 print:rounded-xl print:p-3 print:ring-border">
              <Stat
                label="Empezó"
                value={formatDateAr(start.at, { day: 'numeric', month: 'short' })}
                hint={
                  start.ageMonths !== null
                    ? `a los ${monthsLabel(start.ageMonths)}`
                    : formatDateAr(start.at, { year: 'numeric' })
                }
              />
              <Stat
                label="Desde entonces"
                value={String(start.daysSince)}
                hint={start.daysSince === 1 ? 'día' : 'días'}
              />
              <Stat label="Comidas" value={String(totals.meals)} hint="anotadas" />
              <Stat
                label="Alimentos"
                value={String(totals.foods)}
                hint={totals.foods === 1 ? 'distinto' : 'distintos'}
              />
            </div>
            <ul className="flex flex-col divide-y divide-border rounded-2xl bg-card ring-1 ring-foreground/[0.06] print:rounded-none print:ring-0">
              {report.groups.map((g) => (
                <li
                  key={g.group}
                  className="flex flex-col gap-0.5 px-4 py-2.5 print:break-inside-avoid print:px-0 print:py-1.5"
                >
                  <span className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium text-foreground">{g.label}</span>
                    <span className="text-muted-foreground tabular-nums">{g.count}</span>
                  </span>
                  {g.foods.length > 0 && (
                    <span className="text-muted-foreground text-sm">{g.foods.join(', ')}</span>
                  )}
                </li>
              ))}
              {report.otherFoods.length > 0 && (
                <li className="flex flex-col gap-0.5 px-4 py-2.5 print:break-inside-avoid print:px-0 print:py-1.5">
                  <span className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium text-foreground">Otros (anotados a mano)</span>
                    <span className="text-muted-foreground tabular-nums">
                      {report.otherFoods.length}
                    </span>
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {report.otherFoods.join(', ')}
                  </span>
                </li>
              )}
            </ul>
          </>
        )}
      </Section>

      {/* Alérgenos */}
      <Section
        id="alergenos"
        title="Alérgenos"
        hint="Veces = comidas en las que lo comió. Fechas de la primera y la última vez."
      >
        <div className="overflow-x-auto rounded-2xl ring-1 ring-foreground/[0.06] print:overflow-visible print:rounded-none print:ring-0">
          <table className="w-full min-w-[34rem] text-left text-sm print:min-w-0">
            <thead>
              <tr className="border-border border-b bg-muted/40 print:bg-transparent">
                <Th>Alérgeno</Th>
                <Th>Estado</Th>
                <Th>Primera vez</Th>
                <Th className="text-right">Veces</Th>
                <Th>Última vez</Th>
                <Th>Reacción</Th>
              </tr>
            </thead>
            <tbody>
              {allergens.map((a) => {
                const reacted = a.reaction !== 'none';
                return (
                  <tr
                    key={a.allergen}
                    className={cn(
                      'border-border/60 border-b last:border-0 print:break-inside-avoid',
                      reacted ? 'bg-health-soft' : 'bg-card',
                    )}
                  >
                    <Td>
                      <span className="font-medium">{a.label}</span>
                      {a.foods.some((f) => f !== a.label) && (
                        <span className="block text-muted-foreground text-xs">
                          {a.foods.join(', ')}
                        </span>
                      )}
                    </Td>
                    <Td className={cn(a.state === 'pending' && 'text-muted-foreground')}>
                      {ALLERGEN_STATE_LABELS[a.state]}
                      {a.state === 'lapsed' && a.daysSinceLast !== null && (
                        <span className="block text-muted-foreground text-xs">
                          hace {a.daysSinceLast} días
                        </span>
                      )}
                    </Td>
                    <Td>{a.firstAt ? shortDate(a.firstAt) : '—'}</Td>
                    <Td className="text-right tabular-nums">{a.exposures || '—'}</Td>
                    <Td>{a.lastAt ? shortDate(a.lastAt) : '—'}</Td>
                    <Td className={cn(reacted && 'font-semibold text-health-foreground')}>
                      {reacted ? REACTION_LABELS[a.reaction] : 'No'}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Reacciones */}
      <Section id="reacciones" title="Reacciones">
        {reactions.length === 0 ? (
          <EmptyNote>No anotaron reacciones.</EmptyNote>
        ) : (
          <ul className="flex flex-col gap-3">
            {reactions.map((r) => (
              <ReactionItem key={r.mealId} reaction={r} />
            ))}
          </ul>
        )}
      </Section>

      {/* Gustos */}
      <Section id="gustos" title="Lo que le gusta y lo que no">
        <div className="grid gap-3 sm:grid-cols-2 print:grid-cols-2">
          <FoodList
            title="Le encantan"
            empty="Todavía no hay favoritos anotados."
            foods={acceptance.favorites}
            detail={(f) => `${f.exposures}×`}
          />
          <FoodList
            title="Todavía no le gustan"
            empty="Nada rechazado la última vez."
            foods={acceptance.notYet}
            detail={(f) => `rechazado ${f.refusals} de ${f.exposures}`}
          />
        </div>
        {acceptance.reoffer.length > 0 && (
          <p className="text-muted-foreground text-sm">
            <span className="font-medium text-foreground">Para volver a ofrecer: </span>
            {joinEs(acceptance.reoffer.map((f) => f.name.toLowerCase()))}. Un “no” no es para
            siempre: a veces hacen falta 8 a 15 intentos.
          </p>
        )}
      </Section>

      {/* Texturas */}
      <Section
        id="texturas"
        title="Texturas y forma de ofrecer"
        hint="Cuántos alimentos le dieron de cada forma."
      >
        {textures.total === 0 ? (
          <EmptyNote>Todavía no anotaron cómo le ofrecen la comida.</EmptyNote>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 print:break-inside-avoid print:grid-cols-4">
              {FORMAT_ORDER.map((f) => (
                <div
                  key={f}
                  className="flex flex-col gap-0.5 rounded-2xl bg-card px-3 py-2.5 ring-1 ring-foreground/[0.06] print:rounded-lg print:ring-border"
                >
                  <span className="text-muted-foreground text-xs">{FORMAT_LABELS[f]}</span>
                  <span className="font-display text-2xl text-foreground tabular-nums leading-none">
                    {textures.totals[f]}
                  </span>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {pct(textures.totals[f], textures.total)}
                  </span>
                </div>
              ))}
            </div>
            {textures.byMonth.length > 1 && (
              <div className="overflow-x-auto rounded-2xl ring-1 ring-foreground/[0.06] print:overflow-visible print:rounded-none print:ring-0">
                <table className="w-full min-w-[30rem] text-left text-sm print:min-w-0">
                  <thead>
                    <tr className="border-border border-b bg-muted/40 print:bg-transparent">
                      <Th>{textures.byAge ? 'Edad' : 'Desde que empezó'}</Th>
                      {FORMAT_ORDER.map((f) => (
                        <Th key={f} className="text-right">
                          {FORMAT_LABELS[f]}
                        </Th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {textures.byMonth.map((m) => (
                      <tr
                        key={m.key}
                        className="border-border/60 border-b bg-card last:border-0 print:break-inside-avoid"
                      >
                        <Td className="font-medium">{m.label}</Td>
                        {FORMAT_ORDER.map((f) => (
                          <Td key={f} className="text-right tabular-nums">
                            {m.total === 0 ? '—' : m.counts[f] || '·'}
                          </Td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {textures.unknown > 0 && (
              <p className="text-muted-foreground text-xs">
                Hay {textures.unknown} {textures.unknown === 1 ? 'alimento' : 'alimentos'} sin la
                forma anotada.
              </p>
            )}
          </>
        )}
      </Section>

      {/* Arcadas */}
      <Section id="arcadas" title="Arcadas">
        {gagging.meals === 0 ? (
          <EmptyNote>No anotaron arcadas.</EmptyNote>
        ) : (
          <>
            <p className="text-foreground text-sm">
              {gagging.meals} {gagging.meals === 1 ? 'comida' : 'comidas'} con arcadas en total
              {` · ${gagging.recent} en los últimos ${GAG_WINDOW_DAYS} días`}
              {gagging.recentMeals > 0 ? ` (de ${gagging.recentMeals} comidas)` : ''}.
            </p>
            <ul className="flex flex-col divide-y divide-border rounded-2xl bg-card ring-1 ring-foreground/[0.06] print:rounded-none print:ring-0">
              {gagging.episodes.slice(0, MAX_GAG_ROWS).map((g) => (
                <li
                  key={g.mealId}
                  className="flex items-baseline justify-between gap-3 px-4 py-2 text-sm print:break-inside-avoid print:px-0 print:py-1"
                >
                  <span className="text-foreground">{g.foods.join(', ')}</span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {shortDate(g.at)}
                  </span>
                </li>
              ))}
            </ul>
            {gagging.episodes.length > MAX_GAG_ROWS && (
              <p className="text-muted-foreground text-xs">
                Y {gagging.episodes.length - MAX_GAG_ROWS} más, más viejas.
              </p>
            )}
          </>
        )}
      </Section>

      {/* Hierro */}
      <Section
        id="hierro"
        title="Hierro"
        hint="Desde los 6 meses la leche sola ya no alcanza a cubrirlo."
      >
        {iron.windowDays === 0 ? (
          <EmptyNote>Sin comidas anotadas todavía.</EmptyNote>
        ) : (
          <div className="flex flex-col gap-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/[0.06] print:break-inside-avoid print:rounded-lg print:ring-border">
            <p className="text-foreground text-sm">
              Comió algo con hierro{' '}
              <span className="font-semibold tabular-nums">
                {iron.daysWithIron} de los últimos {iron.windowDays} días
              </span>
              {iron.foods.length > 0 ? ` (${joinEs(iron.foods.map((f) => f.toLowerCase()))})` : ''}.
            </p>
            <ol className="flex flex-wrap gap-1.5" aria-label="Días con hierro">
              {iron.days.map((d) => (
                <li
                  key={d.date}
                  title={d.date}
                  className={cn(
                    'grid size-7 place-items-center rounded-lg border text-[11px]',
                    d.iron
                      ? 'border-solid bg-solid text-white dark:text-background print:border-2 print:border-black print:bg-transparent print:text-black'
                      : d.meals
                        ? 'border-border bg-card text-muted-foreground'
                        : 'border-border border-dashed text-muted-foreground/60',
                  )}
                >
                  {d.iron ? (
                    <Check className="size-3.5" aria-hidden />
                  ) : (
                    <span aria-hidden>{Number(d.date.slice(8))}</span>
                  )}
                  <span className="sr-only">
                    {d.iron ? 'Con hierro' : d.meals ? 'Comió, sin hierro' : 'Sin comidas anotadas'}
                  </span>
                </li>
              ))}
            </ol>
            <p className="text-muted-foreground text-xs">
              ✓ con hierro · número = comió sin hierro ese día · punteado = sin comidas anotadas.
            </p>
          </div>
        )}
      </Section>

      {/* Preguntas */}
      <Section
        id="preguntas"
        title="Preguntas para la pediatra"
        hint="Las arma la app con lo que anotaron. Sumen las suyas."
      >
        {questions.length === 0 ? (
          <EmptyNote>Con lo anotado no surge ninguna pregunta en particular.</EmptyNote>
        ) : (
          <ol className="flex flex-col gap-2">
            {questions.map((q, i) => (
              <li
                key={q.text}
                className={cn(
                  'flex gap-3 rounded-2xl px-4 py-3 text-sm ring-1 print:break-inside-avoid print:rounded-lg print:px-3 print:py-2',
                  q.urgent
                    ? 'bg-health-soft text-health-foreground ring-health/30'
                    : 'bg-card text-foreground ring-foreground/[0.06] print:ring-border',
                )}
              >
                <span className="shrink-0 font-medium tabular-nums">{i + 1}.</span>
                <span className={cn('leading-relaxed', q.urgent && 'font-medium')}>{q.text}</span>
              </li>
            ))}
          </ol>
        )}
        {/* En papel: renglones para anotar en la consulta. */}
        <div className="hidden flex-col gap-6 pt-4 print:flex print:break-inside-avoid">
          <span className="font-medium text-[10.5px] text-muted-foreground uppercase tracking-[0.22em]">
            Notas de la consulta
          </span>
          {[1, 2, 3, 4].map((n) => (
            <span key={n} className="block border-border border-b" aria-hidden />
          ))}
        </div>
      </Section>

      <footer className="flex flex-col gap-1 border-border border-t pt-4 text-muted-foreground text-xs print:break-inside-avoid">
        <p>
          Es un registro que lleva la familia de {firstName} en Salu, no un diagnóstico. Lo que diga
          la pediatra es lo que vale.
        </p>
        <p>Generado el {today}.</p>
      </footer>
    </div>
  );
}

function Section({
  id,
  title,
  hint,
  children,
}: {
  id: string;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5 px-1 print:break-after-avoid print:px-0">
        <h2
          id={id}
          className="font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.22em] print:text-foreground"
        >
          {title}
        </h2>
        {hint && <p className="text-muted-foreground text-sm print:text-xs">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-solid-foreground/80 uppercase tracking-wider">{label}</span>
      <span className="font-display text-2xl text-solid-foreground tabular-nums leading-tight">
        {value}
      </span>
      <span className="text-solid-foreground/80 text-xs">{hint}</span>
    </div>
  );
}

function ReactionItem({ reaction: r }: { reaction: ReportReaction }) {
  const strong = r.severity === 'strong';
  const others = r.foods.filter((f) => !r.suspects.includes(f));
  return (
    <li
      className={cn(
        'flex flex-col gap-2 rounded-2xl p-4 ring-1 print:break-inside-avoid print:rounded-lg print:p-3',
        strong || r.emergency
          ? 'bg-health-soft ring-health/40 print:ring-2 print:ring-black'
          : 'bg-card ring-foreground/[0.06] print:ring-border',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-foreground">{joinEs(r.suspects)}</span>
        <span className="flex items-center gap-2 text-sm">
          <span
            className={cn(
              'rounded-full px-2 py-0.5 font-medium text-[11px] ring-1',
              strong
                ? 'bg-health text-white ring-health dark:text-background print:bg-transparent print:text-black print:ring-black'
                : 'bg-feed-soft text-feed-foreground ring-feed/30',
            )}
          >
            {REACTION_LABELS[r.severity]}
          </span>
          <span className="text-muted-foreground tabular-nums">
            {formatDateAr(r.at, { weekday: 'short', day: 'numeric', month: 'short' })} ·{' '}
            {formatTimeAr(r.at)}
          </span>
        </span>
      </div>
      {others.length > 0 && (
        <p className="text-muted-foreground text-sm">En la misma comida: {others.join(', ')}.</p>
      )}
      {r.signs.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {r.signs.map((s) => (
            <li
              key={s.sign}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ring-1',
                s.emergency
                  ? 'bg-health-soft font-semibold text-health-foreground ring-health/50 print:ring-black'
                  : 'bg-muted/60 text-foreground ring-transparent print:ring-border',
              )}
            >
              {s.emergency && <AlertTriangle className="size-3.5" aria-hidden />}
              {s.label}
              {s.emergency && <span className="sr-only">(signo de alarma)</span>}
            </li>
          ))}
        </ul>
      )}
      {r.emergency && (
        <p className="flex gap-1.5 font-medium text-health-foreground text-xs">
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
          Hinchazón o dificultad para respirar son signos de alarma.
        </p>
      )}
      {r.notes && <p className="text-muted-foreground text-sm italic">“{r.notes}”</p>}
    </li>
  );
}

function FoodList({
  title,
  empty,
  foods,
  detail,
}: {
  title: string;
  empty: string;
  foods: readonly ReportFood[];
  detail: (food: ReportFood) => string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-card p-4 ring-1 ring-foreground/[0.06] print:break-inside-avoid print:rounded-lg print:p-3 print:ring-border">
      <h3 className="font-medium text-foreground text-sm">{title}</h3>
      {foods.length === 0 ? (
        <EmptyNote>{empty}</EmptyNote>
      ) : (
        <ul className="flex flex-col gap-1">
          {foods.map((f) => (
            <li key={f.key} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-foreground">
                <span aria-hidden className="mr-1.5">
                  {f.emoji ?? '🍽️'}
                </span>
                {f.name}
              </span>
              <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
                {detail(f)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground text-sm italic">{children}</p>;
}

function Th({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        'px-3 py-2.5 font-medium text-[10px] text-muted-foreground uppercase tracking-wider print:px-2 print:py-1.5',
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <td className={cn('px-3 py-2 align-top text-foreground print:px-2 print:py-1.5', className)}>
      {children}
    </td>
  );
}

function shortDate(iso: string): string {
  return formatDateAr(iso, { day: 'numeric', month: 'short' });
}

function pct(n: number, total: number): string {
  return total === 0 ? '' : `${Math.round((n / total) * 100)}%`;
}
