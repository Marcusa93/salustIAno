'use client';

import { ChipsInput } from '@/components/salu/chips-input';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
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
import { storyInputSchema } from '@/lib/ai/agents/story-schema';
import { zodResolver } from '@/lib/zod-compat';
import { BookOpen, Brain, Heart, Loader2, Moon, Sparkles } from 'lucide-react';
import { useRef, useState, useTransition } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { createStoryAction } from './actions';
import type { StoryFormState, StoryInput } from './shared';
import { StoryResult } from './story-result';

const MOMENT_OPTIONS = [
  { value: 'dormir', label: 'Para dormir', Icon: Moon },
  { value: 'jugar', label: 'Para jugar', Icon: Sparkles },
  { value: 'calmar', label: 'Para calmar', Icon: Heart },
  { value: 'estimular', label: 'Para estimular', Icon: Brain },
  { value: 'recordar', label: 'Para recordar', Icon: BookOpen },
] as const;

const DURATION_OPTIONS = [
  { value: 'corto', label: 'Cortito (1-2 minutos)' },
  { value: 'medio', label: 'Medio (3-5 minutos)' },
  { value: 'largo', label: 'Largo (5-10 minutos)' },
] as const;

const DEFAULT_VALUES: Partial<StoryInput> = {
  childName: 'Salustiano',
  ageDescription: '',
  moment: 'dormir',
  characters: [],
  duration: 'corto',
};

export function StoryForm() {
  const [state, setState] = useState<StoryFormState>({ status: 'idle' });
  const [isPending, startTransition] = useTransition();
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);

  const form = useForm<StoryInput>({
    resolver: zodResolver(storyInputSchema),
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

  function runAction(values: StoryInput) {
    setState({ status: 'submitting' });
    startTransition(async () => {
      const result = await createStoryAction(values);
      setState(result);

      if (result.status === 'error') {
        toast.error(result.error.message);
      } else if (result.status === 'success') {
        // Focus al título del cuento cuando se renderice (después del paint).
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
            <Label htmlFor="childName">Nombre</Label>
            <Input
              id="childName"
              {...register('childName')}
              aria-invalid={!!errors.childName}
              aria-describedby={errors.childName ? 'childName-error' : undefined}
            />
            {errors.childName && (
              <p id="childName-error" className="text-destructive text-sm">
                {errors.childName.message}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ageDescription">Edad</Label>
            <Input
              id="ageDescription"
              placeholder="3 meses, 1 año recién cumplido…"
              {...register('ageDescription')}
              aria-invalid={!!errors.ageDescription}
              aria-describedby={errors.ageDescription ? 'ageDescription-error' : undefined}
            />
            {errors.ageDescription && (
              <p id="ageDescription-error" className="text-destructive text-sm">
                {errors.ageDescription.message}
              </p>
            )}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-4" disabled={submitting}>
          <legend className="font-medium text-base text-foreground">El momento</legend>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="moment">¿Para qué momento?</Label>
            <Controller
              control={control}
              name="moment"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="moment">
                    <SelectValue placeholder="Elegí un momento" />
                  </SelectTrigger>
                  <SelectContent>
                    {MOMENT_OPTIONS.map(({ value, label, Icon }) => (
                      <SelectItem key={value} value={value}>
                        <span className="inline-flex items-center gap-2">
                          <Icon className="size-4" aria-hidden />
                          {label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="duration">Duración</Label>
            <Controller
              control={control}
              name="duration"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="duration">
                    <SelectValue placeholder="Elegí la duración" />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-4" disabled={submitting}>
          <legend className="font-medium text-base text-foreground">Personajes</legend>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="characters">Quiénes aparecen</Label>
            <Controller
              control={control}
              name="characters"
              render={({ field }) => (
                <ChipsInput
                  id="characters"
                  name={field.name}
                  value={field.value ?? []}
                  onChange={field.onChange}
                  placeholder="Mamá, papá, la abuela, el perro Toto…"
                  max={8}
                  maxLength={50}
                  disabled={submitting}
                  aria-describedby={errors.characters ? 'characters-error' : undefined}
                />
              )}
            />
            {errors.characters && (
              <p id="characters-error" className="text-destructive text-sm">
                {errors.characters.message ?? 'Agregá al menos un personaje.'}
              </p>
            )}
          </div>
        </fieldset>

        <Accordion multiple={false}>
          <AccordionItem value="opcionales">
            <AccordionTrigger>Toques opcionales</AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-col gap-4 pt-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="emotion">Emoción a trabajar</Label>
                  <Input
                    id="emotion"
                    placeholder="celos, miedo a la oscuridad…"
                    {...register('emotion')}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="style">Estilo</Label>
                  <Input
                    id="style"
                    placeholder="con humor, como cuento clásico…"
                    {...register('style')}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="familyValues">Valores familiares</Label>
                  <Controller
                    control={control}
                    name="familyValues"
                    render={({ field }) => (
                      <ChipsInput
                        id="familyValues"
                        name={field.name}
                        value={field.value ?? []}
                        onChange={field.onChange}
                        placeholder="paciencia, generosidad…"
                        max={5}
                        maxLength={100}
                        disabled={submitting}
                      />
                    )}
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <Button type="submit" disabled={submitting} className="self-stretch sm:self-start">
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Tejiendo el cuento…
            </>
          ) : (
            <>
              <Sparkles className="size-4" aria-hidden />
              Generar cuento
            </>
          )}
        </Button>
      </form>

      <div aria-live="polite" aria-atomic="true">
        {state.status === 'success' && (
          <StoryResult
            ref={resultHeadingRef}
            story={state.story}
            meta={state.meta}
            onRegenerate={handleRegenerate}
            onNew={handleNew}
          />
        )}
      </div>
    </div>
  );
}
