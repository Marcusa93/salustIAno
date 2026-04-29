'use client';

import { createDiaperAction } from '@/app/(app)/cuidar/eventos/actions';
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
  diaperEventSchema,
  diaperTypeEnum,
} from '@/lib/validators/events';
import { zodResolver } from '@/lib/zod-compat';
import { Baby, Loader2 } from 'lucide-react';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';

const TYPES = diaperTypeEnum.options;

function nowLocalISO(): string {
  const d = new Date();
  // Format YYYY-MM-DDTHH:MM para input datetime-local.
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

interface DiaperQuickAddProps {
  trigger: ReactElement;
}

export function DiaperQuickAdd({ trigger }: DiaperQuickAddProps) {
  const [open, setOpen] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DiaperEventInput>({
    resolver: zodResolver(diaperEventSchema),
    defaultValues: {
      occurred_at: nowLocalISO(),
      type: 'wet',
      notes: '',
    },
  });

  async function onSubmit(values: DiaperEventInput) {
    const result = await createDiaperAction({
      ...values,
      occurred_at: new Date(values.occurred_at).toISOString(),
    });
    if (!result.ok) {
      toast.error(result.errors.root ?? 'No pudimos guardar el pañal.');
      return;
    }
    toast.success('Pañal anotado.');
    reset({ occurred_at: nowLocalISO(), type: 'wet', notes: '' });
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={trigger} />
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 font-display text-2xl">
            <Baby className="size-5" aria-hidden />
            Anotar pañal
          </SheetTitle>
          <SheetDescription>Pis, caca, ambos o seco. Tomate dos segundos.</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 px-4 pb-6 pt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="d-when">Cuándo</Label>
            <Input
              id="d-when"
              type="datetime-local"
              {...register('occurred_at')}
              aria-invalid={!!errors.occurred_at}
            />
            {errors.occurred_at && (
              <p className="text-destructive text-sm">{errors.occurred_at.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="d-type">Qué fue</Label>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="d-type">
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
            <Label htmlFor="d-notes">Notas (opcional)</Label>
            <Textarea
              id="d-notes"
              rows={2}
              placeholder="Color, consistencia, lo que quieras"
              {...register('notes')}
            />
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
