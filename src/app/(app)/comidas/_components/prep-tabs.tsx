'use client';

import { cn } from '@/lib/utils';
import { useState } from 'react';

interface PrepTabsProps {
  puree: string;
  blw: string;
  initial?: 'puree' | 'blw';
}

/** Cómo prepararlo: en papilla o para que lo agarre con la mano. */
export function PrepTabs({ puree, blw, initial = 'puree' }: PrepTabsProps) {
  const [tab, setTab] = useState<'puree' | 'blw'>(initial);
  return (
    <div className="flex flex-col gap-3">
      <div
        role="tablist"
        aria-label="Forma de prepararlo"
        className="flex rounded-2xl bg-muted/60 p-1"
      >
        {(
          [
            ['puree', 'En papilla'],
            ['blw', 'Con la mano (BLW)'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              'flex-1 rounded-xl px-3 py-2 font-medium text-sm transition-colors',
              tab === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <p role="tabpanel" className="text-foreground leading-relaxed">
        {tab === 'puree' ? puree : blw}
      </p>
    </div>
  );
}
