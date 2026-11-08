import { usualMethod } from '@/lib/solids/menu';
import { mealsPerDayGuide } from '@/lib/solids/progress';
import type { SolidMethod } from '@/lib/solids/types';
import { ArrowLeft } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { loadSolidsData } from '../data';
import { MenuPlanner } from './_components/menu-planner';

export const metadata: Metadata = {
  title: 'Menú de la semana',
};

const METHOD_CHIP: Record<SolidMethod, string> = {
  papilla: 'Vienen con papilla',
  blw: 'Vienen con BLW',
  mixto: 'Vienen mezclando papilla y BLW',
};

export default async function MenuSemanalPage() {
  const data = await loadSolidsData();
  if (!data) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 sm:px-6">
        <p className="text-muted-foreground">Primero creá el perfil del bebé.</p>
      </div>
    );
  }

  const { firstName, meals, summaries, ageMonths } = data;
  const method = usualMethod(meals);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-8 px-4 sm:px-6">
      <header className="flex flex-col gap-3">
        <Link
          href={'/comidas' as Route}
          className="inline-flex items-center gap-1 self-start text-muted-foreground text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Comidas
        </Link>
        <span className="font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.22em]">
          Alimentación · Menú
        </span>
        <h1 className="font-display text-[2.2rem] text-foreground leading-[1.05] tracking-tight">
          La semana de {firstName}.
        </h1>
        <p className="text-muted-foreground">
          Siete días de comidas con lo que ya probó, algo nuevo de a poco y hierro todos los días.
          Con la lista para el súper.
        </p>
        <ul className="flex flex-wrap gap-2 pt-1">
          <li className="inline-flex items-center rounded-full bg-solid-soft px-3 py-1 text-solid-foreground text-sm ring-1 ring-solid/25">
            {summaries.length} {summaries.length === 1 ? 'alimento probado' : 'alimentos probados'}
          </li>
          {method && (
            <li className="inline-flex items-center rounded-full bg-muted/60 px-3 py-1 text-muted-foreground text-sm">
              {METHOD_CHIP[method]}
            </li>
          )}
          <li className="inline-flex items-center rounded-full bg-muted/60 px-3 py-1 text-muted-foreground text-sm">
            {mealsPerDayGuide(ageMonths)}
          </li>
        </ul>
      </header>

      <MenuPlanner firstName={firstName} />

      <p className="text-muted-foreground text-xs">
        Es una guía armada con IA a partir de lo que anotaron y de lo que recomiendan la OMS, la
        Sociedad Argentina de Pediatría y el Ministerio de Salud. No es una indicación médica: ante
        cualquier duda, la pediatra de {firstName} tiene la última palabra.
      </p>
    </div>
  );
}
