# 0015 — Superadmin como flag en app_metadata de Supabase Auth

**Estado:** aceptada
**Fecha:** 2026-10-16

## Contexto

Los admins de la familia (mamá y papá) gestionan miembros con límites pensados para que ninguno deje afuera al otro por error: un admin no crea admins, no gestiona a otros admins y "sacar" a alguien no borra su cuenta. Marco necesita poder hacer todo eso para mantener la familia ordenada: dar de alta otro admin, resetearle la contraseña a cualquiera y borrar cuentas que sobran (como una de prueba). Abril, en cambio, sigue siendo admin con los límites de siempre.

## Decisión

Marcamos al superadmin con `app_metadata.superadmin = true` en Supabase Auth. Las server actions lo leen del user que verifica `supabase.auth.getUser()`, y la regla completa de qué puede hacer cada quien vive en `src/lib/family-permissions.ts`, que usan tanto el servidor como la pantalla. El flag se pone o se saca con `scripts/admin/set-superadmin.mjs`.

## Alternativas consideradas

- **Un rol `superadmin` en el enum `family_role`.** Mezcla "dueño del sistema" con "rol dentro de una familia", obliga a tocar el enum y todas las policies que comparan roles, y requiere una migración. Descartado.
- **Una tabla `superadmins` o una columna en `family_memberships`.** Necesita migración y policies nuevas para algo que hoy tiene una sola persona. Puede tener sentido si algún día hay varias familias con dueños distintos.
- **Una variable de entorno con los emails habilitados.** Funciona, pero cambiar quién es superadmin exige redeploy, y un email en una variable es más fácil de equivocar que un flag en la cuenta.

## Consecuencias

- `app_metadata` solo se escribe con la secret key: nadie se puede dar el permiso a sí mismo desde la app.
- El chequeo es en código (como el resto de la gestión de miembros, que ya usa el cliente admin después de verificar el rol), no en RLS. Si en el futuro estas operaciones pasan a RLS, el flag está disponible en el JWT (`auth.jwt() -> 'app_metadata'`).
- Nadie gestiona a un superadmin ni a sí mismo desde la lista: el dueño no puede quedar bloqueado por otro admin.
- Borrar una cuenta con historial no siempre se puede hacer en duro: varias tablas referencian `auth.users` sin `on delete cascade`. En ese caso la cuenta se da de baja en Auth (soft delete) y su membresía se marca como borrada.
