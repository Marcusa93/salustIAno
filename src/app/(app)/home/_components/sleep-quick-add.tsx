'use client';

import { createSleepAction } from '@/app/(app)/cuidar/eventos/actions';
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

const QUALITIES = sleepQualityEnum.options;

function nowLocalISO(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

interface SleepQuickAddProps {
  trigger: ReactElement;
}

export function SleepQuickAdd({ trigger }: SleepQuickAddProps) {
  const [open, setOpen] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SleepSessionInput>({
    resolver: zodResolver(sleepSessionSchema),
    defaultValues: {
      started_at: nowLocalISO(),
      ended_at: '',
      quality: 'unknown',
      is_nap: false,
      notes: '',
    },
  });

  async function onSubmit(values: SleepSessionInput) {
    const result = await createSleepAction({
      ...values,
      started_at: new Date(values.started_at).toISOString(),
      ended_at: values.ended_at ? new Date(values.ended_at).toISOString() : '',
    });
    if (!result.ok) {
      toast.error(result.errors.root ?? 'No pudimos guardar el sueño.');
      return;
    }
    toast.success('Sueño anotado.');
    reset({
      started_at: nowLocalISO(),
      ended_at: '',
      quality: 'unknown',
      is_nap: false,
      notes: '',
    });
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
            <Moon className="size-5" aria-hidden />
            Anotar sueño
          </SheetTitle>
          <SheetDescription>
            Cargalo cuando termina la siesta o el sueño largo. Si todavía está durmiendo, dejá el
            final en blanco.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 px-4 pb-6 pt-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="s-start">Empezó</Label>
              <Input
                id="s-start"
                type="datetime-local"
                {...register('started_at')}
                aria-invalid={!!errors.started_at}
              />
              {errors.started_at && (
                <p className="text-destructive text-sm">{errors.started_at.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="s-end">Terminó (opcional)</Label>
              <Input
                id="s-end"
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
            <Label htmlFor="s-quality">¿Cómo durmió?</Label>
            <Controller
              control={control}
              name="quality"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="s-quality">
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
            <Label htmlFor="s-notes">Notas (opcional)</Label>
            <Textarea id="s-notes" rows={2} {...register('notes')} />
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
