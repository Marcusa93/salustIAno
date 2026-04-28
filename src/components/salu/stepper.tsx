'use client';

import { cn } from '@/lib/utils';

interface StepperProps {
  steps: number;
  current: number;
  className?: string;
}

export function Stepper({ steps, current, className }: StepperProps) {
  return (
    <nav
      aria-label={`Paso ${current} de ${steps}`}
      className={cn('flex items-center gap-2', className)}
    >
      {Array.from({ length: steps }, (_, i) => {
        const step = i + 1;
        const isDone = step < current;
        const isActive = step === current;

        return (
          <div
            key={step}
            aria-current={isActive ? 'step' : undefined}
            className={cn(
              'h-2 rounded-full transition-all duration-300',
              isActive ? 'w-6 bg-primary' : 'w-2',
              isDone ? 'bg-primary/60' : !isActive && 'bg-border',
            )}
          />
        );
      })}
    </nav>
  );
}
