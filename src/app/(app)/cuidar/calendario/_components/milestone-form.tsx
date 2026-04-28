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
  MILESTONE_CATEGORY_LABELS,
  type MilestoneCreateInput,
  milestoneCategoryEnum,
  milestoneCreateSchema,
} from '@/lib/validators/milestone';
import { zodResolver } from '@/lib/zod-compat';
import { Loader2, Save } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';

const CATEGORIES = milestoneCategoryEnum.options;

interface MilestoneFormProps {
  defaultValues?: Partial<MilestoneCreateInput>;
  submitLabel?: string;
  onSubmitAction(input: MilestoneCreateInput): Promise<{
    ok: boolean;
    errors?: Partial<Record<keyof MilestoneCreateInput | 'root', string>>;
  }>;
}

const FALLBACK_DEFAULTS: MilestoneCreateInput = {
  title: '',
  category: 'control_pediatrico',
  description: '',
  due_at: '',
  notes: '',
};

/**
 * Form reutilizable para crear o editar un hito médico. Mismo patrón que
 * `CareGuideForm` — el server hace `redirect()` en éxito, así que la
 * promesa de `onSubmitAction` solo resuelve con `ok: false` cuando algo
 * falló.
 */
export function MilestoneForm({
  defaultValues,
  submitLabel = 'Guardar',
  onSubmitAction,
}: MilestoneFormProps) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<MilestoneCreateInput>({
    resolver: zodResolver(milestoneCreateSchema),
    defaultValues: { ...FALLBACK_DEFAULTS, ...defaultValues },
  });

  async function onSubmit(values: MilestoneCreateInput) {
    const result = await onSubmitAction(values);
    if (!result.ok) {
      const message =
        result.errors?.root ??
        result.errors?.title ??
        result.errors?.due_at ??
        'No pudimos guardar el hito. Probá de nuevo.';
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
          <Label htmlFor="m-title">Título</Label>
          <Input
            id="m-title"
            placeholder="Por ejemplo: Pesquisa neonatal"
            aria-invalid={!!errors.title}
            aria-describedby={errors.title ? 'm-title-error' : undefined}
            {...register('title')}
          />
          {errors.title && (
            <p id="m-title-error" className="text-destructive text-sm">
              {errors.title.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="m-category">Categoría</Label>
          <Controller
            control={control}
            name="category"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="m-category">
                  <SelectValue placeholder="Elegí una categoría" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {MILESTONE_CATEGORY_LABELS[cat]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="m-due-at">Fecha</Label>
          <Input
            id="m-due-at"
            type="date"
            aria-describedby="m-due-hint"
            aria-invalid={!!errors.due_at}
            {...register('due_at')}
          />
          <p id="m-due-hint" className="text-muted-foreground text-xs">
            Cuándo está programado. Si todavía no sabés la fecha exacta, dejalo en blanco.
          </p>
          {errors.due_at && <p className="text-destructive text-sm">{errors.due_at.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="m-description">¿Qué es? (opcional)</Label>
          <Textarea
            id="m-description"
            rows={4}
            placeholder="Una descripción corta del estudio: qué hace, dónde, qué llevar."
            {...register('description')}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="m-notes">Notas (opcional)</Label>
          <Textarea
            id="m-notes"
            rows={4}
            placeholder="Lo que vayas anotando: resultado, próximos pasos, médico que lo hizo."
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
