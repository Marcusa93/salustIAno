# 0005 — Supabase CLI como herramienta de migraciones

**Estado:** aceptada
**Fecha:** 2026-04-27

## Contexto

El paso de schema MVP requiere una herramienta que gestione migraciones SQL versionadas, las aplique al proyecto remoto, las pueda correr contra un Postgres local para tests, y genere tipos TypeScript a partir del schema final. Las migraciones son la fuente de verdad del backend: si el camino entre escribir SQL y verlo aplicado en producción tiene fricciones, se tiende a evitar el versionado y a tocar el dashboard a mano, que es exactamente lo que rompe la trazabilidad.

## Decisión

Usamos la **Supabase CLI** —pinneada como devDependency en `package.json` y comprometida en el repo— como única vía para gestionar migraciones, generar tipos y ejecutar tests SQL.

Las migraciones viven en `supabase/migrations/` con el formato de timestamp `YYYYMMDDHHMMSS_<nombre>.sql` que la CLI usa para ordenarlas. Se aplican con `pnpm db:push` contra el remoto (o `pnpm db:reset` contra el local cuando hay Docker). Los tipos TypeScript se regeneran con `pnpm db:types` después de cada migración aplicada.

## Alternativas consideradas

**Drizzle Kit u otro ORM con migraciones declarativas.** Un schema en TypeScript con migraciones autogeneradas es atractivo para mantener tipos y SQL en un solo lugar. Se descarta para esta etapa: las policies de RLS, los triggers de auditoría y las funciones SECURITY DEFINER son SQL nativo, y ocultarlos detrás de una abstracción de ORM agrega indirección sin ganar legibilidad. Cuando exista un caso fuerte para tener relaciones modeladas en código —por ejemplo, queries de aplicación complejas que se beneficien del query builder— se reabre.

**Migraciones SQL crudas aplicadas a mano vía `psql`.** Más portable, sin lock-in con la CLI. Se descarta porque no tiene una noción de qué migraciones se aplicaron contra qué entorno y obliga a llevar a mano el orden y el estado. La CLI lo resuelve gratis con su tabla `supabase_migrations.schema_migrations`.

**Hasura, Atlas, Sqitch u otra herramienta genérica de migraciones.** Más maduras y agnósticas al proveedor, pero suman una dependencia adicional al stack y exigen aprenderlas. Para un equipo de un solo desarrollador con el resto del backend ya en Supabase, la CLI nativa gana por integración: link, push, gen types y diff están en el mismo binario.

**Supabase Dashboard SQL Editor como fuente de verdad.** Tentador para cambios chicos, pero los cambios no quedan versionados. Se descarta como práctica: el dashboard se usa para inspeccionar, no para mutar.

## Consecuencias

**Positivo.** Cada cambio de schema queda como un archivo SQL en el repo, revisable en PR. Generación de tipos automática mantiene el frontend al día con el backend. La CLI también permite levantar un Postgres local idéntico al remoto cuando hay Docker, para tests RLS reales sin tocar producción.

**Negativo.** Atadura a la convención de Supabase para nombres de archivo y para la tabla `schema_migrations`. Si en el futuro se migra a Postgres self-hosted, las migraciones siguen siendo SQL portable, pero la integración con `gen types` y el flujo de `link/push` se pierden y hay que reescribir las herramientas. La CLI también requiere que un humano corra los comandos —no hay auto-deploy— lo cual es deseable a esta escala pero deja una tarea manual más.

**Señales que harían reconsiderar.** Cambios drásticos en la API de la CLI que rompan flujos críticos; necesidad de migraciones bidireccionales (down) que la CLI maneja peor que herramientas dedicadas; salida de Supabase como proveedor.
