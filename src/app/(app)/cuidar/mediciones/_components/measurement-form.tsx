'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { type MeasurementInput, measurementSchema } from '@/lib/validators/measurement';
import { zodResolver } from '@/lib/zod-compat';
import { Loader2, Save } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

interface MeasurementFormProps {
  defaultValues?: Partial<MeasurementInput>;
  submitLabel?: string;
  onSubmitAction(input: MeasurementInput): Promise<{
    ok: boolean;
    errors?: Partial<Record<keyof MeasurementInput | 'root', string>>;
  }>;
}

function nowLocalISO(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

const FALLBACK_DEFAULTS: MeasurementInput = {
  measured_at: nowLocalISO(),
  notes: '',
};

export function MeasurementForm({
  defaultValues,
  submitLabel = 'Guardar',
  onSubmitAction,
}: MeasurementFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<MeasurementInput>({
    resolver: zodResolver(measurementSchema),
    defaultValues: { ...FALLBACK_DEFAULTS, ...defaultValues },
  });

  async function onSubmit(values: MeasurementInput) {
    const result = await onSubmitAction({
      ...values,
      measured_at: new Date(values.measured_at).toISOString(),
    });
    if (!result.ok) {
      const message =
        result.errors?.root ?? result.errors?.weight_grams ?? 'No pudimos guardar la medición.';
      toast.error(message);
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      aria-busy={isSubmitting}
      className="flex flex-col gap-6"
    >
      <fieldset className="flex flex-col gap-4" disabled={isSubmitting}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="m-at">Cuándo se midió</Label>
          <Input id="m-at" type="datetime-local" {...register('measured_at')} />
          {errors.measured_at && (
            <p className="text-destructive text-sm">{errors.measured_at.message}</p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="m-weight">Peso (g)</Label>
            <Input
              id="m-weight"
              type="number"
              inputMode="numeric"
              step="1"
              placeholder="3500"
              {...register('weight_grams', { valueAsNumber: true })}
            />
            {errors.weight_grams && (
              <p className="text-destructive text-sm">{errors.weight_grams.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="m-height">Talla (cm)</Label>
            <Input
              id="m-height"
              type="number"
              inputMode="decimal"
              step="0.1"
              placeholder="52"
              {...register('height_cm', { valueAsNumber: true })}
            />
            {errors.height_cm && (
              <p className="text-destructive text-sm">{errors.height_cm.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="m-head">Cabeza (cm)</Label>
            <Input
              id="m-head"
              type="number"
              inputMode="decimal"
              step="0.1"
              placeholder="36"
              {...register('head_circumference_cm', { valueAsNumber: true })}
            />
            {errors.head_circumference_cm && (
              <p className="text-destructive text-sm">{errors.head_circumference_cm.message}</p>
            )}
          </div>
        </div>
        <p className="text-muted-foreground text-xs">
          Cargá lo que te dieron en el control. Cualquiera de los tres alcanza para guardar la
          medición.
        </p>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="m-notes">Notas (opcional)</Label>
          <Textarea
            id="m-notes"
            rows={3}
            placeholder="Lo que te interese del control: percentil, observaciones del médico…"
            {...register('notes')}
          />
        </div>
      </fieldset>

      <Button type="submit" disabled={isSubmitting} className="self-stretch sm:self-start">
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Guardando…
          </>
        ) : (
          <>
            <Save className="size-4" aria-hidden />
            {submitLabel}
          </>
        )}
      </Button>
    </form>
  );
}
