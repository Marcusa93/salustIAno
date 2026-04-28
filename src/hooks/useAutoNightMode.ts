'use client';

import { useTheme } from 'next-themes';
import { useEffect } from 'react';

const NIGHT_START = 20; // 20:00
const NIGHT_END = 7; // 07:00 (hasta las 7am)
const OVERRIDE_KEY = 'theme-override';

function isNightInTucuman(): boolean {
  const now = new Date();
  const tucumanTime = new Date(
    now.toLocaleString('en-US', { timeZone: 'America/Argentina/Tucuman' }),
  );
  const hour = tucumanTime.getHours();
  return hour >= NIGHT_START || hour < NIGHT_END;
}

export function useAutoNightMode() {
  const { setTheme, resolvedTheme } = useTheme();

  useEffect(() => {
    const override = localStorage.getItem(OVERRIDE_KEY);
    if (override) return;

    if (isNightInTucuman()) {
      setTheme('night');
    }
    // Solo al montar — no queremos re-aplicar en cada render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { resolvedTheme };
}
