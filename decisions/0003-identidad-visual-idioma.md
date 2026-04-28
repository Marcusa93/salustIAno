# ADR 0003 — Identidad visual e idioma

**Estado:** Aceptado  
**Fecha:** 2026-04-27

## Contexto

Antes del primer commit hay que cerrar dos decisiones de producto con impacto técnico:
1. El idioma del producto.
2. La identidad visual: paleta, tipografía, tono.

## Decisiones

### Idioma

**Solo español rioplatense.** Voseo natural en toda la copy de UI. Sin abstracciones de internacionalización.

**Consecuencias:** Se ahorra toda la infraestructura i18n. Si en el futuro se necesita otro idioma, se refactoriza. El costo de no tenerlo hoy es cero; el costo de tenerlo sin necesitarlo es complejidad permanente.

### Paleta OKLCH

Colores definidos en `src/app/globals.css` con variables CSS en formato OKLCH. Sistema de tokens shadcn/ui (base-nova) sobre Tailwind v4.

Acento de marca: **verde salvia** (`oklch(0.58 0.12 155)`) — transmite naturaleza, crecimiento, calidez sin ser clínico.

Dark mode via `.dark` class (next-themes). Variables redefinidas para modo oscuro.

### Tipografía

Geist Sans (variable font, Google Fonts vía `next/font`). Sans-serif limpia, moderna, legible en pantallas pequeñas.

### Tono de diseño

Cálido, familiar, moderno, simple. No clínico. No infantil-colorido. Íconos Lucide React (incluido en shadcn base-nova).

## Alternativas descartadas

- **Internacionalización (next-intl, i18next):** Overhead innecesario para un producto de una sola familia en Argentina.
- **Colores azules/verdes médicos:** Demasiado clínicos para el tono buscado.
- **Tailwind v3 con configuración tradicional:** Tailwind v4 es el default en Next.js 16; v3 requeriría config adicional sin beneficio.
