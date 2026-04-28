# 0006 — Soft delete + auditoría inmutable

**Estado:** aceptada
**Fecha:** 2026-04-27

## Contexto

`docs/01-arquitectura.md` enumera tres decisiones no negociables al inicio: soft delete obligatorio, edad gestacional al nacer, y trazabilidad por defecto. Las dos últimas se modelan con columnas en cada tabla relevante. La primera —el soft delete— necesita además un mecanismo de auditoría que registre quién borró qué y cuándo, para que un borrado no sea silencioso y para que se pueda restaurar en una ventana razonable.

La motivación es práctica: un familiar borrando sin querer la primera ecografía, o un admin haciendo una limpieza apurada que después lamenta, no debería ser un evento terminal. También hay un requerimiento de defensa: si en algún momento se pone en discusión qué información hay sobre Salustiano y cómo se modificó, el sistema tiene que poder responder con evidencia.

## Decisión

Cada tabla con datos del niño lleva una columna `deleted_at TIMESTAMPTZ NULL`. El borrado se hace seteando ese valor; la purga real ocurre treinta días después por un job periódico (no incluido en este ADR; se cablea cuando el sistema esté en uso). Las filas con `deleted_at IS NOT NULL` son invisibles a las consultas de aplicación gracias a que los índices y las vistas las filtran.

En paralelo, una tabla `audit_logs` registra todo INSERT, UPDATE, soft-delete, restore y hard-delete sobre las tablas sensibles. La inserción es responsabilidad de un trigger `audit_trigger_fn()` `SECURITY DEFINER` —los usuarios no escriben directo en `audit_logs`. La tabla no tiene policies de INSERT, UPDATE ni DELETE: solo SELECT para administradores de la familia involucrada. La trazabilidad es por construcción.

## Alternativas consideradas

**Hard delete con backup nocturno como única red de seguridad.** Más simple, menos columnas y menos complejidad de queries. Se descarta porque la ventana de recuperación es de horas a un día, no de minutos, y porque restaurar de backup borra cualquier cambio posterior al backup. Soft delete da treinta días de gracia sin perder lo que pasó después del error.

**Soft delete por columna `is_deleted BOOLEAN` en lugar de timestamp.** Funcionalmente equivalente para queries, pero pierde información sobre el momento del borrado, que es exactamente lo que se necesita para purgar después de N días y para auditar el orden temporal de las acciones. El timestamp gana sin agregar costo.

**Auditoría a nivel aplicación, llamando a una función desde el código del backend.** Posible, pero es duplicar lógica entre la app y la base de datos: si alguien escribe SQL crudo, accede vía `psql` o usa el dashboard, la auditoría se evita. Un trigger `SECURITY DEFINER` se ejecuta sí o sí; el único modo de evitarlo es tener acceso de superusuario, que ningún rol de aplicación tiene en Supabase.

**Auditoría en una tabla por dominio (`audit_child_profiles`, `audit_sleep_sessions`, etc.).** Permite tipar el `old_data` y `new_data` con más precisión, pero multiplica las tablas y obliga a escribir un trigger por cada una. La tabla única `audit_logs` con `old_data JSONB`, `new_data JSONB` y `table_name TEXT` resuelve el caso a un costo de tipado más laxo, aceptable para una tabla de auditoría que se consulta en raras ocasiones.

## Consecuencias

**Positivo.** El borrado nunca es destructivo en el momento. La auditoría es inevitable: cualquier mutación queda registrada con autor y timestamp, sin posibilidad de evitar el trigger desde la aplicación. Las queries normales filtran `deleted_at IS NULL` vía índices parciales, así que la performance no sufre. La tabla `audit_logs` es de solo lectura para roles de aplicación, lo que la convierte en evidencia confiable.

**Negativo.** Cada query de aplicación debe acordarse de filtrar por `deleted_at IS NULL`, salvo que se use la vista `timeline_events` —que ya lo hace— o que se modele con políticas RLS que lo incluyan. Las restauraciones manuales requieren admin intervention y se deben hacer con cuidado para no romper invariantes (por ejemplo, restaurar un `child_profile` cuyo `family_group` fue purgado). Una purga real a los treinta días requiere un job que todavía no existe; mientras tanto las filas se acumulan, lo cual es aceptable a esta escala pero hay que cablearlo antes de que el volumen sea relevante.

**Señales que harían reconsiderar.** Crecimiento del tamaño de `audit_logs` que afecte performance de la base; necesidad de auditoría diferenciada por tabla con tipos estrictos; aparición de un caso de uso donde el hard delete inmediato sea legalmente requerido (por ejemplo, una baja regulada por ley de protección de datos que no admita ventana de gracia).
