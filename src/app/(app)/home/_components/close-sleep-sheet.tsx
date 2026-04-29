'use client';

import { closeSleepAction } from '@/app/(app)/cuidar/eventos/actions';
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
import {
  type CloseSleepInput,
  SLEEP_QUALITY_LABELS,
  closeSleepSchema,
  sleepQualityEnum,
} from '@/lib/validators/events';
import { zodResolver } from '@/lib/zod-compat';
import { Loader2, Sun } from 'lucide-react';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';

const QUALITIES = sleepQualityEnum.options;

function nowLocalISO(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

interface CloseSleepSheetProps {
  sessionId: string;
  startedAt: string;
  trigger: ReactElement;
}

export function CloseSleepSheet({ sessionId, startedAt, trigger }: CloseSleepSheetProps) {
  const [open, setOpen] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CloseSleepInput>({
    resolver: zodResolver(closeSleepSchema),
    defaultValues: {
      started_at: isoToLocalInput(startedAt),
      ended_at: nowLocalISO(),
      quality: 'unknown',
    },
  });

  async function onSubmit(values: CloseSleepInput) {
    const result = await closeSleepAction(sessionId, {
      started_at: new Date(values.started_at).toISOString(),
      ended_at: new Date(values.ended_at).toISOString(),
      quality: values.quality,
    });
    if (!result.ok) {
      toast.error(result.errors.root ?? 'No pudimos cerrar el sueño.');
      return;
    }
    toast.success('Listo, anotamos cuándo se despertó.');
    reset({
      started_at: isoToLocalInput(startedAt),
      ended_at: nowLocalISO(),
      quality: 'unknown',
    });
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={trigger} />
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 font-display text-2xl">
            <Sun className="size-5" aria-hidden />
            Se despertó
          </SheetTitle>
          <SheetDescription>
            Anotamos cuándo terminó este sueño. Por defecto va a "ahora", podés ajustarlo.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 px-4 pb-6 pt-2">
          <input type="hidden" {...register('started_at')} />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cs-end">Se despertó</Label>
            <Input
              id="cs-end"
              type="datetime-local"
              {...register('ended_at')}
              aria-invalid={!!errors.ended_at}
            />
            {errors.ended_at && (
              <p className="text-destructive text-sm">{errors.ended_at.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cs-quality">¿Cómo durmió?</Label>
            <Controller
              control={control}
              name="quality"
              render={({ field }) => (
                <Select value={field.value ?? 'unknown'} onValueChange={field.onChange}>
                  <SelectTrigger id="cs-quality">
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

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Guardando…
              </>
            ) : (
              'Listo, se despertó'
            )}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
