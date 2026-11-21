'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { MenuOutput, RecetaSugerida } from '@/lib/ai/agents/menu';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  CheckCircle2,
  ChefHat,
  Clock,
  Loader2,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { useActionState } from 'react';
import type { MenuActionResult } from '../actions';
import { getMenuSuggestionsAction } from '../actions';

interface Props {
  nombreBebe: string;
  edadLabel: string;
}

export function MenuForm({ nombreBebe, edadLabel }: Props) {
  const [state, formAction, isPending] = useActionState<MenuActionResult | null, FormData>(
    getMenuSuggestionsAction,
    null,
  );

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="flex flex-col gap-3">
        <label htmlFor="ingredientes" className="font-medium text-foreground text-sm">
          ¿Qué tenés en casa?
        </label>
        <textarea
          id="ingredientes"
          name="ingredientes"
          rows={3}
          placeholder="pollo, zanahoria, papa, aceite de girasol..."
          className={cn(
            'w-full resize-none rounded-xl border border-input bg-background px-3.5 py-2.5 text-foreground text-sm',
            'placeholder:text-muted-foreground/60 focus:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
            'disabled:cursor-not-allowed disabled:opacity-60',
          )}
          disabled={isPending}
          maxLength={500}
          aria-label="Ingredientes disponibles"
        />
        <p className="text-muted-foreground/70 text-xs">
          Escribí los ingredientes separados por coma. Te sugerimos recetas aptas para {nombreBebe}{' '}
          ({edadLabel}).
        </p>
        <Button type="submit" disabled={isPending} className="self-start gap-2">
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Consultando…
            </>
          ) : (
            <>
              <Sparkles className="size-4" aria-hidden />
              Ver qué puede comer
            </>
          )}
        </Button>
      </form>

      {state && !state.ok && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive text-sm"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {state.error}
        </div>
      )}

      {state?.ok && <MenuResult result={state.result} />}
    </div>
  );
}

function MenuResult({ result }: { result: MenuOutput }) {
  return (
    <div className="flex flex-col gap-6">
      <IngredientesSection aptos={result.ingredientesAptos} noAptos={result.ingredientesNoAptos} />

      {result.recetas.length > 0 && (
        <section aria-label="Recetas sugeridas">
          <h2 className="mb-3 font-semibold text-base text-foreground">
            {result.recetas.length === 1 ? 'Receta sugerida' : 'Recetas sugeridas'}
          </h2>
          <div className="flex flex-col gap-4">
            {result.recetas.map((r) => (
              <RecetaCard key={r.nombre} receta={r} />
            ))}
          </div>
        </section>
      )}

      {result.consejo && (
        <Card className="flex gap-3 border-primary/20 bg-primary/5 p-4">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <p className="text-foreground/80 text-sm leading-relaxed">{result.consejo}</p>
        </Card>
      )}
    </div>
  );
}

function IngredientesSection({
  aptos,
  noAptos,
}: {
  aptos: string[];
  noAptos: MenuOutput['ingredientesNoAptos'];
}) {
  if (aptos.length === 0 && noAptos.length === 0) return null;

  return (
    <section aria-label="Evaluación de ingredientes">
      <h2 className="mb-3 font-semibold text-base text-foreground">Ingredientes</h2>
      <div className="flex flex-wrap gap-2">
        {aptos.map((ing) => (
          <span
            key={ing}
            className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-3 py-1 text-green-700 text-xs font-medium ring-1 ring-green-500/20 dark:text-green-400"
          >
            <CheckCircle2 className="size-3" aria-hidden />
            {ing}
          </span>
        ))}
        {noAptos.map(({ nombre, motivo }) => (
          <span
            key={nombre}
            title={motivo}
            className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1 text-destructive text-xs font-medium ring-1 ring-destructive/20"
          >
            <XCircle className="size-3" aria-hidden />
            {nombre}
          </span>
        ))}
      </div>
      {noAptos.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {noAptos.map(({ nombre, motivo }) => (
            <li key={nombre} className="text-muted-foreground/80 text-xs">
              <span className="font-medium text-destructive">{nombre}:</span> {motivo}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RecetaCard({ receta }: { receta: RecetaSugerida }) {
  return (
    <Card className="flex flex-col gap-4 border-border/60 p-4">
      <header className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <ChefHat className="size-4 shrink-0 text-primary" aria-hidden />
          <h3 className="font-semibold text-foreground text-sm">{receta.nombre}</h3>
        </div>
        <div className="flex items-center gap-1 shrink-0 rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
          <Clock className="size-3" aria-hidden />
          {receta.duracion}
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-1.5 font-medium text-muted-foreground text-[11px] uppercase tracking-wide">
            Ingredientes
          </p>
          <ul className="flex flex-col gap-1">
            {receta.ingredientes.map((ing) => (
              <li key={ing} className="text-foreground/80 text-sm">
                · {ing}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-1.5 font-medium text-muted-foreground text-[11px] uppercase tracking-wide">
            Textura
          </p>
          <span className="inline-block rounded-full border border-border/60 bg-muted px-2.5 py-0.5 text-xs">
            {receta.textura}
          </span>
        </div>
      </div>

      <div>
        <p className="mb-1.5 font-medium text-muted-foreground text-[11px] uppercase tracking-wide">
          Preparación
        </p>
        <div className="whitespace-pre-line text-foreground/80 text-sm leading-relaxed">
          {receta.preparacion}
        </div>
      </div>

      {receta.alertas.length > 0 && (
        <ul className="flex flex-col gap-1 border-t border-border/40 pt-3">
          {receta.alertas.map((alerta) => (
            <li
              key={alerta}
              className="flex items-start gap-1.5 text-amber-700 text-xs dark:text-amber-400"
            >
              <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden />
              {alerta}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
