# ADR 0007 — React Hook Form + Zod para formularios

**Estado:** Aceptado  
**Fecha:** 2026-04-27

## Contexto

Los formularios de auth y onboarding requieren validación del lado del cliente con feedback inmediato, tipado estricto y fácil integración con Server Actions.

## Decisión

**React Hook Form v7 + Zod v4 + @hookform/resolvers.**

- Validación de schema con Zod en `src/lib/validators/`.
- `useForm` + `zodResolver` en cada Client Component de formulario.
- Server Actions reciben datos pre-validados; re-validan con Zod como defensa en profundidad.
- Mensajes de error en español rioplatense definidos en el schema.

## Alternativas descartadas

- **Formik:** Más verboso, performance inferior a RHF en re-renders.
- **Validación nativa HTML:** No provee tipado ni composición de schemas.
- **useActionState (nativo de React 19):** Bueno para formularios simples sin validación compleja del lado del cliente. Para multi-step con validación progresiva, RHF es más ergonómico.

## Consecuencias

- Bundle size: RHF (~14kb gz) + Zod (~12kb gz). Aceptable.
- Zod v4 tiene breaking changes respecto a v3. Los resolvers de @hookform/resolvers v5 son compatibles con Zod v4.
- Schemas reutilizables para validación server-side en actions.ts.
