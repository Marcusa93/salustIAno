'use client';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Baby, BellRing, CalendarClock, Loader2, Milk, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  type NotificationPrefs,
  loadNotificationPrefsAction,
  setNotificationPrefAction,
} from '../notification-prefs-actions';

interface PrefRow {
  key: keyof NotificationPrefs;
  Icon: LucideIcon;
  label: string;
  description: string;
  badge?: string;
}

const ROWS: ReadonlyArray<PrefRow> = [
  {
    key: 'controls',
    Icon: CalendarClock,
    label: 'Controles próximos',
    description: 'Te avisamos 24h antes de un control, vacuna o estudio.',
  },
  {
    key: 'feeding_overdue',
    Icon: Milk,
    label: 'Toma sin anotar',
    description: 'Si pasaron 4h+ desde la última toma cargada, te tocamos el hombro.',
  },
  {
    key: 'feeding_predicted',
    Icon: Milk,
    label: 'Próxima toma estimada',
    description: 'Estimación a partir del ritmo de los últimos 7 días — te aviso ~15 min antes.',
    badge: 'IA',
  },
  {
    key: 'diaper_predicted',
    Icon: Baby,
    label: 'Próximo pañal estimado',
    description: 'Lo mismo para pañales. Más laxo — los pañales son menos predictivos.',
    badge: 'IA',
  },
];

/**
 * UI para activar/desactivar cada tipo de notificación push. Lee las
 * prefs del usuario al montar y persiste cada toggle por separado vía
 * server action.
 *
 * Las dos predictivas están OFF por default — son opt-in para que la
 * familia decida si las quiere. Las "tradicionales" (controles + toma
 * vencida) están ON por default.
 */
export function NotificationPrefsCard() {
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [pendingKey, setPendingKey] = useState<keyof NotificationPrefs | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void loadNotificationPrefsAction().then((p) => {
      if (!cancelled) setPrefs(p);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggle(key: keyof NotificationPrefs) {
    if (!prefs) return;
    const current = prefs[key];
    // Optimistic update.
    setPrefs((p) => (p ? { ...p, [key]: !current } : p));
    setPendingKey(key);

    startTransition(async () => {
      const result = await setNotificationPrefAction(key, !current);
      setPendingKey(null);
      if (!result.ok) {
        toast.error(result.error);
        // Revertimos.
        setPrefs((p) => (p ? { ...p, [key]: current } : p));
        return;
      }
      setPrefs(result.prefs);
    });
  }

  return (
    <Card className="flex flex-col gap-3 border-border/60 p-5">
      <header className="flex items-center gap-2">
        <BellRing className="size-4 text-primary" aria-hidden />
        <h2 className="font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.18em]">
          Notificaciones push
        </h2>
      </header>
      <p className="text-muted-foreground text-xs leading-relaxed">
        Elegí qué te avisa Salu. Las predictivas usan el ritmo de los últimos 7 días — son
        sugerencias, no alarmas. Cualquiera la podés apagar después.
      </p>

      <ul className="flex flex-col gap-1">
        {ROWS.map(({ key, Icon, label, description, badge }) => {
          const value = prefs?.[key] ?? false;
          const isPending = pendingKey === key;
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => toggle(key)}
                disabled={!prefs || isPending}
                className={cn(
                  'flex w-full items-start gap-3 rounded-xl border border-transparent p-3 text-left transition-colors',
                  'hover:bg-muted/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  'disabled:cursor-not-allowed disabled:opacity-60',
                )}
              >
                <span
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-full ring-1 transition-colors',
                    value
                      ? 'bg-primary/10 text-primary ring-primary/15'
                      : 'bg-muted text-muted-foreground ring-border/40',
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground text-sm">{label}</span>
                    {badge && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/40 px-1.5 py-0.5 font-medium text-[9px] text-accent-foreground uppercase tracking-wider">
                        <Sparkles className="size-2.5" aria-hidden />
                        {badge}
                      </span>
                    )}
                  </div>
                  <span className="text-muted-foreground/90 text-xs leading-relaxed">
                    {description}
                  </span>
                </div>
                <Switch checked={value} pending={isPending} />
              </button>
            </li>
          );
        })}
      </ul>

      {!prefs && (
        <p className="flex items-center gap-2 text-muted-foreground/70 text-xs">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          Cargando preferencias…
        </p>
      )}
    </Card>
  );
}

function Switch({ checked, pending }: { checked: boolean; pending: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors',
        checked ? 'border-primary bg-primary' : 'border-border/60 bg-muted',
        pending && 'opacity-60',
      )}
    >
      <span
        className={cn(
          'absolute size-4 rounded-full bg-background shadow-sm transition-transform',
          checked ? 'translate-x-[18px]' : 'translate-x-0.5',
        )}
      />
    </span>
  );
}
