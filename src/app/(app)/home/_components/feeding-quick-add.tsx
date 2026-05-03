'use client';

import { createFeedingAction, lastFeedingAction } from '@/app/(app)/cuidar/eventos/actions';
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import {
  BREAST_SIDE_LABELS,
  FEEDING_REACTION_LABELS,
  FEEDING_TYPE_LABELS,
  type FeedingEventInput,
  breastSideEnum,
  feedingEventSchema,
  feedingReactionEnum,
  feedingTypeEnum,
} from '@/lib/validators/events';
import { zodResolver } from '@/lib/zod-compat';
import { Loader2, Milk, RotateCcw } from 'lucide-react';
import type { ReactElement } from 'react';
import { useState, useTransition } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';

const TYPES = feedingTypeEnum.options;
const SIDES = breastSideEnum.options;
const REACTIONS = feedingReactionEnum.options;

function nowLocalISO(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

interface FeedingQuickAddProps {
  trigger: ReactElement;
}

export function FeedingQuickAdd({ trigger }: FeedingQuickAddProps) {
  const [open, setOpen] = useState(false);
  const [duplicating, startDuplicate] = useTransition();

  const form = useForm<FeedingEventInput>({
    resolver: zodResolver(feedingEventSchema),
    defaultValues: {
      occurred_at: nowLocalISO(),
      type: 'breastfeeding',
      reaction: 'none',
      notes: '',
    },
  });

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = form;

  // Vemos el type para mostrar/ocultar campos correspondientes.
  const watchedType = useWatch({ control, name: 'type' });

  function fillFromLast() {
    startDuplicate(async () => {
      const result = await lastFeedingAction();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (!result.feeding) {
        toast.info('Todavía no hay tomas previas. Cargá la primera y después podrás duplicarla.');
        return;
      }
      const f = result.feeding;
      // Reseteamos pero conservamos el "ahora" en occurred_at.
      reset({
        occurred_at: nowLocalISO(),
        type: f.type,
        side: f.side,
        duration_minutes: f.duration_minutes,
        amount_ml: f.amount_ml,
        foods: f.foods,
        reaction: f.reaction,
        notes: f.notes,
      });
      // Algunos campos numéricos no se asientan con reset; aseguramos.
      if (f.duration_minutes !== undefined) setValue('duration_minutes', f.duration_minutes);
      if (f.amount_ml !== undefined) setValue('amount_ml', f.amount_ml);
      toast.success('Tomamos los datos de la toma anterior.');
    });
  }

  async function onSubmit(values: FeedingEventInput) {
    const result = await createFeedingAction({
      ...values,
      occurred_at: new Date(values.occurred_at).toISOString(),
    });
    if (!result.ok) {
      toast.error(result.errors.root ?? 'No pudimos guardar la toma.');
      return;
    }
    toast.success('Toma anotada.');
    reset({
      occurred_at: nowLocalISO(),
      type: 'breastfeeding',
      reaction: 'none',
      notes: '',
    });
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={trigger} />
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 font-display text-2xl">
            <Milk className="size-5" aria-hidden />
            Anotar toma
          </SheetTitle>
          <SheetDescription>Pecho, biberón o sólido.</SheetDescription>
        </SheetHeader>

        <div className="flex justify-end px-4 pt-1">
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={fillFromLast}
            disabled={duplicating || isSubmitting}
          >
            {duplicating ? (
              <Loader2 className="size-3 animate-spin" aria-hidden />
            ) : (
              <RotateCcw className="size-3" aria-hidden />
            )}
            Como la última toma
          </Button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 px-4 pb-6 pt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="f-when">Cuándo</Label>
            <Input
              id="f-when"
              type="datetime-local"
              {...register('occurred_at')}
              aria-invalid={!!errors.occurred_at}
            />
            {errors.occurred_at && (
              <p className="text-destructive text-sm">{errors.occurred_at.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="f-type">Tipo</Label>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="f-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {FEEDING_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {watchedType === 'breastfeeding' && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="f-side">Lado</Label>
                <Controller
                  control={control}
                  name="side"
                  render={({ field }) => (
                    <Select
                      value={field.value || undefined}
                      onValueChange={(v) => field.onChange(v || '')}
                    >
                      <SelectTrigger id="f-side">
                        <SelectValue placeholder="Si querés anotarlo" />
                      </SelectTrigger>
                      <SelectContent>
                        {SIDES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {BREAST_SIDE_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="f-duration">Duración (min)</Label>
                <Input
                  id="f-duration"
                  type="number"
                  inputMode="numeric"
                  step="1"
                  placeholder="15"
                  {...register('duration_minutes', { valueAsNumber: true })}
                />
                {errors.duration_minutes && (
                  <p className="text-destructive text-sm">{errors.duration_minutes.message}</p>
                )}
              </div>
            </>
          )}

          {watchedType === 'bottle' && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="f-amount">Cantidad (ml)</Label>
                <Input
                  id="f-amount"
                  type="number"
                  inputMode="numeric"
                  step="5"
                  placeholder="60"
                  {...register('amount_ml', { valueAsNumber: true })}
                />
                {errors.amount_ml && (
                  <p className="text-destructive text-sm">{errors.amount_ml.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="f-duration-bottle">Duración (min, opcional)</Label>
                <Input
                  id="f-duration-bottle"
                  type="number"
                  inputMode="numeric"
                  step="1"
                  {...register('duration_minutes', { valueAsNumber: true })}
                />
              </div>
            </>
          )}

          {watchedType === 'solid' && (
            <p className="text-muted-foreground text-sm">
              Cuando empiece con sólidos, vamos a sumar el campo de alimentos. Por ahora dejá lo que
              comió en notas.
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="f-reaction">Reacción</Label>
            <Controller
              control={control}
              name="reaction"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="f-reaction">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REACTIONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {FEEDING_REACTION_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="f-notes">Notas (opcional)</Label>
            <Textarea id="f-notes" rows={2} {...register('notes')} />
          </div>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Guardando…
              </>
            ) : (
              'Guardar'
            )}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
