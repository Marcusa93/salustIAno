-- ============================================================================
-- Migration 025 — family_invitations: códigos de invitación para sumar miembros.
--
-- Por qué: hasta acá había dos puertas para entrar a Salu:
--   (a) /signup público + bootstrap-family que creaba un grupo nuevo —
--       generaba familias vacías y aisladas si la persona no era invitada
--       primero por el admin.
--   (b) /familia/miembros con createMemberAction (admin client) — el admin
--       crea el user con password temporal y lo invita en presencia.
--
-- Ahora cerramos (a) y la reemplazamos por un código que cualquier admin
-- genera desde /familia y comparte por afuera (WhatsApp, mail, lo que sea).
-- El invitee entra a /signup, pega el código + crea su password, y la
-- redención lo une al grupo del código respetando el rol que el admin
-- definió. La opción (b) sigue intacta.
--
-- Schema:
--   - code: corto y legible (formato XXXX-XXXX). Único entre activos.
--   - role: el rol que va a tener al redimir. El admin lo decide al
--     generar — ej. abuelas con role=family (solo lectura+notas).
--   - expires_at: por default 7 días. Después no se puede redimir aunque
--     el código no haya sido usado.
--   - redeemed_at + redeemed_by: single-use. Una vez redimido, el mismo
--     código no entra de nuevo. Si la persona pierde su acceso, el admin
--     genera otro código.
--   - revoked_at: el admin puede invalidar un código antes de que se use
--     ("se lo mandé a la persona equivocada").
--
-- RLS:
--   - SELECT/INSERT/UPDATE/DELETE: solo admins del family_group_id.
--   - El redeem corre con admin client server-side (signup actions),
--     bypaseando RLS — es la única forma de insertar la membership en
--     un grupo del que el invitee todavía no es miembro.
-- ============================================================================

create table if not exists public.family_invitations (
  id uuid primary key default gen_random_uuid(),
  family_group_id uuid not null references public.family_groups(id) on delete cascade,
  code text not null,
  role public.family_role not null default 'caregiver',
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redeemed_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

-- El código es único solo entre los que todavía pueden ser redimidos.
-- Permitimos que un código antiguo (ya usado o revocado) reuse el string
-- si el RNG repite (improbable con 8 chars, pero el partial unique
-- protege la propiedad sin frenar limpieza histórica).
create unique index if not exists family_invitations_code_active
  on public.family_invitations (code)
  where redeemed_at is null and revoked_at is null;

create index if not exists family_invitations_group_active
  on public.family_invitations (family_group_id, created_at desc)
  where redeemed_at is null and revoked_at is null;

alter table public.family_invitations enable row level security;

drop policy if exists "family_invitations: admins read" on public.family_invitations;
create policy "family_invitations: admins read"
  on public.family_invitations
  for select
  to authenticated
  using (public.is_family_admin(family_group_id));

drop policy if exists "family_invitations: admins create" on public.family_invitations;
create policy "family_invitations: admins create"
  on public.family_invitations
  for insert
  to authenticated
  with check (
    public.is_family_admin(family_group_id)
    and created_by = auth.uid()
  );

drop policy if exists "family_invitations: admins update" on public.family_invitations;
create policy "family_invitations: admins update"
  on public.family_invitations
  for update
  to authenticated
  using (public.is_family_admin(family_group_id))
  with check (public.is_family_admin(family_group_id));

drop policy if exists "family_invitations: admins delete" on public.family_invitations;
create policy "family_invitations: admins delete"
  on public.family_invitations
  for delete
  to authenticated
  using (public.is_family_admin(family_group_id));
