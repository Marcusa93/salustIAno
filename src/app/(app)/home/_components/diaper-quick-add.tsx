'use client';

import { createDiaperAction, uploadDiaperPhotoAction } from '@/app/(app)/cuidar/eventos/actions';
import {
  DiaperPhotoAnalyzer,
  analysisToNoteText,
} from '@/app/(app)/cuidar/panal-foto/_components/diaper-photo-analyzer';
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
import type { DiaperAnalysis } from '@/lib/ai/agents';
import {
  DIAPER_TYPE_LABELS,
  type DiaperEventInput,
  diaperEventSchema,
  diaperTypeEnum,
} from '@/lib/validators/events';
import { zodResolver } from '@/lib/zod-compat';
import { Baby, Camera, ChevronDown, Loader2 } from 'lucide-react';
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
  const [photoOpen, setPhotoOpen] = useState(false);
  const [analysis, setAnalysis] = useState<DiaperAnalysis | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
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
    // Si la familia adjuntó foto y la usó para análisis, primero la subimos
    // a storage y obtenemos el path. Si falla el upload, NO bloqueamos el
    // guardado del evento — guardamos sin foto y avisamos.
    let photoPath: string | undefined;
    if (photoFile) {
      const fd = new FormData();
      fd.append('photo', photoFile);
      const upload = await uploadDiaperPhotoAction(fd);
      if (upload.ok) {
        photoPath = upload.path;
      } else {
        toast.error(`Foto no subida (${upload.error}). Guardamos el pañal sin foto.`);
      }
    }

    const result = await createDiaperAction({
      ...values,
      occurred_at: new Date(values.occurred_at).toISOString(),
      photo_analysis: analysis ?? undefined,
      photo_path: photoPath,
    });
    if (!result.ok) {
      toast.error(result.errors.root ?? 'No pudimos guardar el pañal.');
      return;
    }
    toast.success('Pañal anotado.');
    reset({ occurred_at: nowLocalISO(), type: 'wet', notes: '' });
    setAnalysis(null);
    setPhotoFile(null);
    setPhotoOpen(false);
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

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setPhotoOpen((v) => !v)}
              className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50"
              aria-expanded={photoOpen}
              aria-controls="d-photo-section"
            >
              <span className="inline-flex items-center gap-2 font-medium text-foreground">
                <Camera className="size-4 text-primary" aria-hidden />
                Sumar foto (opcional)
              </span>
              <ChevronDown
                className={`size-4 text-muted-foreground transition-transform ${photoOpen ? 'rotate-180' : ''}`}
                aria-hidden
              />
            </button>
            {photoOpen && (
              <div
                id="d-photo-section"
                className="rounded-lg border border-border/60 bg-muted/20 p-3"
              >
                <DiaperPhotoAnalyzer
                  compact
                  onUseAnalysis={(a, f) => {
                    setAnalysis(a);
                    setPhotoFile(f);
                    setValue('notes', analysisToNoteText(a), {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                  }}
                />
              </div>
            )}
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
