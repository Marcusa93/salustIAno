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
  NOTE_CATEGORY_DESCRIPTIONS,
  NOTE_CATEGORY_LABELS,
  type NoteInput,
  noteCategoryEnum,
  noteSchema,
} from '@/lib/validators/note';
import { zodResolver } from '@/lib/zod-compat';
import { Loader2, Save } from 'lucide-react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';

const CATEGORIES = noteCategoryEnum.options;

interface NoteFormProps {
  defaultValues?: Partial<NoteInput>;
  submitLabel?: string;
  onSubmitAction(input: NoteInput): Promise<{
    ok: boolean;
    errors?: Partial<Record<keyof NoteInput | 'root', string>>;
  }>;
}

function nowLocalISO(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

const FALLBACK_DEFAULTS: NoteInput = {
  occurred_at: nowLocalISO(),
  category: 'memory',
  content: '',
};

export function NoteForm({
  defaultValues,
  submitLabel = 'Guardar',
  onSubmitAction,
}: NoteFormProps) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NoteInput>({
    resolver: zodResolver(noteSchema),
    defaultValues: { ...FALLBACK_DEFAULTS, ...defaultValues },
  });

  const watchedCategory = useWatch({ control, name: 'category' });

  async function onSubmit(values: NoteInput) {
    const result = await onSubmitAction({
      ...values,
      occurred_at: new Date(values.occurred_at).toISOString(),
    });
    if (!result.ok) {
      const message =
        result.errors?.root ?? result.errors?.content ?? 'No pudimos guardar la nota.';
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
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="n-when">Cuándo</Label>
            <Input id="n-when" type="datetime-local" {...register('occurred_at')} />
            {errors.occurred_at && (
              <p className="text-destructive text-sm">{errors.occurred_at.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="n-category">Categoría</Label>
            <Controller
              control={control}
              name="category"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="n-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {NOTE_CATEGORY_LABELS[cat]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-muted-foreground text-xs">
              {NOTE_CATEGORY_DESCRIPTIONS[watchedCategory ?? 'memory']}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="n-content">El momento</Label>
          <Textarea
            id="n-content"
            rows={10}
            placeholder="Escribilo como te salga. Esto es para vos y la familia, después."
            aria-invalid={!!errors.content}
            {...register('content')}
          />
          {errors.content && <p className="text-destructive text-sm">{errors.content.message}</p>}
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
