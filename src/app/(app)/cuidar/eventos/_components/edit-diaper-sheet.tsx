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
  DIAPER_TYPE_LABELS,
  type DiaperEventInput,
  type DiaperPhotoAnalysis,
  type DiaperType,
  diaperEventSchema,
  diaperTypeEnum,
} from '@/lib/validators/events';
import { zodResolver } from '@/lib/zod-compat';
import { Baby, Loader2 } from 'lucide-react';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { updateDiaperAction } from '../actions';

const TYPES = diaperTypeEnum.options;

function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

interface EditDiaperSheetProps {
  eventId: string;
  initial: {
    occurred_at: string;
    type: DiaperType;
    notes: string | null;
    photo_analysis: DiaperPhotoAnalysis | null;
  };
  trigger: ReactElement;
}

export function EditDiaperSheet({ eventId, initial, trigger }: EditDiaperSheetProps) {
  const [open, setOpen] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DiaperEventInput>({
    resolver: zodResolver(diaperEventSchema),
    defaultValues: {
      occurred_at: isoToLocalInput(initial.occurred_at),
      type: initial.type,
      notes: initial.notes ?? '',
      photo_analysis: initial.photo_analysis ?? null,
    },
  });

  async function onSubmit(values: DiaperEventInput) {
    const result = await updateDiaperAction(eventId, {
      ...values,
      occurred_at: new Date(values.occurred_at).toISOString(),
      // Preservamos el análisis actual — no se edita desde acá.
      photo_analysis: initial.photo_analysis ?? undefined,
    });
    if (!result.ok) {
      toast.error(result.errors.root ?? 'No pudimos actualizar el pañal.');
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
            <Baby className="size-5" aria-hidden />
            Editar pañal
          </SheetTitle>
          <SheetDescription>
            Ajustá lo que cambió. El análisis de la foto se conserva.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 px-4 pb-6 pt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ed-when">Cuándo</Label>
            <Input
              id="ed-when"
              type="datetime-local"
              {...register('occurred_at')}
              aria-invalid={!!errors.occurred_at}
            />
            {errors.occurred_at && (
              <p className="text-destructive text-sm">{errors.occurred_at.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ed-type">Qué fue</Label>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="ed-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {DIAPER_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ed-notes">Notas</Label>
            <Textarea id="ed-notes" rows={2} {...register('notes')} />
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
