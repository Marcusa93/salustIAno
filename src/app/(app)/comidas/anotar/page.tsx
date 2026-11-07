import { suggestNext } from '@/lib/solids/progress';
import { ArrowLeft } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { type DraftTasting, MealForm, type QuickFood } from '../_components/meal-form';
import { loadSolidsData } from '../data';

export const metadata: Metadata = {
  title: 'Anotar comida',
};

interface Props {
  searchParams: Promise<{ editar?: string; alimento?: string }>;
}

const AR_TZ = 'America/Argentina/Buenos_Aires';

/** ISO → "YYYY-MM-DDTHH:mm" en hora de Argentina (para el input datetime-local). */
function toLocalInput(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: AR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

export default async function AnotarComidaPage({ searchParams }: Props) {
  const { editar, alimento } = await searchParams;
  const data = await loadSolidsData();
  if (!data) notFound();

  const meal = editar ? data.meals.find((m) => m.id === editar) : undefined;
  if (editar && !meal) notFound();

  const { suggestions } = suggestNext(data.meals, data.summaries, {
    ageMonths: data.ageMonths,
    now: new Date(),
    limit: 6,
  });
  const suggested: QuickFood[] = suggestions.map(({ food }) => ({
    key: food.key,
    name: food.name,
    emoji: food.emoji,
  }));
  const recent: QuickFood[] = data.summaries.slice(0, 14).map((s) => ({
    key: s.key,
    name: s.name,
    emoji: s.food?.emoji ?? '🍽️',
  }));
  const initialTastings: DraftTasting[] | undefined = meal?.tastings.map((t, i) => ({
    uid: `e${i}`,
    foodKey: t.foodKey,
    foodName: t.foodName,
    format: t.format,
    acceptance: t.acceptance,
    amount: t.amount,
    gagged: t.gagged,
    reaction: t.reaction,
    reactionSigns: t.reactionSigns,
  }));
  // Al editar, lo de esta comida no cuenta como "ya probado".
  const triedKeys = data.summaries
    .filter((s) => !meal || s.firstAt !== meal.occurredAt)
    .map((s) => s.key);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 sm:px-6">
      <header className="flex flex-col gap-3">
        <Link
          href={'/comidas' as Route}
          className="inline-flex items-center gap-1 self-start text-muted-foreground text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Comidas
        </Link>
        <h1 className="font-display text-[2.2rem] text-foreground leading-[1.05] tracking-tight">
          {meal ? 'Editar la comida.' : `¿Qué comió ${data.firstName}?`}
        </h1>
        {!meal && (
          <p className="text-muted-foreground">
            Podés anotarla al servir y completar después si le gustó.
          </p>
        )}
      </header>

      <MealForm
        mealId={meal?.id}
        initialLocalTime={meal ? toLocalInput(meal.occurredAt) : undefined}
        initialNotes={meal?.notes ?? undefined}
        initialTastings={initialTastings}
        preselectKey={meal ? undefined : alimento}
        suggested={suggested}
        recent={recent}
        triedKeys={triedKeys}
      />
    </div>
  );
}
