import type { Transition } from 'motion/react';

export const easings = {
  easeWarm: [0.25, 0.1, 0.25, 1.0] as [number, number, number, number],
  easeOut: [0.0, 0.0, 0.2, 1.0] as [number, number, number, number],
  easeIn: [0.4, 0.0, 1.0, 1.0] as [number, number, number, number],
  spring: [0.34, 1.56, 0.64, 1.0] as [number, number, number, number],
} as const;

export const easeWarm = easings.easeWarm;
export const easeSlow: [number, number, number, number] = [0.4, 0, 0.2, 1];
export const easeOut = easings.easeOut;

export const durations = {
  fast: 0.15,
  base: 0.35,
  normal: 0.25,
  slow: 0.4,
  page: 0.6,
} as const;

export const fadeUp: { initial: object; animate: object; transition: Transition } = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: durations.slow, ease: easeWarm },
};

export const fadeIn: { initial: object; animate: object; transition: Transition } = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: durations.base, ease: easeWarm },
};

export const slideLeft: { initial: object; animate: object; exit: object; transition: Transition } =
  {
    initial: { opacity: 0, x: 40 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -40 },
    transition: { duration: durations.base, ease: easeWarm },
  };
