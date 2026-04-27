# 0002 — Stack moderno: Next.js 16, React 19, Tailwind v4, Biome

**Estado:** aceptada
**Fecha:** 2026-04-27

## Contexto

El ADR 0001 estableció el stack base —Next.js, Supabase, OpenRouter— pero no fijó versiones. A abril de 2026, el ecosistema cambió: Next.js 16.2 trae Turbopack default y React Compiler estable; React 19 es estable con Server Actions maduras; Tailwind v4.2 reemplaza la configuración JavaScript por CSS-first con `@theme`; Next 16 removió `next lint` y la documentación oficial recomienda Biome o ESLint directo. Hay que tomar decisiones concretas antes del primer commit de código.

## Decisión

Adoptamos las versiones más recientes estables de cada herramienta y unificamos linting y formatting en Biome.

- **Next.js 16.2** con App Router, Turbopack, React Compiler activado.
- **React 19** y React DOM 19.
- **TypeScript 5** con `strict: true` y todas las flags estrictas adicionales activadas.
- **Tailwind CSS v4.2** con configuración CSS-first vía `@theme` en `globals.css`.
- **shadcn/ui** para componentes base, copiados al repo (no como librería instalada).
- **Biome** como linter y formatter unificado.
- **Vitest** para tests unitarios y de integración; **Playwright** se sumará cuando lleguen flujos end-to-end (Paso 5).
- **pnpm** como package manager.
- **Node 22 LTS** pinneado vía `.nvmrc`.
- **Husky + lint-staged** para validar cada commit con `biome check` y `tsc --noEmit`.
- **Geist** como tipografía principal, optimizada por Next.js.

## Alternativas consideradas

**Next.js 15 en lugar de 16.** Más conservador, pero quedaría con webpack en lugar de Turbopack, sin React Compiler estable, y sin las mejoras de routing. La curva de adopción de Next 16 es manejable y la performance gana 5-10× en HMR.

**ESLint 9 + Prettier en lugar de Biome.** Ecosistema más maduro de plugins, especialmente `eslint-plugin-jsx-a11y` para accesibilidad. Pero supone dos herramientas, configuración más compleja y mucho más lento en pre-commit. Biome cubre las reglas de accesibilidad críticas para WCAG AA, es 10-20× más rápido y tiene una sola config. Si en el futuro aparecen reglas a11y específicas que Biome no cubre, reevaluamos.

**npm o yarn en lugar de pnpm.** pnpm es más rápido, usa menos disco y es más estricto con dependencias fantasma, lo que evita bugs sutiles donde un paquete usa algo que no declaró.

**React Compiler desactivado.** El compilador automatiza memoización pero ralentiza builds. La decisión es activarlo desde el inicio porque es justamente cuando hay menos código y los tiempos de build no duelen, y porque baja la carga cognitiva de pensar `useMemo`/`useCallback` manualmente.

## Consecuencias

**Positivo.** Performance de desarrollo excelente: HMR sub-segundo, builds rápidos. TypeScript estricto detecta clases enteras de errores antes del runtime. Biome unificado simplifica configuración y CI. shadcn/ui da componentes accesibles y editables sin lock-in.

**Negativo.** Stack joven en algunos puntos: Next 16 tiene meses, Tailwind v4 cambió mucho respecto a v3, Biome aún tiene menos plugins que ESLint. Ocasionalmente vamos a encontrar issues abiertos o tutoriales desactualizados.

**Señales que harían reconsiderar.** Bugs serios en Turbopack o React Compiler que no se resuelvan rápido; reglas de accesibilidad importantes que Biome no soporte; problemas de compatibilidad de shadcn con Tailwind v4.
