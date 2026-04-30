'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { DiaperAnalysis } from '@/lib/ai/agents';
import { AlertTriangle, Camera, Loader2, X } from 'lucide-react';
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useRef,
  useState,
  useTransition,
} from 'react';
import { toast } from 'sonner';
import { analyzeDiaperPhotoAction } from '../actions';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp';

export function DiaperPhotoForm() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [analysis, setAnalysis] = useState<DiaperAnalysis | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Limpia el objectURL cuando el preview cambia o el componente se desmonta.
  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    if (!selected) {
      setFile(null);
      setPreview(null);
      return;
    }
    if (selected.size > MAX_BYTES) {
      toast.error('La foto no puede pesar más de 5 MB.');
      e.target.value = '';
      return;
    }
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setAnalysis(null);
  }

  function clearFile() {
    setFile(null);
    setPreview(null);
    setAnalysis(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) {
      toast.error('Adjuntá una foto antes de analizar.');
      return;
    }
    const fd = new FormData();
    fd.append('photo', file);
    if (notes.trim().length > 0) fd.append('notes', notes.trim());

    startTransition(async () => {
      const result = await analyzeDiaperPhotoAction(fd);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setAnalysis(result.analysis);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="photo">Foto del pañal</Label>
          <Input
            ref={fileInputRef}
            id="photo"
            type="file"
            accept={ACCEPT}
            onChange={handleFileChange}
            disabled={pending}
          />
          <p className="text-muted-foreground text-xs">JPG, PNG o WEBP. Hasta 5 MB.</p>
        </div>

        {preview && (
          <Card className="relative overflow-hidden p-2">
            <button
              type="button"
              onClick={clearFile}
              className="absolute top-3 right-3 z-10 inline-flex size-7 items-center justify-center rounded-full bg-background/80 text-foreground shadow hover:bg-background"
              aria-label="Quitar foto"
            >
              <X className="size-4" aria-hidden />
            </button>
            <img
              src={preview}
              alt="Vista previa del pañal"
              className="max-h-80 w-full rounded-md object-contain"
            />
          </Card>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="notes">Contexto (opcional)</Label>
          <Textarea
            id="notes"
            rows={2}
            placeholder="Lo que quieras agregar: edad, si cambió la dieta, si vino con olor distinto…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={pending}
            maxLength={500}
          />
        </div>

        <Button type="submit" disabled={!file || pending}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Analizando…
            </>
          ) : (
            <>
              <Camera className="size-4" aria-hidden />
              Analizar
            </>
          )}
        </Button>
      </form>

      {analysis && <AnalysisCard analysis={analysis} />}
    </div>
  );
}

function AnalysisCard({ analysis }: { analysis: DiaperAnalysis }) {
  return (
    <Card
      className={
        analysis.alarm
          ? 'flex flex-col gap-4 border-destructive/40 bg-destructive/5 p-5'
          : 'flex flex-col gap-4 p-5'
      }
    >
      {analysis.alarm && (
        <div className="flex items-start gap-2 text-destructive">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="flex flex-col gap-1">
            <span className="font-medium">Para mostrarle al pediatra</span>
            {analysis.alarm_reason && <span className="text-sm">{analysis.alarm_reason}</span>}
          </div>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-0.5">
          <dt className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
            Color
          </dt>
          <dd className="font-medium text-foreground">{analysis.color}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
            Consistencia
          </dt>
          <dd className="font-medium text-foreground">{analysis.consistency}</dd>
        </div>
      </dl>

      <div className="flex flex-col gap-1">
        <span className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
          Observaciones
        </span>
        <p className="text-foreground text-sm leading-relaxed">{analysis.observations}</p>
      </div>

      <div className="flex flex-col gap-1 border-border/60 border-t pt-3">
        <span className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
          Sugerencia
        </span>
        <p className="text-foreground text-sm leading-relaxed">{analysis.recommendation}</p>
      </div>

      <p className="text-muted-foreground text-xs italic leading-relaxed">
        Esto es solo una descripción de lo que se ve en la foto. No es un diagnóstico ni reemplaza
        al pediatra. Ante cualquier duda, consultá con tu profesional.
      </p>
    </Card>
  );
}
