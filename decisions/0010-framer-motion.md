# ADR 0010 — Framer Motion (motion/react) para animaciones

**Estado:** Aceptado  
**Fecha:** 2026-04-27

## Contexto

Las animaciones de entrada y transición entre pasos del onboarding necesitan más control del que ofrecen las transitions CSS de Tailwind. En particular: `AnimatePresence` para animar salidas, `whileInView` para scroll-triggered, y easing curves custom.

## Decisión

**motion v12** (package `motion`, import `motion/react`). Compatible con React 19.

- `src/lib/motion.ts` centraliza todas las curvas nombradas y duraciones
- `useReducedMotion()` en todos los componentes que animan para respetar `prefers-reduced-motion`
- No usar `framer-motion` (legacy package) — solo `motion/react`

## Alternativas descartadas

- **CSS transitions + Tailwind animate:** Insuficiente para AnimatePresence (animar elementos que salen del DOM) y para slide horizontal del onboarding.
- **React Spring:** Más complejo, menor adopción, peor DX en viewport animations.
- **tw-animate-css (ya instalado):** Sirve para animaciones simples de Tailwind, no para state-driven animations.

## Consecuencias

- +~40KB gzip en el bundle cliente (motion v12 hace tree-shaking agresivo)
- Todas las animaciones respetan `prefers-reduced-motion` de forma explícita
- `src/lib/motion.ts` es la única fuente de verdad para duraciones y easings
