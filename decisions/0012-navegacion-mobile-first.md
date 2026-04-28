# ADR 0012 — Navegación mobile-first: bottom-nav + sidebar desktop

**Estado:** Aceptado  
**Fecha:** 2026-04-27

## Contexto

La app necesita navegación principal con 5 secciones (Home, Cuidar, Recordar, Crear, Familia). El uso primario es en mobile (padres con bebé en brazos), pero debe funcionar correctamente en desktop también.

## Decisión

**Coexistencia de bottom-nav y sidebar desktop**, no reemplazo de uno por otro.

- `BottomNav` (Client Component): fixed bottom, visible solo en mobile (`md:hidden`). 5 ítems con icono + label.
- `DesktopSidebar` (Client Component): sticky top, visible `md:flex`, oculto en mobile. Mismo 5 ítems, layout vertical con active border-l-4.
- `MobileMenu` (Client Component): Sheet con trigger hamburguesa en el header. Solo visible en mobile. Replica la nav + theme options + user card.

El theme toggle se unificó en el `UserMenu` (dropdown) como submenu de radio items, eliminándolo del header. Soporte extendido a 4 temas: Sistema / Claro / Oscuro / Noche (`.night` CSS class con variables OKLCH propias).

## Razón del Client Component en sidebar

El active state requiere `usePathname` (hook de Next.js router). Una alternativa sería leer el pathname desde middleware via header `x-pathname`, pero agrega complejidad. Con RSC + streaming, el Client Component boundary es mínimo.

## 5 ítems (no 4, no 6)

- Home: landing de la app autenticada
- Cuidar: registro de eventos del día a día
- Recordar: timeline de recuerdos
- Crear: generación de contenido con IA
- Familia: gestión de miembros del grupo familiar

No hay sección "Configuración" en la nav principal — queda en el user menu.

## Alternativas descartadas

- **Solo sidebar desktop + hamburger mobile**: requería más lógica de Sheet, y el bottom-nav es más ergonómico para mobile (alcance con el pulgar).
- **Tab bar nativo (solo icons, sin labels)**: reduce accesibilidad y descubribilidad para un producto familiar con usuarios no técnicos.
- **Single nav responsive**: Tailwind maneja bien la bifurcación con `md:hidden` / `md:flex` sin JavaScript adicional.
