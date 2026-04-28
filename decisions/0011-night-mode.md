# ADR 0011 — Modo noche (`.night` theme)

**Estado:** Aceptado  
**Fecha:** 2026-04-27

## Contexto

Los padres de recién nacidos usan la app de noche, en la oscuridad, tratando de no despertar al bebé. El dark mode estándar es técnicamente correcto pero frío. Se necesita un tercer modo con tonos cálidos y contrastes reducidos.

## Decisión

Tercer theme `.night` en `globals.css`:

- Fondo: `oklch(0.12 0.01 80)` — casi negro con ligero tono cálido
- Foreground: `oklch(0.85 0.04 80)` — crema apagado
- Primario atenuado (~30% menos croma que dark)
- Contrastes bajados vs `.dark` para menor fatiga visual

**Auto-activación:** `useAutoNightMode()` hook detecta hora local en `America/Argentina/Tucuman` (Intl API). Si la hora está entre 20:00 y 07:00, aplica `.night` por default al montar. Si el usuario seteó override manual (`localStorage['theme-override']`), ese override tiene precedencia.

**Ciclo de toggle:** system → light → dark → night → system. Íconos: sol / luna / luna+estrellas.

**ThemeProvider:** configurado con `themes={["light", "dark", "night", "system"]}`.

## Alternativas descartadas

- **Solo dark mode:** No resuelve el problema de fatiga visual nocturna con bebés.
- **Media query `prefers-color-scheme` con variante warm:** No permite override manual ni ciclo de 4 modos.

## Consecuencias

- Usuarios en Tucumán entre 20:00-07:00 ven el modo noche por default la primera vez
- El override persiste en localStorage hasta que el usuario cambie explícitamente
- Si el usuario resetea localStorage, vuelve al comportamiento automático
