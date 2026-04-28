'use client';

import { Button } from '@/components/ui/button';
import { useAutoNightMode } from '@/hooks/useAutoNightMode';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

const OVERRIDE_KEY = 'theme-override';

const CYCLE: Array<'system' | 'light' | 'dark' | 'night'> = ['system', 'light', 'dark', 'night'];

function NightIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
      <circle cx="19" cy="3" r="1" fill="currentColor" stroke="none" />
      <circle cx="22" cy="8" r="0.7" fill="currentColor" stroke="none" />
      <circle cx="17" cy="1" r="0.7" fill="currentColor" stroke="none" />
    </svg>
  );
}

const LABELS: Record<string, string> = {
  light: 'Modo claro activo — cambiar a oscuro',
  dark: 'Modo oscuro activo — cambiar a noche',
  night: 'Modo noche activo — cambiar a sistema',
  system: 'Modo sistema activo — cambiar a claro',
};

export function ThemeToggle() {
  useAutoNightMode();
  const { theme, setTheme } = useTheme();

  const currentTheme = (theme ?? 'system') as 'system' | 'light' | 'dark' | 'night';
  const currentIndex = CYCLE.indexOf(currentTheme);
  // El índice está acotado por modulo a CYCLE.length, así que el lookup
  // siempre devuelve un valor; la aserción no-null es segura.
  const nextTheme = CYCLE[(currentIndex + 1) % CYCLE.length] as (typeof CYCLE)[number];

  function handleCycle() {
    localStorage.setItem(OVERRIDE_KEY, nextTheme);
    setTheme(nextTheme);
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={LABELS[currentTheme] ?? 'Cambiar tema'}
      onClick={handleCycle}
    >
      <Sun className="size-4 night:scale-0 scale-100 transition-all dark:scale-0 [.night_&]:scale-0" />
      <Moon className="absolute size-4 scale-0 transition-all dark:scale-100 [.night_&]:scale-0" />
      <span className="absolute opacity-0 transition-all [.night_&]:opacity-100">
        <NightIcon />
      </span>
    </Button>
  );
}
