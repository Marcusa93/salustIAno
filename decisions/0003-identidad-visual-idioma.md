# 0003 — Identidad visual e idioma

**Estado:** aceptada
**Fecha:** 2026-04-27

## Contexto

El documento `docs/10-decisiones-abiertas.md` listaba la identidad visual y el idioma como decisiones a cerrar antes del primer commit. Ambas son decisiones de bajo costo si se toman ahora y caras si se cambian después: el idioma define toda la copy del producto y la estructura de prompts; la identidad visual define los design tokens que viven en CSS y atraviesan cada componente.

## Decisión

**Idioma único: español argentino rioplatense con sensibilidad del NOA.** Toda la copy del producto, los prompts de los agentes y los mensajes de error se escriben en este registro. No hay infraestructura de internacionalización en el MVP.

**Identidad visual: moderno-cálido con base celeste.** Estética baby sin caer en lo infantilizado: bordes redondeados generosos pero no excesivos, tipografía geométrica humanista (Geist), espaciado amplio, sombras suaves, transiciones smooth. La paleta está construida en OKLCH para tener percepción uniforme en ambos modos.

### Paleta

Color primario: celeste vibrante en `oklch(0.65 0.15 230)` para light mode y `oklch(0.72 0.14 230)` para dark mode. Acento cálido: amarillo paja muy suave en `oklch(0.92 0.08 90)` para contrapeso emocional.

Los tokens completos se definen en `src/app/globals.css` bajo `@theme`. Cualquier cambio futuro de paleta se hace ahí.

### Tipografía

**Geist Sans** como tipografía principal, **Geist Mono** para código y datos numéricos. Ambas vienen optimizadas en Next.js vía `next/font/google` o `next/font/local` y se cargan sin layout shift.

### Border radius

`--radius: 1rem` como base. Componentes pequeños (botones, badges) `0.75rem`. Cards y contenedores `1.25rem`. Avatar siempre `9999px` (circular).

### Modo oscuro

Real, basado en navy oscuro `oklch(0.18 0.025 240)`, no negro puro. Contraste WCAG AA en todos los pares de colores semánticos.

## Alternativas consideradas

**Español neutro internacional.** Más amplio en alcance pero menos cálido. Como la app es familiar y privada, el voseo y la cadencia rioplatense generan mayor cercanía. Si en el futuro el producto se abre, se reabre la decisión.

**Paleta en HSL.** Más conocida pero menos uniforme en luminosidad. OKLCH es el estándar moderno y Tailwind v4 lo soporta nativamente.

**Tipografía sistema (`-apple-system`, etc.).** Más rápido de cargar pero estética poco distintiva. Geist es gratis, pesa poco con `next/font`, y le da carácter al producto.

**Estética claramente infantil con muchos colores y formas.** Marco descartó este camino: la app la usan adultos cuidando un bebé, no el bebé. La estética debe ser cálida pero sobria.

## Consecuencias

**Positivo.** Sistema de diseño coherente desde el día uno. Cambiar la paleta entera es modificar variables en un solo archivo CSS. El registro lingüístico cohesionado hace que la copy se sienta como escrita por una persona, no por una IA neutra.

**Negativo.** Si el proyecto se abre a familias fuera de Argentina, hay que internacionalizar copy y replantear el tono. Si en algún momento se incorpora un familiar de habla no española, hay fricción.

**Señales que harían reconsiderar.** Comentarios consistentes de usuarios sobre que la estética se siente fría o infantil; problemas de contrasto detectados por usuarios con baja visión; necesidad real de soporte multilingüe.
