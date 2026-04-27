# AGENTS.md

Este archivo orienta a asistentes de IA (Claude Code, Cursor, GitHub Copilot, etc.) sobre cómo trabajar bien en este repositorio.

## Contexto del proyecto

Salu es un sistema operativo familiar privado para acompañar la crianza de un bebé llamado Salustiano. Es una webapp Next.js + Supabase + OpenRouter, pensada para uso de la familia, con énfasis en privacidad, accesibilidad y calidad sostenida.

Antes de hacer cambios, leer:

- `README.md` para visión general y stack.
- `docs/00-vision.md` para el principio rector.
- `docs/01-arquitectura.md` para arquitectura y modelo de datos.
- `decisions/` para entender por qué se tomaron las decisiones técnicas vigentes.

## Reglas no negociables

1. **No introducir `any`.** TypeScript estricto en todo el repo. Usar `unknown` con narrowing si hace falta.
2. **No `console.log` en código de producción.** Solo en tests o detrás de un logger explícito.
3. **No componentes inaccesibles.** Cada `button` con `aria-label` si no tiene texto visible. Cada imagen con `alt`. Cada input con `<label>` asociado.
4. **No colores hardcoded.** Siempre usar tokens de `globals.css` (`bg-primary`, `text-foreground`, etc.).
5. **No reglas RLS por código.** El backend confía solo en RLS de Postgres. Si un endpoint asume "el frontend ya filtró", está mal.
6. **No llamadas directas a OpenRouter desde componentes o endpoints.** Pasar siempre por `src/lib/ai/`.
7. **No omitir tests.** Funciones puras y componentes con lógica deben tener tests con Vitest.
8. **No paquetes nuevos sin justificación.** Cada dependencia agregada queda registrada con razón en el commit.

## Convenciones

- **Idioma:** español argentino rioplatense en copy de UI, comentarios y mensajes de error visibles. Inglés en nombres de variables, funciones, archivos y commits.
- **Imports:** absolutos con `@/...`, no relativos largos.
- **Server vs client:** preferir Server Components. Marcar `'use client'` solo cuando realmente se necesita estado, efectos o eventos del navegador.
- **Naming:** archivos en `kebab-case`, componentes en `PascalCase`, funciones en `camelCase`, constantes en `SCREAMING_SNAKE_CASE`.
- **Commits:** formato Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).

## Flujo de trabajo recomendado

1. Antes de editar, asegurar que `pnpm dev` corre.
2. Antes de commitear, ejecutar `pnpm lint && pnpm typecheck && pnpm test`.
3. Si la decisión es arquitectónica significativa, crear un ADR en `decisions/` antes de codear.
4. Si se agrega una feature visible al usuario, actualizar la sección correspondiente de `docs/`.

## Cosas que sí

- Server Components por default, Client Components solo cuando hace falta.
- Tipos de Zod para validar inputs externos (formularios, API, IA).
- `react-hook-form` para formularios complejos cuando entren.
- Componentes pequeños y composables.
- Tests de comportamiento (no de implementación).

## Cosas que no

- No `Pages Router`. Solo App Router.
- No estado global hasta que sea absolutamente necesario. Empezar con React Context y Server Actions.
- No CSS-in-JS. Tailwind para todo.
- No `useEffect` para fetching de datos: usar Server Components o Server Actions.
- No bibliotecas de fechas pesadas (Moment.js). Usar `date-fns`.

## Si no tenés contexto suficiente

Preguntá. Es preferible una pregunta a una decisión silenciosa que después haya que revertir.
