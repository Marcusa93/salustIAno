'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { PediatricSummary } from '@/lib/ai/agents';
import { cn } from '@/lib/utils';
import {
  Calendar,
  ClipboardCheck,
  Copy,
  History,
  Loader2,
  Printer,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { type ReactNode, useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  type PediatricSummaryEntry,
  deletePediatricSummaryAction,
  generatePediatricSummaryAction,
  listPediatricSummariesAction,
} from '../actions';

const PERIODS = [
  { days: 7, label: '7 días' },
  { days: 14, label: '14 días' },
  { days: 30, label: '30 días' },
] as const;

export function SummaryGenerator() {
  const [days, setDays] = useState<7 | 14 | 30>(7);
  const [summary, setSummary] = useState<PediatricSummary | null>(null);
  const [pending, startTransition] = useTransition();
  const [history, setHistory] = useState<PediatricSummaryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  function handleGenerate() {
    startTransition(async () => {
      const result = await generatePediatricSummaryAction(days);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setSummary(result.summary);
      // Invalidate history para que se recargue al abrir.
      setHistoryLoaded(false);
    });
  }

  // Lazy-load del histórico la primera vez que se abre el panel.
  useEffect(() => {
    if (!historyOpen || historyLoaded) return;
    listPediatricSummariesAction().then((rows) => {
      setHistory(rows);
      setHistoryLoaded(true);
    });
  }, [historyOpen, historyLoaded]);

  function handleViewHistorySummary(entry: PediatricSummaryEntry) {
    // Reconstruimos el shape PediatricSummary desde la fila persistida.
    setSummary({
      period_label: entry.periodLabel,
      headline: entry.headline,
      metrics: entry.metrics,
      observations: entry.observations,
      questions_for_pediatrician: entry.questions,
      pending_milestones: entry.pendingMilestones,
    });
    // Scroll to top of summary
    requestAnimationFrame(() => {
      document.querySelector('[data-summary-view]')?.scrollIntoView({ behavior: 'smooth' });
    });
  }

  function handleDeleteHistory(id: string) {
    if (!window.confirm('¿Borrar este borrador del histórico?')) return;
    void deletePediatricSummaryAction(id).then((r) => {
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setHistory((prev) => prev.filter((x) => x.id !== id));
      toast.success('Borrador eliminado.');
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-4 p-5 print:hidden">
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

      {/* Borradores anteriores (lazy-load on expand). */}
      <Card className="flex flex-col gap-3 p-4 print:hidden">
        <button
          type="button"
          onClick={() => setHistoryOpen((v) => !v)}
          className="flex items-center gap-2 text-left font-medium text-foreground text-sm outline-none transition-colors hover:text-primary"
        >
          <History className="size-4" aria-hidden />
          Borradores anteriores
          <span className="ml-auto text-muted-foreground text-xs">
            {historyOpen ? 'Ocultar' : 'Ver'}
          </span>
        </button>

        {historyOpen && (
          <div className="flex flex-col gap-2">
            {!historyLoaded ? (
              <div className="flex items-center gap-2 py-2 text-muted-foreground text-sm">
                <Loader2 className="size-4 animate-spin" aria-hidden /> Cargando…
              </div>
            ) : history.length === 0 ? (
              <p className="py-2 text-muted-foreground text-sm">
                Todavía no generaste ningún borrador.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {history.map((entry) => (
                  <li key={entry.id}>
                    <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/40 p-3">
                      <div className="flex flex-1 flex-col gap-0.5">
                        <span className="font-medium text-foreground text-sm">
                          {entry.periodLabel}
                        </span>
                        <span className="line-clamp-1 text-muted-foreground text-xs">
                          {entry.headline}
                        </span>
                        <span className="text-muted-foreground/70 text-[11px]">
                          {new Date(entry.createdAt).toLocaleString('es-AR', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        onClick={() => handleViewHistorySummary(entry)}
                      >
                        Ver
                      </Button>
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        onClick={() => handleDeleteHistory(entry.id)}
                        aria-label="Borrar"
                      >
                        <Trash2 className="size-3" aria-hidden />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>
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

  function handlePrint() {
    // Tailwind's `print:` modifiers ocultan nav/sidebar/footer; la hoja de
    // print en globals.css fuerza fondo blanco. El user obtiene un PDF
    // limpio sin tocar más layout.
    window.print();
  }

  return (
    <Card data-summary-view className="flex flex-col gap-5 p-6 print:border-none print:shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex flex-col gap-1">
          <span className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
            {summary.period_label}
          </span>
          <p className="font-medium text-foreground text-lg leading-snug">{summary.headline}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={copyAsText}>
            <Copy className="size-4" aria-hidden />
            Copiar
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="size-4" aria-hidden />
            Imprimir / PDF
          </Button>
        </div>
      </div>

      {/* Header alternativo solo para print: hereda paleta sobria. */}
      <div className="hidden print:flex print:flex-col print:gap-1">
        <span className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
          {summary.period_label}
        </span>
        <p className="font-semibold text-foreground text-xl leading-snug">{summary.headline}</p>
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
