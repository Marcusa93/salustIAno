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
  type BreastSide,
  FEEDING_REACTION_LABELS,
  FEEDING_TYPE_LABELS,
  type FeedingEventInput,
  type FeedingReaction,
  type FeedingType,
  breastSideEnum,
  feedingEventSchema,
  feedingReactionEnum,
  feedingTypeEnum,
} from '@/lib/validators/events';
import { zodResolver } from '@/lib/zod-compat';
import { Loader2, Milk } from 'lucide-react';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { updateFeedingAction } from '../actions';

const TYPES = feedingTypeEnum.options;
const SIDES = breastSideEnum.options;
const REACTIONS = feedingReactionEnum.options;

function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

interface EditFeedingSheetProps {
  eventId: string;
  initial: {
    occurred_at: string;
    type: FeedingType;
    side: BreastSide | null;
    duration_minutes: number | null;
    amount_ml: number | null;
    foods: string[] | null;
    reaction: FeedingReaction;
    notes: string | null;
  };
  trigger: ReactElement;
}

export function EditFeedingSheet({ eventId, initial, trigger }: EditFeedingSheetProps) {
  const [open, setOpen] = useState(false);

  const form = useForm<FeedingEventInput>({
    resolver: zodResolver(feedingEventSchema),
    defaultValues: {
      occurred_at: isoToLocalInput(initial.occurred_at),
      type: initial.type,
      side: initial.side ?? '',
      duration_minutes: initial.duration_minutes ?? undefined,
      amount_ml: initial.amount_ml ?? undefined,
      foods: initial.foods ?? undefined,
      reaction: initial.reaction,
      notes: initial.notes ?? '',
    },
  });

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;

  const watchedType = useWatch({ control, name: 'type' });

  async function onSubmit(values: FeedingEventInput) {
    const result = await updateFeedingAction(eventId, {
      ...values,
      occurred_at: new Date(values.occurred_at).toISOString(),
    });
    if (!result.ok) {
      toast.error(result.errors.root ?? 'No pudimos actualizar la toma.');
      return;
    }
    toast.success('Cambios guardados.');
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={trigger} />
      <SheetContent
        side="bottom"
        className="max-h-[90dvh] overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 font-display text-2xl">
            <Milk className="size-5" aria-hidden />
            Editar toma
          </SheetTitle>
          <SheetDescription>Ajustá los datos de la toma.</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 px-4 pb-6 pt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ef-when">Cuándo</Label>
            <Input
              id="ef-when"
              type="datetime-local"
              {...register('occurred_at')}
              aria-invalid={!!errors.occurred_at}
            />
            {errors.occurred_at && (
              <p className="text-destructive text-sm">{errors.occurred_at.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ef-type">Tipo</Label>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="ef-type">
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
                <Label htmlFor="ef-side">Lado</Label>
                <Controller
                  control={control}
                  name="side"
                  render={({ field }) => (
                    <Select
                      value={field.value || undefined}
                      onValueChange={(v) => field.onChange(v || '')}
                    >
                      <SelectTrigger id="ef-side">
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
                <Label htmlFor="ef-duration">Duración (min)</Label>
                <Input
                  id="ef-duration"
                  type="number"
                  inputMode="numeric"
                  step="1"
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
                <Label htmlFor="ef-amount">Cantidad (ml)</Label>
                <Input
                  id="ef-amount"
                  type="number"
                  inputMode="numeric"
                  step="5"
                  {...register('amount_ml', { valueAsNumber: true })}
                />
                {errors.amount_ml && (
                  <p className="text-destructive text-sm">{errors.amount_ml.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ef-duration-bottle">Duración (min, opcional)</Label>
                <Input
                  id="ef-duration-bottle"
                  type="number"
                  inputMode="numeric"
                  step="1"
                  {...register('duration_minutes', { valueAsNumber: true })}
                />
              </div>
            </>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ef-reaction">Reacción</Label>
            <Controller
              control={control}
              name="reaction"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="ef-reaction">
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
            <Label htmlFor="ef-notes">Notas</Label>
            <Textarea id="ef-notes" rows={2} {...register('notes')} />
          </div>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Guardando…
              </>
            ) : (
              'Guardar cambios'
            )}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
