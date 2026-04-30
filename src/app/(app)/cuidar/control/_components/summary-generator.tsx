'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { PediatricSummary } from '@/lib/ai/agents';
import { cn } from '@/lib/utils';
import { Calendar, ClipboardCheck, Copy, Loader2, Sparkles } from 'lucide-react';
import { type ReactNode, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { generatePediatricSummaryAction } from '../actions';

const PERIODS = [
  { days: 7, label: '7 días' },
  { days: 14, label: '14 días' },
  { days: 30, label: '30 días' },
] as const;

export function SummaryGenerator() {
  const [days, setDays] = useState<7 | 14 | 30>(7);
  const [summary, setSummary] = useState<PediatricSummary | null>(null);
  const [pending, startTransition] = useTransition();

  function handleGenerate() {
    startTransition(async () => {
      const result = await generatePediatricSummaryAction(days);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setSummary(result.summary);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-2">
          <span className="font-medium text-foreground">¿Cuánto tiempo querés mirar?</span>
          <div className="flex flex-wrap gap-2">
            {PERIODS.map((p) => (
              <button
                key={p.days}
                type="button"
                onClick={() => setDays(p.days)}
                disabled={pending}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium text-sm transition-colors',
                  days === p.days
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground',
                )}
              >
                <Calendar className="size-3.5" aria-hidden />
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <Button type="button" onClick={handleGenerate} disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Armando borrador…
            </>
          ) : (
            <>
              <Sparkles className="size-4" aria-hidden />
              Generar borrador
            </>
          )}
        </Button>
        <p className="text-muted-foreground text-xs">
          Puede tardar unos segundos. SalustIA mira los datos del período y arma un resumen.
        </p>
      </Card>

      {summary && <SummaryView summary={summary} />}
    </div>
  );
}

function SummaryView({ summary }: { summary: PediatricSummary }) {
  function copyAsText() {
    const text = summaryAsPlainText(summary);
    navigator.clipboard.writeText(text).then(
      () => toast.success('Copiado al portapapeles.'),
      () => toast.error('No pudimos copiar. Intentá manualmente.'),
    );
  }

  return (
    <Card className="flex flex-col gap-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
            {summary.period_label}
          </span>
          <p className="font-medium text-foreground text-lg leading-snug">{summary.headline}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={copyAsText}>
          <Copy className="size-4" aria-hidden />
          Copiar
        </Button>
      </div>

      <Section title="Cómo viene la cosa">
        <dl className="grid gap-3 sm:grid-cols-2">
          <Metric label="Tomas" value={summary.metrics.feeding} />
          <Metric label="Sueño" value={summary.metrics.sleep} />
          <Metric label="Pañales" value={summary.metrics.diaper} />
          <Metric label="Mediciones" value={summary.metrics.measurement} />
        </dl>
      </Section>

      {summary.observations.length > 0 && (
        <Section title="Observaciones">
          <ul className="flex flex-col gap-1.5 text-foreground text-sm leading-relaxed">
            {summary.observations.map((o) => (
              <li key={o} className="flex gap-2">
                <span className="text-muted-foreground" aria-hidden>
                  •
                </span>
                <span>{o}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {summary.questions_for_pediatrician.length > 0 && (
        <Section title="Para preguntarle a la pediatra">
          <ul className="flex flex-col gap-1.5 text-foreground text-sm leading-relaxed">
            {summary.questions_for_pediatrician.map((q) => (
              <li key={q} className="flex gap-2">
                <ClipboardCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {summary.pending_milestones.length > 0 && (
        <Section title="Pendientes">
          <ul className="flex flex-col gap-1.5 text-foreground text-sm leading-relaxed">
            {summary.pending_milestones.map((m) => (
              <li key={m} className="flex gap-2">
                <Calendar className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <p className="border-border/60 border-t pt-4 text-muted-foreground text-xs italic leading-relaxed">
        Esto es un borrador armado a partir de lo que cargaron en Salu. No reemplaza la consulta con
        el pediatra ni interpreta los datos clínicamente. Llevalo como una guía para no olvidarse de
        nada en el control.
      </p>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-muted/30 p-3">
      <dt className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
        {label}
      </dt>
      <dd className="text-foreground text-sm">{value}</dd>
    </div>
  );
}

/**
 * Convierte el resumen estructurado a texto plano para copy-paste en
 * WhatsApp, mail al pediatra, o impresión. Usa saltos simples, sin
 * markdown, para máxima compatibilidad.
 */
export function summaryAsPlainText(s: PediatricSummary): string {
  const parts: string[] = [];
  parts.push(s.period_label.toUpperCase());
  parts.push('');
  parts.push(s.headline);
  parts.push('');
  parts.push('CÓMO VIENE LA COSA');
  parts.push(`Tomas: ${s.metrics.feeding}`);
  parts.push(`Sueño: ${s.metrics.sleep}`);
  parts.push(`Pañales: ${s.metrics.diaper}`);
  parts.push(`Mediciones: ${s.metrics.measurement}`);
  if (s.observations.length > 0) {
    parts.push('');
    parts.push('OBSERVACIONES');
    for (const o of s.observations) parts.push(`• ${o}`);
  }
  if (s.questions_for_pediatrician.length > 0) {
    parts.push('');
    parts.push('PARA PREGUNTARLE A LA PEDIATRA');
    for (const q of s.questions_for_pediatrician) parts.push(`• ${q}`);
  }
  if (s.pending_milestones.length > 0) {
    parts.push('');
    parts.push('PENDIENTES');
    for (const m of s.pending_milestones) parts.push(`• ${m}`);
  }
  parts.push('');
  parts.push('— Borrador generado por SalustIA. No reemplaza la consulta con el pediatra.');
  return parts.join('\n');
}
