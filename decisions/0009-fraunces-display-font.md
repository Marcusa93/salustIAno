# ADR 0009 — Fraunces como tipografía display

**Estado:** Aceptado  
**Fecha:** 2026-04-27

## Contexto

La MVP fase A usaba Geist Sans para todo. Para que Salu se sienta como una carta y no como un dashboard SaaS, los títulos y elementos de jerarquía visual máxima necesitan una tipografía con personalidad: serif, cálida, legible en mobile.

## Decisión

**Fraunces** via `next/font/google`, pesos 400/500/700, eje opsz variable, italic disponible.

- CSS variable: `--font-fraunces` → expuesta en `@theme inline` como `--font-display`
- Clase Tailwind: `font-display`
- Regla: h1/h2 siempre display serif; h3/h4 sans bold; body sans regular
- Fallback: Newsreader → Georgia → serif

## Alternativas descartadas

- **Playfair Display:** Muy decorativo, puede verse recargado en mobile.
- **Lora:** Buena opción pero menos carácter en los pesos bajos.
- **Mantener solo Geist:** Funcional pero sin el tono editorial que busca el producto.

## Consecuencias

- +1 fuente variable de Google Fonts (auto-hosted por Next.js, sin requests externos)
- Impacto en LCP despreciable por `display: swap` y preload automático de Next.js
- Se actualiza ADR 0003 implícitamente: Geist Sans sigue como UI/body, Fraunces toma display
