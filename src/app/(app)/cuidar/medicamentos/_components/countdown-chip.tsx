'use client';

import { cn } from '@/lib/utils';
import { Clock } from 'lucide-react';
import { useEffect, useState } from 'react';

type DoseStatus = 'ok' | 'soon' | 'overdue';

const STATUS_STYLES: Record<DoseStatus, string> = {
  ok: 'bg-green-500/10 text-green-700 dark:text-green-400',
  soon: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
  overdue: 'bg-red-500/10 text-red-700 dark:text-red-400',
};

function calcStatus(nextDoseAt: string, now: Date): DoseStatus {
  const diffMin = (new Date(nextDoseAt).getTime() - now.getTime()) / 60_000;
  if (diffMin > 60) return 'ok';
  if (diffMin > 0) return 'soon';
  return 'overdue';
}

function formatCountdown(nextDoseAt: string, now: Date): string {
  const diffMin = Math.round((new Date(nextDoseAt).getTime() - now.getTime()) / 60_000);
  if (diffMin > 0) {
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    if (h === 0) return `en ${m}m`;
    if (m === 0) return `en ${h}h`;
    return `en ${h}h ${m}m`;
  }
  const over = Math.abs(diffMin);
  if (over < 60) return `hace ${over}m`;
  const h = Math.floor(over / 60);
  const m = over % 60;
  return `hace ${h}h${m > 0 ? ` ${m}m` : ''}`;
}

export function CountdownChip({ nextDoseAt }: { nextDoseAt: string }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const status = calcStatus(nextDoseAt, now);
  return (
    <span
      className={cn('shrink-0 rounded-full px-2.5 py-0.5 font-medium text-xs', STATUS_STYLES[status])}
    >
      <Clock className="mr-1 inline size-3" aria-hidden />
      {formatCountdown(nextDoseAt, now)}
    </span>
  );
}
