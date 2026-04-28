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
  CARE_GUIDE_CATEGORY_LABELS,
  type CareGuideCreateInput,
  careGuideCategoryEnum,
  careGuideCreateSchema,
} from '@/lib/validators/care-guide';
import { zodResolver } from '@/lib/zod-compat';
import { Loader2, Save } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';

const CATEGORIES = careGuideCategoryEnum.options;

interface CareGuideFormProps {
  defaultValues?: Partial<CareGuideCreateInput>;
  submitLabel?: string;
  onSubmitAction(input: CareGuideCreateInput): Promise<{
    ok: boolean;
    errors?: Partial<Record<keyof CareGuideCreateInput | 'root', string>>;
  }>;
}

const FALLBACK_DEFAULTS: CareGuideCreateInput = {
  title: '',
  category: 'otros',
  content: '',
  source: '',
};

/**
 * Formulario reutilizable para crear o editar una `care_guide`.
 *
 * En éxito el server hace `redirect()`, así que la promise nunca resuelve
 * con `ok: true` (la navegación ya ocurrió). Si vuelve `ok: false`,
 * mostramos el toast y dejamos el form intacto para reintento.
 */
export function CareGuideForm({
  defaultValues,
  submitLabel = 'Guardar',
  onSubmitAction,
}: CareGuideFormProps) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CareGuideCreateInput>({
    resolver: zodResolver(careGuideCreateSchema),
    defaultValues: { ...FALLBACK_DEFAULTS, ...defaultValues },
  });

  async function onSubmit(values: CareGuideCreateInput) {
    const result = await onSubmitAction(values);
    if (!result.ok) {
      const message =
        result.errors?.root ??
        result.errors?.title ??
        result.errors?.content ??
        'No pudimos guardar la entrada. Probá de nuevo.';
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
          <Label htmlFor="care-title">Título</Label>
          <Input
            id="care-title"
            placeholder="Por ejemplo: Sueño seguro"
            aria-invalid={!!errors.title}
            aria-describedby={errors.title ? 'care-title-error' : undefined}
            {...register('title')}
          />
          {errors.title && (
            <p id="care-title-error" className="text-destructive text-sm">
              {errors.title.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="care-category">Categoría</Label>
          <Controller
            control={control}
            name="category"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="care-category">
                  <SelectValue placeholder="Elegí una categoría" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {CARE_GUIDE_CATEGORY_LABELS[cat]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="care-source">Fuente (opcional)</Label>
          <Input
            id="care-source"
            placeholder="Pediatra Dra. Romero, mamá, abuela…"
            aria-invalid={!!errors.source}
            aria-describedby={errors.source ? 'care-source-error' : undefined}
            {...register('source')}
          />
          {errors.source && (
            <p id="care-source-error" className="text-destructive text-sm">
              {errors.source.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="care-content">Contenido</Label>
          <Textarea
            id="care-content"
            rows={10}
            placeholder="Escribí lo que quieras recordar. Saltos de línea preservados."
            aria-invalid={!!errors.content}
            aria-describedby={errors.content ? 'care-content-error' : undefined}
            {...register('content')}
          />
          {errors.content && (
            <p id="care-content-error" className="text-destructive text-sm">
              {errors.content.message}
            </p>
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
