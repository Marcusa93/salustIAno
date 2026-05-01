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
  SLEEP_QUALITY_LABELS,
  type SleepQuality,
  type SleepSessionInput,
  sleepQualityEnum,
  sleepSessionSchema,
} from '@/lib/validators/events';
import { zodResolver } from '@/lib/zod-compat';
import { Loader2, Moon } from 'lucide-react';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { updateSleepAction } from '../actions';

const QUALITIES = sleepQualityEnum.options;

function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

interface EditSleepSheetProps {
  eventId: string;
  initial: {
    started_at: string;
    ended_at: string | null;
    quality: SleepQuality;
    is_nap: boolean;
    notes: string | null;
  };
  trigger: ReactElement;
}

export function EditSleepSheet({ eventId, initial, trigger }: EditSleepSheetProps) {
  const [open, setOpen] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SleepSessionInput>({
    resolver: zodResolver(sleepSessionSchema),
    defaultValues: {
      started_at: isoToLocalInput(initial.started_at),
      ended_at: initial.ended_at ? isoToLocalInput(initial.ended_at) : '',
      quality: initial.quality,
      is_nap: initial.is_nap,
      notes: initial.notes ?? '',
    },
  });

  async function onSubmit(values: SleepSessionInput) {
    const result = await updateSleepAction(eventId, {
      ...values,
      started_at: new Date(values.started_at).toISOString(),
      ended_at: values.ended_at ? new Date(values.ended_at).toISOString() : '',
    });
    if (!result.ok) {
      toast.error(result.errors.root ?? 'No pudimos actualizar el sueño.');
      return;
    }
    toast.success('Cambios guardados.');
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={trigger} />
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 font-display text-2xl">
            <Moon className="size-5" aria-hidden />
            Editar sueño
          </SheetTitle>
          <SheetDescription>Si el sueño sigue activo, dejá el final en blanco.</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 px-4 pb-6 pt-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="es-start">Empezó</Label>
              <Input
                id="es-start"
                type="datetime-local"
                {...register('started_at')}
                aria-invalid={!!errors.started_at}
              />
              {errors.started_at && (
                <p className="text-destructive text-sm">{errors.started_at.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="es-end">Terminó (opcional)</Label>
              <Input
                id="es-end"
                type="datetime-local"
                {...register('ended_at')}
                aria-invalid={!!errors.ended_at}
              />
              {errors.ended_at && (
                <p className="text-destructive text-sm">{errors.ended_at.message}</p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="es-quality">¿Cómo durmió?</Label>
            <Controller
              control={control}
              name="quality"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="es-quality">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUALITIES.map((q) => (
                      <SelectItem key={q} value={q}>
                        {SLEEP_QUALITY_LABELS[q]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register('is_nap')} className="size-4" />
            Fue siesta corta
          </label>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="es-notes">Notas</Label>
            <Textarea id="es-notes" rows={2} {...register('notes')} />
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
