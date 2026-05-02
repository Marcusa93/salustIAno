'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  LENGTH_LABELS,
  MOMENT_LABELS,
  MOOD_LABELS,
  lullabyInputSchema,
} from '@/lib/ai/agents/lullaby-schema';
import { zodResolver } from '@/lib/zod-compat';
import { Loader2, Music } from 'lucide-react';
import { useRef, useState, useTransition } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { createLullabyAction } from './actions';
import { LullabyResult } from './lullaby-result';
import type { LullabyFormState, LullabyInput } from './shared';

const MOMENT_VALUES = Object.keys(MOMENT_LABELS) as Array<keyof typeof MOMENT_LABELS>;
const MOOD_VALUES = Object.keys(MOOD_LABELS) as Array<keyof typeof MOOD_LABELS>;
const LENGTH_VALUES = Object.keys(LENGTH_LABELS) as Array<keyof typeof LENGTH_LABELS>;

const DEFAULT_VALUES: Partial<LullabyInput> = {
  childName: 'Salustiano',
  ageDescription: '',
  moment: 'dormir',
  mood: 'dulce',
  length: 'corta',
  theme: '',
};

export function LullabyForm() {
  const [state, setState] = useState<LullabyFormState>({ status: 'idle' });
  const [isPending, startTransition] = useTransition();
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);

  const form = useForm<LullabyInput>({
    resolver: zodResolver(lullabyInputSchema),
    defaultValues: DEFAULT_VALUES,
    mode: 'onSubmit',
  });

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    reset,
    getValues,
  } = form;

  const submitting = state.status === 'submitting' || isPending;

  function runAction(values: LullabyInput) {
    setState({ status: 'submitting' });
    startTransition(async () => {
      const result = await createLullabyAction(values);
      setState(result);
      if (result.status === 'error') {
        toast.error(result.error.message);
      } else if (result.status === 'success') {
        requestAnimationFrame(() => resultHeadingRef.current?.focus());
      }
    });
  }

  function handleRegenerate() {
    runAction(getValues());
  }

  function handleNew() {
    reset(DEFAULT_VALUES);
    setState({ status: 'idle' });
  }

  return (
    <div className="flex flex-col gap-8">
      <form
        onSubmit={handleSubmit(runAction)}
        aria-busy={submitting}
        className="flex flex-col gap-8"
        noValidate
      >
        <fieldset className="flex flex-col gap-4" disabled={submitting}>
          <legend className="font-medium text-base text-foreground">Sobre Salu</legend>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="l-name">Nombre</Label>
            <Input id="l-name" {...register('childName')} aria-invalid={!!errors.childName} />
            {errors.childName && (
              <p className="text-destructive text-sm">{errors.childName.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="l-age">Edad</Label>
            <Input
              id="l-age"
              placeholder="3 meses, 1 año recién cumplido…"
              {...register('ageDescription')}
              aria-invalid={!!errors.ageDescription}
            />
            {errors.ageDescription && (
              <p className="text-destructive text-sm">{errors.ageDescription.message}</p>
            )}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-4" disabled={submitting}>
          <legend className="font-medium text-base text-foreground">El momento</legend>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="l-moment">¿Para qué momento?</Label>
            <Controller
              control={control}
              name="moment"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="l-moment">
                    <SelectValue placeholder="Elegí un momento" />
                  </SelectTrigger>
                  <SelectContent>
                    {MOMENT_VALUES.map((v) => (
                      <SelectItem key={v} value={v}>
                        {MOMENT_LABELS[v]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="l-mood">Tono</Label>
              <Controller
                control={control}
                name="mood"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="l-mood">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MOOD_VALUES.map((v) => (
                        <SelectItem key={v} value={v}>
                          {MOOD_LABELS[v]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="l-length">Largo</Label>
              <Controller
                control={control}
                name="length"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="l-length">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LENGTH_VALUES.map((v) => (
                        <SelectItem key={v} value={v}>
                          {LENGTH_LABELS[v]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="l-theme">Tema o imagen (opcional)</Label>
            <Input
              id="l-theme"
              placeholder="el mar, un perrito, la abuela, las nubes…"
              {...register('theme')}
            />
            <p className="text-muted-foreground text-xs">
              Un tirita por dónde puede ir la letra. Si lo dejás vacío, SalustIA elige.
            </p>
          </div>
        </fieldset>

        <Button type="submit" disabled={submitting} className="self-stretch sm:self-start">
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Componiendo la canción…
            </>
          ) : (
            <>
              <Music className="size-4" aria-hidden />
              Generar canción
            </>
          )}
        </Button>
      </form>

      <div aria-live="polite" aria-atomic="true">
        {state.status === 'success' && (
          <LullabyResult
            ref={resultHeadingRef}
            lullaby={state.lullaby}
            meta={state.meta}
            onRegenerate={handleRegenerate}
            onNew={handleNew}
          />
        )}
      </div>
    </div>
  );
}
