import { DailyDoseButton } from '@/components/salu/daily-dose-button';
import { Card } from '@/components/ui/card';
import { formatTimeAr } from '@/lib/format-ar';
import { cn } from '@/lib/utils';
import { Check, Pill } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';

export interface DailyMedItem {
  name: string;
  doseAmount: string | null;
  latestDoseId: string;
  dayNumber: number;
  /** Dosis de hoy (la última), o null si todavía falta. */
  givenToday: { at: string; by: string | null; count: number } | null;
}

/**
 * "Remedios de hoy" en /home: para los tratamientos de todos los días
 * (hierro, vitamina D…) muestra si hoy ya se dio y quién lo dio, con un
 * botón para anotarlo si falta.
 */
export function DailyMedsCard({ items }: { items: DailyMedItem[] }) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby="remedios-hoy">
      <div className="flex items-baseline justify-between gap-2 px-1">
        <h2
          id="remedios-hoy"
          className="font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.22em]"
        >
          Remedios de hoy
        </h2>
        <Link
          href={'/cuidar/medicamentos' as Route}
          className="font-medium text-primary text-sm hover:underline"
        >
          Ver
        </Link>
      </div>
      <Card className="gap-0 py-0">
        <ul className="divide-y divide-border/60">
          {items.map((item) => {
            const given = item.givenToday;
            return (
              <li key={item.latestDoseId} className="flex items-center gap-3 px-4 py-3">
                <span
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-full',
                    given
                      ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                      : 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
                  )}
                >
                  {given ? (
                    <Check className="size-4" aria-hidden />
                  ) : (
                    <Pill className="size-4" aria-hidden />
                  )}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate font-medium text-foreground text-sm">
                    {item.name}
                    {item.doseAmount && (
                      <span className="ml-1.5 font-normal text-muted-foreground">
                        {item.doseAmount}
                      </span>
                    )}
                  </span>
                  <span
                    className={cn(
                      'text-xs',
                      given ? 'text-muted-foreground' : 'text-amber-700 dark:text-amber-400',
                    )}
                  >
                    {given
                      ? `Dado a las ${formatTimeAr(given.at)}${given.by ? ` · ${given.by}` : ''}${
                          given.count > 1 ? ` · ${given.count} veces hoy` : ''
                        }`
                      : `Falta hoy · día ${item.dayNumber}`}
                  </span>
                </div>
                {!given && (
                  <DailyDoseButton doseId={item.latestDoseId} medicationName={item.name} />
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </section>
  );
}
