'use client';

import { cn } from '@/lib/utils';
import { Library, Sparkles } from 'lucide-react';
import { useState } from 'react';
import type { LullabyLibraryEntry } from './actions';
import { LullabyForm } from './lullaby-form';
import { LullabyLibrary } from './lullaby-library';

type Tab = 'new' | 'library';

interface CancionTabsProps {
  initialLibrary: LullabyLibraryEntry[];
}

/**
 * Toggle entre "Nueva" (form de generación) y "Biblioteca" (lista de
 * canciones guardadas). Sin librería de tabs — segmented control simple
 * porque solo son dos paneles.
 *
 * Si la biblioteca está vacía y entrás por primera vez, arranca en
 * "Nueva". Si hay canciones guardadas, arranca en "Biblioteca" para
 * que el primer click las descubra.
 */
export function CancionTabs({ initialLibrary }: CancionTabsProps) {
  const [tab, setTab] = useState<Tab>(initialLibrary.length > 0 ? 'library' : 'new');

  return (
    <div className="flex flex-col gap-6">
      <div
        role="tablist"
        aria-label="Modo de canciones"
        className="inline-flex w-fit gap-1 rounded-full border border-border/60 bg-card/50 p-1 backdrop-blur-sm"
      >
        <TabButton
          label="Nueva"
          icon={Sparkles}
          active={tab === 'new'}
          onClick={() => setTab('new')}
        />
        <TabButton
          label={`Biblioteca${initialLibrary.length > 0 ? ` · ${initialLibrary.length}` : ''}`}
          icon={Library}
          active={tab === 'library'}
          onClick={() => setTab('library')}
        />
      </div>

      {tab === 'new' ? <LullabyForm /> : <LullabyLibrary entries={initialLibrary} />}
    </div>
  );
}

function TabButton({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: typeof Sparkles;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 font-medium text-sm transition-all',
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {label}
    </button>
  );
}
