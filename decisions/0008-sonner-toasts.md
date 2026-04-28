# ADR 0008 — Sonner para notificaciones toast

**Estado:** Aceptado  
**Fecha:** 2026-04-27

## Contexto

Los formularios necesitan feedback de éxito/error via toast. Se necesita una solución que sea compatible con Next.js App Router, dark mode y el sistema de diseño shadcn.

## Decisión

**Sonner v2** como solución de toasts.

- Ya incluido en shadcn/ui base-nova como componente `Toaster`.
- Integración nativa con `next-themes` para dark mode automático.
- API simple: `toast.success()`, `toast.error()`.
- Estilado via CSS variables del sistema shadcn.

## Alternativas descartadas

- **react-hot-toast:** No tiene integración nativa con dark mode ni con shadcn.
- **Toasts propios:** Requiere implementar accesibilidad (aria-live, role="status") desde cero.
- **react-toastify:** Mayor bundle size, estilo propio que requiere override.

## Consecuencias

- `<Toaster />` debe estar en el root layout con ThemeProvider.
- Las calls a `toast()` son imperativas desde Client Components; desde Server Actions se pasa el estado al cliente que llama al toast.
