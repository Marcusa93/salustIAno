'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { type MedicationDoseInput, medicationDoseSchema } from '@/lib/validators/medication';
import { zodResolver } from '@/lib/zod-compat';
import { Loader2, Save } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

interface MedicationFormProps {
  suggestions?: string[];
  defaultValues?: Partial<MedicationDoseInput>;
  submitLabel?: string;
  onSubmitAction(input: MedicationDoseInput): Promise<{
    ok: boolean;
    errors?: Partial<Record<keyof MedicationDoseInput | 'root', string>>;
  }>;
}

function nowLocalISO(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

const FALLBACK_DEFAULTS: MedicationDoseInput = {
  medication_name: '',
  given_at: nowLocalISO(),
};

export function MedicationForm({
  suggestions = [],
  defaultValues,
  submitLabel = 'Registrar dosis',
  onSubmitAction,
}: MedicationFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<MedicationDoseInput>({
    resolver: zodResolver(medicationDoseSchema),
    defaultValues: { ...FALLBACK_DEFAULTS, ...defaultValues },
  });

  async function onSubmit(values: MedicationDoseInput) {
    const result = await onSubmitAction({
      ...values,
      given_at: new Date(values.given_at).toISOString(),
    });
    if (!result.ok) {
      const message = result.errors?.root ?? result.errors?.medication_name ?? 'No pudimos guardar la dosis.';
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
          <Label htmlFor="med-name">Medicamento</Label>
          <Input
            id="med-name"
            type="text"
            placeholder="Thermofren, ibuprofeno…"
            list={suggestions.length > 0 ? 'med-suggestions' : undefined}
            autoComplete="off"
            {...register('medication_name')}
          />
          {suggestions.length > 0 && (
            <datalist id="med-suggestions">
              {suggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          )}
          {errors.medication_name && (
            <p className="text-destructive text-sm">{errors.medication_name.message}</p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="med-dose">Dosis (opcional)</Label>
            <Input
              id="med-dose"
              type="text"
              placeholder="0,5 ml · 10 mg · 1 gota"
              {...register('dose_amount')}
            />
            {errors.dose_amount && (
              <p className="text-destructive text-sm">{errors.dose_amount.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="med-interval">Cada cuántas horas (opcional)</Label>
            <Input
              id="med-interval"
              type="number"
              inputMode="decimal"
              step="0.5"
              min="1"
              max="72"
              placeholder="6 · 8 · 12"
              {...register('interval_hours', { valueAsNumber: true })}
            />
            {errors.interval_hours && (
              <p className="text-destructive text-sm">{errors.interval_hours.message}</p>
            )}
            <p className="text-muted-foreground text-xs">
              Calculamos cuándo toca la próxima dosis automáticamente.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="med-at">Cuándo se dio</Label>
          <Input id="med-at" type="datetime-local" {...register('given_at')} />
          {errors.given_at && (
            <p className="text-destructive text-sm">{errors.given_at.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="med-notes">Notas (opcional)</Label>
          <Textarea
            id="med-notes"
            rows={3}
            placeholder="Reacción, temperatura antes de dar, observaciones…"
            {...register('notes')}
          />
          {errors.notes && (
            <p className="text-destructive text-sm">{errors.notes.message}</p>
          )}
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
