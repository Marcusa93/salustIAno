'use client';

import { cn } from '@/lib/utils';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

const THEMES = [
  { value: 'light', label: 'Modo claro', icon: Sun },
  { value: 'system', label: 'Modo sistema', icon: Monitor },
  { value: 'dark', label: 'Modo oscuro', icon: Moon },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Evita el flash de hidratación: hasta que el cliente no esté montado,
  // no sabemos qué tema mostrar como activo.
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div
      role="radiogroup"
      aria-label="Seleccionar tema"
      className="inline-flex items-center gap-1 rounded-full border border-border bg-card p-1 shadow-soft"
    >
      {THEMES.map(({ value, label, icon: Icon }) => {
        const isActive = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            // biome-ignore lint/a11y/useSemanticElements: <button role="radio"> dentro de un radiogroup custom es un patrón ARIA válido (idéntico al de Radix/shadcn); reemplazar por <input type="radio"> rompe el layout flex con íconos como children.
            role="radio"
            aria-checked={isActive}
            aria-label={label}
            onClick={() => setTheme(value)}
            className={cn(
              'inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors',
              'focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
