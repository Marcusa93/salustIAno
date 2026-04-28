-- ============================================================================
-- Migration 002 — Funciones helper.
--
-- Dos grupos:
--
--   1. Permisos / membership (SECURITY DEFINER, search_path pinneado a public).
--      Necesitan saltearse RLS de family_memberships para evitar dependencias
--      circulares: la propia policy de family_memberships consulta estas
--      funciones, así que si la función fuera INVOKER y el caller no tuviera
--      acceso a la tabla, el lookup retornaría false negativo. Devuelven sólo
--      booleanos/uuids basados en auth.uid(); no exponen filas.
--
--   2. Edad del niño (SECURITY INVOKER). El caller ya tiene acceso a
--      child_profiles vía RLS si es miembro; estas funciones se apoyan en eso.
--
-- Todas las funciones son STABLE (mismo input → mismo output dentro de una
-- transacción) o IMMUTABLE; ninguna escribe.
-- ============================================================================

-- 1. Permisos --------------------------------------------------------------

create or replace function public.is_family_member(p_family_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.family_memberships
    where family_group_id = p_family_group_id
      and user_id = auth.uid()
      and deleted_at is null
  );
$$;

comment on function public.is_family_member(uuid) is
  'TRUE si auth.uid() es miembro activo del family_group dado.';

create or replace function public.is_family_admin(p_family_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.family_memberships
    where family_group_id = p_family_group_id
      and user_id = auth.uid()
      and role = 'admin'::public.family_role
      and deleted_at is null
  );
$$;

comment on function public.is_family_admin(uuid) is
  'TRUE si auth.uid() es admin activo del family_group dado.';

create or replace function public.is_family_caregiver_or_admin(p_family_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.family_memberships
    where family_group_id = p_family_group_id
      and user_id = auth.uid()
      and role in ('admin'::public.family_role, 'caregiver'::public.family_role)
      and deleted_at is null
  );
$$;

comment on function public.is_family_caregiver_or_admin(uuid) is
  'TRUE si auth.uid() es admin o caregiver activo del family_group dado.';

create or replace function public.user_family_group_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select family_group_id
  from public.family_memberships
  where user_id = auth.uid()
    and deleted_at is null;
$$;

comment on function public.user_family_group_ids() is
  'IDs de los family_groups donde auth.uid() tiene membership activa.';

create or replace function public.child_family_group_id(p_child_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select family_group_id
  from public.child_profiles
  where id = p_child_id
    and deleted_at is null;
$$;

comment on function public.child_family_group_id(uuid) is
  'family_group_id del child_profile dado, NULL si no existe o está borrado.';

-- 2. Edad del niño ---------------------------------------------------------

create or replace function public.child_chronological_age_days(p_child_id uuid)
returns integer
language sql
stable
security invoker
as $$
  select (current_date - birth_date)::integer
  from public.child_profiles
  where id = p_child_id
    and deleted_at is null
    and birth_date is not null;
$$;

comment on function public.child_chronological_age_days(uuid) is
  'Edad cronológica en días (CURRENT_DATE - birth_date). NULL si no hay '
  'birth_date o el child está soft-deleted.';

create or replace function public.child_corrected_age_days(p_child_id uuid)
returns integer
language sql
stable
security invoker
as $$
  -- Si el bebé es preterm (gest_weeks < 37), restamos las semanas que
  -- faltaron para 40, expresadas en días. Si es término o no se conoce
  -- la edad gestacional, devolvemos la edad cronológica.
  select case
    when c.gestational_weeks_at_birth is null or c.gestational_weeks_at_birth >= 37
      then (current_date - c.birth_date)::integer
    else (current_date - c.birth_date)::integer - ((40 - c.gestational_weeks_at_birth) * 7)
  end
  from public.child_profiles c
  where c.id = p_child_id
    and c.deleted_at is null
    and c.birth_date is not null;
$$;

comment on function public.child_corrected_age_days(uuid) is
  'Edad corregida en días (cronológica − semanas faltantes para 40, si '
  'preterm). Si el bebé fue de término o no se conoce gest_weeks, devuelve '
  'la edad cronológica. NULL si no hay birth_date o está soft-deleted.';
