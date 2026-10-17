# Roles y permisos

El sistema utiliza control de acceso basado en roles, anclado en políticas de Row Level Security de Postgres. Cuatro roles iniciales son suficientes.

## Roles

| Rol | Alcance |
|-----|---------|
| **Admin** | Padre y madre. Acceso total, incluye edición de datos médicos, borrado, gestión de invitaciones y validación de cargas de otros familiares. |
| **Caregiver** | Cuidador o cuidadora frecuente. Carga todos los eventos de cuidado, lee todo, no edita perfil ni elimina registros. |
| **Family** | Abuelos, tíos. Cargan memorias, notas y fotos. Leen la mayoría de los datos. No ven detalle de salud salvo permiso explícito. |
| **Viewer** | Solo lectura del timeline público de la familia. |

## Gestión de miembros y superadmin

Desde **Familia → Miembros**, un admin crea miembros (con contraseña temporal que se cambia en el primer ingreso), les cambia el rol, les resetea la contraseña y los saca de la familia. Hay dos límites: un admin común no crea ni nombra admins, y no gestiona a otros admins. Así ninguno de los padres puede dejar sin acceso al otro por error.

El **superadmin** es una marca aparte, no un quinto rol. Es el flag `superadmin: true` en `app_metadata` de Supabase Auth, que solo se escribe con la secret key (`scripts/admin/set-superadmin.mjs`). Hoy lo tiene solo Marco. Sobre lo que puede hacer un admin, el superadmin además:

- crea admins y nombra admin a un miembro existente;
- gestiona a otros admins: les cambia el rol, les resetea la contraseña y los saca;
- borra cuentas del todo. Si la cuenta tiene historial que la base no deja borrar, se da de baja en Auth: no puede volver a entrar, su email queda libre y los registros de la familia se conservan.

Nadie se gestiona a sí mismo desde esa pantalla (eso va en /perfil) y nadie gestiona a un superadmin. La regla vive en un solo lugar, `src/lib/family-permissions.ts`, y la usan tanto las server actions como la pantalla. Ver [ADR 0015](../decisions/0015-superadmin.md).

## Pediatra invitado: postergado deliberadamente

El rol de pediatra invitado se posterga deliberadamente. Que un profesional acceda a datos a través de la app trae implicancias de historia clínica bajo la Ley 26.529 que conviene no enfrentar antes de tiempo.

Mientras tanto, la herramienta para llevar al pediatra es un resumen exportable en PDF, generado por IA en modo borrador y revisado por los padres antes de imprimirse. El pediatra recibe un documento, no un acceso.

## Validación de cargas

La edición de datos médicos cargados por un familiar siempre requiere validación de un administrador antes de impactar en cualquier resumen de IA. Los campos `validated_by` y `validated_at` modelan esa regla. Si un abuelo carga "Salu tuvo fiebre el martes" desde su rol Family, ese dato existe pero no entra al resumen para pediatra hasta que mamá o papá lo confirmen.

## Implementación técnica

RLS en Postgres es la única defensa real. Toda tabla con datos del niño tiene `family_group_id` no nulo y una política que cruza con `family_memberships` del usuario autenticado. La política se escribe una vez, se prueba con tests automatizados que intentan leer datos cruzados entre familias, y esos tests deben fallar antes de cada deploy.

La arquitectura de control de acceso de la aplicación no debe duplicar la lógica de RLS. Si la app permite algo que RLS prohíbe, RLS gana; si RLS permite algo que la app debería prohibir, hay un bug en RLS y se corrige ahí. La defensa es una sola.
