'use client';

import { cn } from '@/lib/utils';
import { motion } from 'motion/react';

interface SleepSession {
  started_at: string;
  ended_at: string | null;
  is_nap: boolean;
}

interface Props {
  sessions: SleepSession[];
  totalMinutes: number;
  className?: string;
}

const AR_TZ = 'America/Argentina/Buenos_Aires';
const TOTAL_MINUTES = 24 * 60;
const HOUR_TICKS = [0, 6, 12, 18, 24];

function toArMinutes(isoUtc: string): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: AR_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(isoUtc));
  const h = Number.parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const m = Number.parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
  return (h % 24) * 60 + m;
}

function nowArMinutes(): number {
  return toArMinutes(new Date().toISOString());
}

function hoursLabel(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

interface Block {
  leftPct: number;
  widthPct: number;
  isNap: boolean;
  ongoing: boolean;
}

export function SleepTimeline({ sessions, totalMinutes, className }: Props) {
  const nowMin = nowArMinutes();

  const blocks: Block[] = sessions
    .filter((s) => s.started_at)
    .map((s) => {
      const start = toArMinutes(s.started_at);
      const end = s.ended_at ? toArMinutes(s.ended_at) : nowMin;
      const raw = end - start;
      // Maneja sesiones que cruzan la medianoche (e.g. 23:00 → 01:00 no aplica
      // porque solo traemos sesiones que arrancan hoy, pero si ended_at < started_at
      // en minutos locales, sumamos 1440.
      const durMin = raw >= 0 ? raw : raw + TOTAL_MINUTES;
      return {
        leftPct: (start / TOTAL_MINUTES) * 100,
        widthPct: Math.max(0.5, (durMin / TOTAL_MINUTES) * 100),
        isNap: s.is_nap,
        ongoing: s.ended_at === null,
      };
    });

  const nowPct = (nowMin / TOTAL_MINUTES) * 100;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between">
        <span className="font-medium text-[10.5px] text-muted-foreground uppercase tracking-[0.18em]">
          Sueño de hoy
        </span>
        {totalMinutes > 0 && (
          <span className="font-mono text-[11px] text-muted-foreground">
            {hoursLabel(totalMinutes)}
          </span>
        )}
      </div>

      {/* Timeline bar */}
      <div className="relative h-8 overflow-hidden rounded-xl bg-muted/30">
        {/* Bloques de sueño */}
        {blocks.map((b, i) => (
          <motion.div
            key={i}
            className={cn(
              'absolute top-1 h-6 rounded-lg',
              b.isNap ? 'bg-[var(--chart-2)]/50' : 'bg-[var(--chart-2)]',
              b.ongoing && 'animate-pulse',
            )}
            style={{ left: `${b.leftPct}%` }}
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: `${b.widthPct}%`, opacity: 1 }}
            transition={{
              duration: 0.7,
              delay: i * 0.12,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
          />
        ))}

        {/* Marcador "ahora" */}
        <motion.div
          className="absolute top-0 h-full w-[2px] bg-primary/40"
          style={{ left: `${nowPct}%` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.3 }}
        />
      </div>

      {/* Eje de horas */}
      <div className="relative h-3">
        {HOUR_TICKS.map((h) => (
          <span
            key={h}
            className={cn(
              'absolute -translate-x-1/2 font-mono text-[9px] text-muted-foreground/60 tabular-nums',
              h === 24 && 'translate-x-[-100%]',
            )}
            style={{ left: h === 24 ? '100%' : `${(h / 24) * 100}%` }}
          >
            {String(h % 24).padStart(2, '0')}h
          </span>
        ))}
      </div>

      {sessions.length === 0 && (
        <p className="text-[11px] text-muted-foreground/60">
          Todavía no hay sueños registrados hoy.
        </p>
      )}
    </div>
  );
}
