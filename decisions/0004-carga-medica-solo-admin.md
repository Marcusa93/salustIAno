# 0004 — Carga de información médica restringida a admin

**Estado:** aceptada
**Fecha:** 2026-04-27

## Contexto

El documento `docs/03-roles-permisos.md` define cuatro roles iniciales (admin, caregiver, family, viewer). El alcance de carga de cada rol estaba abierto para los datos médicos sensibles. Estos datos —síntomas, fiebre, medicación indicada, antecedentes, vacunas, controles pediátricos— tienen tres características que los diferencian de un evento de cuidado cotidiano: pueden ser usados como insumo para resúmenes destinados al pediatra, requieren precisión sostenida en el tiempo, y un error puede tener consecuencias graves.

## Decisión

**En la fase 0 y la fase 1, solo los administradores (padre y madre) cargan información médica.** Caregivers y family pueden ver los eventos médicos según sus permisos generales, pero no crearlos, editarlos ni eliminarlos.

Esto se modela con políticas RLS específicas en las tablas del dominio salud (`health_events`, `medications`, `vaccines`, `medical_appointments`, `allergies`, `medical_documents`), que validan que el usuario tenga rol `admin` en `family_memberships` antes de permitir `INSERT`, `UPDATE` o `DELETE`.

## Alternativas consideradas

**Caregivers también pueden cargar.** Tendría sentido para una niñera profesional que registra que dio una medicación indicada. Se descarta para la fase 0 por simplicidad y porque no hay caregivers todavía. Si en el futuro aparece este caso real, se reabre la decisión y se considera una variante: caregivers pueden cargar pero requieren validación de un admin antes de que el evento entre al timeline o a los resúmenes de IA.

**Family también puede cargar.** Se descarta por completo. Un abuelo bien intencionado registrando "Salu tuvo fiebre" sin ser preciso con la temperatura, la duración o los síntomas asociados, contamina los datos que después usa el resumen para pediatra.

**Permitir carga a todos pero marcar como no validado.** Suma complejidad de UX (estados intermedios, validación pendiente) y riesgo de que datos no validados entren igual al timeline visible. Para fase 0 es over-engineering.

## Consecuencias

**Positivo.** Integridad de los datos médicos por construcción. Resúmenes generados por IA tienen base confiable. Los admins (padre y madre) son responsables explícitos de qué se sabe sobre la salud de Salustiano. Política RLS simple y testeable.

**Negativo.** Si solo uno de los dos admins está disponible y otro familiar quiere registrar algo médico (por ejemplo, que el bebé estuvo afiebrado mientras lo cuidaba la abuela), tiene que hacerlo a través del admin. En la práctica esto se resuelve con un mensaje al admin que después carga el evento, lo cual es razonable.

**Señales que harían reconsiderar.** Pérdida sistemática de información médica porque los admins no estaban presentes para cargarla; necesidad real de incorporar un caregiver profesional al sistema; presión para invitar a un pediatra al sistema, que requeriría su propio rol y sus propias políticas.
