'use client';

import { animate, useMotionValue } from 'motion/react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

interface HoldOptions {
  durationMs: number;
  onStart?: () => void;
  onCancel?: () => void;
  onComplete: () => void;
}

/**
 * "Mantené apretado": dedo, mouse o barra espaciadora. `progress` va de 0
 * a 1 mientras se sostiene y vuelve a 0 si se suelta antes de tiempo.
 */
export function useHold({ durationMs, onStart, onCancel, onComplete }: HoldOptions) {
  const progress = useMotionValue(0);
  const [holding, setHolding] = useState(false);
  const [done, setDone] = useState(false);
  const startedAt = useRef<number | null>(null);
  const frame = useRef<number | null>(null);
  const callbacks = useRef({ onStart, onCancel, onComplete });
  callbacks.current = { onStart, onCancel, onComplete };

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  const tick = () => {
    if (startedAt.current === null) return;
    const value = Math.min(1, (performance.now() - startedAt.current) / durationMs);
    progress.set(value);
    if (value >= 1) {
      startedAt.current = null;
      setHolding(false);
      setDone(true);
      callbacks.current.onComplete();
      return;
    }
    frame.current = requestAnimationFrame(tick);
  };

  const begin = () => {
    if (done || startedAt.current !== null) return;
    startedAt.current = performance.now() - progress.get() * durationMs;
    setHolding(true);
    callbacks.current.onStart?.();
    frame.current = requestAnimationFrame(tick);
  };

  const end = () => {
    if (startedAt.current === null) return;
    startedAt.current = null;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    setHolding(false);
    animate(progress, 0, { duration: 0.5 });
    callbacks.current.onCancel?.();
  };

  const isHoldKey = (key: string) => key === ' ' || key === 'Enter';

  const handlers = {
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      try {
        // Así el dedo puede moverse un poco sin "soltar" el botón.
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Puntero ya inactivo: seguimos igual, sin captura.
      }
      begin();
    },
    onPointerUp: end,
    onPointerCancel: end,
    onLostPointerCapture: end,
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (!isHoldKey(event.key)) return;
      event.preventDefault();
      if (!event.repeat) begin();
    },
    onKeyUp: (event: KeyboardEvent<HTMLElement>) => {
      if (isHoldKey(event.key)) end();
    },
    onContextMenu: (event: { preventDefault: () => void }) => event.preventDefault(),
  };

  return { progress, holding, done, handlers };
}
