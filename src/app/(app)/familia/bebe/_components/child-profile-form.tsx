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
import { Textarea } from '@/components/ui/textarea';
import {
  type ChildProfileInput,
  bloodTypeEnum,
  childProfileSchema,
} from '@/lib/validators/child-profile';
import { zodResolver } from '@/lib/zod-compat';
import { Loader2, Save } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';

const BLOOD_TYPES = bloodTypeEnum.options;

interface ChildProfileFormProps {
  defaultValues?: Partial<ChildProfileInput>;
  submitLabel?: string;
  onSubmitAction(input: ChildProfileInput): Promise<{
    ok: boolean;
    errors?: Partial<Record<keyof ChildProfileInput | 'root', string>>;
  }>;
}

const FALLBACK_DEFAULTS: ChildProfileInput = {
  name: '',
  birth_date: '',
  birth_time: '',
  birth_place: '',
  pediatrician_name: '',
  pediatrician_phone: '',
  health_insurance: '',
  notes: '',
};

/**
 * Form de creación/edición del perfil del bebé.
 *
 * Los inputs numéricos (peso, talla, semanas) se manejan con valueAsNumber
 * de react-hook-form para que Zod los reciba como number sin tener que
 * convertir manualmente. Cuando el campo está vacío, RHF devuelve NaN; el
 * schema lo transforma a undefined.
 */
export function ChildProfileForm({
  defaultValues,
  submitLabel = 'Guardar',
  onSubmitAction,
}: ChildProfileFormProps) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChildProfileInput>({
    resolver: zodResolver(childProfileSchema),
    defaultValues: { ...FALLBACK_DEFAULTS, ...defaultValues },
  });

  async function onSubmit(values: ChildProfileInput) {
    const result = await onSubmitAction(values);
    if (!result.ok) {
      const message =
        result.errors?.root ??
        result.errors?.name ??
        'No pudimos guardar el perfil. Probá de nuevo.';
      toast.error(message);
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      aria-busy={isSubmitting}
      className="flex flex-col gap-8"
    >
      <fieldset className="flex flex-col gap-4" disabled={isSubmitting}>
        <legend className="font-medium text-base text-foreground">Identidad</legend>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cp-name">Nombre</Label>
          <Input
            id="cp-name"
            placeholder="Salustiano"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'cp-name-error' : undefined}
            {...register('name')}
          />
          {errors.name && (
            <p id="cp-name-error" className="text-destructive text-sm">
              {errors.name.message}
            </p>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cp-birth-date">Fecha de nacimiento</Label>
            <Input id="cp-birth-date" type="date" {...register('birth_date')} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cp-birth-time">Hora</Label>
            <Input id="cp-birth-time" type="time" {...register('birth_time')} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cp-birth-place">Lugar de nacimiento</Label>
          <Input
            id="cp-birth-place"
            placeholder="Sanatorio, ciudad…"
            {...register('birth_place')}
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4" disabled={isSubmitting}>
        <legend className="font-medium text-base text-foreground">Al nacer</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cp-weight">Peso (g)</Label>
            <Input
              id="cp-weight"
              type="number"
              inputMode="numeric"
              step="1"
              placeholder="3200"
              aria-invalid={!!errors.birth_weight_grams}
              {...register('birth_weight_grams', { valueAsNumber: true })}
            />
            {errors.birth_weight_grams && (
              <p className="text-destructive text-sm">{errors.birth_weight_grams.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cp-height">Talla (cm)</Label>
            <Input
              id="cp-height"
              type="number"
              inputMode="decimal"
              step="0.1"
              placeholder="50"
              aria-invalid={!!errors.birth_height_cm}
              {...register('birth_height_cm', { valueAsNumber: true })}
            />
            {errors.birth_height_cm && (
              <p className="text-destructive text-sm">{errors.birth_height_cm.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cp-gestational">Edad gestacional (sem)</Label>
            <Input
              id="cp-gestational"
              type="number"
              inputMode="numeric"
              step="1"
              placeholder="40"
              aria-invalid={!!errors.gestational_weeks_at_birth}
              {...register('gestational_weeks_at_birth', { valueAsNumber: true })}
            />
            {errors.gestational_weeks_at_birth && (
              <p className="text-destructive text-sm">
                {errors.gestational_weeks_at_birth.message}
              </p>
            )}
          </div>
        </div>
        <p className="text-muted-foreground text-xs">
          Si la edad gestacional es menor a 37 semanas, el sistema marca el perfil como prematuro
          automáticamente.
        </p>
      </fieldset>

      <fieldset className="flex flex-col gap-4" disabled={isSubmitting}>
        <legend className="font-medium text-base text-foreground">Salud</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cp-blood">Tipo de sangre</Label>
            <Controller
              control={control}
              name="blood_type"
              render={({ field }) => (
                <Select
                  value={field.value || undefined}
                  onValueChange={(v) => field.onChange(v || '')}
                >
                  <SelectTrigger id="cp-blood">
                    <SelectValue placeholder="Si lo sabés" />
                  </SelectTrigger>
                  <SelectContent>
                    {BLOOD_TYPES.map((bt) => (
                      <SelectItem key={bt} value={bt}>
                        {bt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cp-insurance">Obra social</Label>
            <Input
              id="cp-insurance"
              placeholder="Galeno, OSDE…"
              {...register('health_insurance')}
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cp-pediatrician-name">Pediatra</Label>
            <Input
              id="cp-pediatrician-name"
              placeholder="Dra. Romero"
              {...register('pediatrician_name')}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cp-pediatrician-phone">Teléfono pediatra</Label>
            <Input
              id="cp-pediatrician-phone"
              type="tel"
              placeholder="+54 9 ..."
              {...register('pediatrician_phone')}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cp-notes">Alergias y notas</Label>
          <Textarea
            id="cp-notes"
            rows={4}
            placeholder="Lo que te interese tener cerca: alergias conocidas, observaciones del control prenatal…"
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
