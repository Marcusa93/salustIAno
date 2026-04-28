-- ============================================================================
-- Migration 007 — care_guides: guía de cuidado curada por la familia.
--
-- Cada entrada es una "card" con título, contenido y categoría que la
-- familia llena con lo que les fue diciendo el pediatra (medicaciones,
-- higiene, sueño seguro, controles, emergencia). Sin IA en esta capa —
-- es manual y de alto valor de día uno.
--
-- Nivel: family_group (no child). Las entradas son sobre el cuidado en
-- general y deben poder cargarse antes de que exista child_profile (típico
-- en el embarazo: ya tenés info de la pediatra antes de que el bebé nazca).
--
-- Roles (ver docs/03-roles-permisos.md):
--   - SELECT: cualquier miembro de la familia.
--   - INSERT: cualquier miembro (con autoadjudicación).
--   - UPDATE / DELETE: el autor original o un admin de la familia.
-- ============================================================================

-- Enum de categorías. Lo dejamos cerrado a los dominios que nos sirven hoy;
-- agregar valores nuevos requiere `ALTER TYPE ADD VALUE` en una migración
-- futura.
create type public.care_guide_category as enum (
  'dormir',
  'higiene',
  'alimentacion',
  'control',
  'emergencia',
  'otros'
);

create table public.care_guides (
  id uuid primary key default uuid_generate_v4(),
  family_group_id uuid not null references public.family_groups(id) on delete cascade,
  category public.care_guide_category not null default 'otros',
  title text not null,
  content text not null,
  source text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint care_guides_title_length check (char_length(title) between 1 and 200),
  constraint care_guides_content_length check (char_length(content) between 1 and 10000),
  constraint care_guides_source_length check (source is null or char_length(source) <= 200)
);

create trigger trg_care_guides_set_updated_at
before update on public.care_guides
for each row execute function public.set_updated_at();

-- Index para la query típica: lista activa por familia, ordenada por creación
-- descendente (la última entrada arriba).
create index idx_care_guides_family_active
  on public.care_guides (family_group_id, created_at desc)
  where deleted_at is null;

-- Index parcial por categoría dentro de una familia (filtros del UI).
create index idx_care_guides_family_category_active
  on public.care_guides (family_group_id, category, created_at desc)
  where deleted_at is null;

-- ============================================================================
-- audit_trigger_fn: actualizar para reconocer care_guides como tabla con
-- family_group_id directo. Antes solo conocía family_memberships,
-- invitations y child_profiles; sin esto, el log de care_guides quedaba
-- con family_group_id = null (porque caía en el branch de child_id).
--
-- CREATE OR REPLACE conserva firma; SECURITY DEFINER y search_path se
-- mantienen idénticos al original (ver migración 003).
-- ============================================================================

create or replace function public.audit_trigger_fn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action public.audit_action;
  v_record_id uuid;
  v_family_group_id uuid;
  v_old jsonb;
  v_new jsonb;
  v_row jsonb;
  v_child_id uuid;
begin
  if tg_op = 'INSERT' then
    v_action := 'insert';
    v_record_id := new.id;
    v_old := null;
    v_new := to_jsonb(new);
    v_row := v_new;
  elsif tg_op = 'DELETE' then
    v_action := 'hard_delete';
    v_record_id := old.id;
    v_old := to_jsonb(old);
    v_new := null;
    v_row := v_old;
  else
    if old.deleted_at is null and new.deleted_at is not null then
      v_action := 'soft_delete';
    elsif old.deleted_at is not null and new.deleted_at is null then
      v_action := 'restore';
    else
      v_action := 'update';
    end if;
    v_record_id := new.id;
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    v_row := v_new;
  end if;

  if tg_table_name = 'family_groups' then
    v_family_group_id := v_record_id;
  elsif tg_table_name in (
    'family_memberships',
    'invitations',
    'child_profiles',
    'care_guides'
  ) then
    v_family_group_id := (v_row->>'family_group_id')::uuid;
  else
    v_child_id := (v_row->>'child_id')::uuid;
    v_family_group_id := public.child_family_group_id(v_child_id);
  end if;

  insert into public.audit_logs (
    family_group_id,
    actor_user_id,
    action,
    table_name,
    record_id,
    old_data,
    new_data
  ) values (
    v_family_group_id,
    auth.uid(),
    v_action,
    tg_table_name,
    v_record_id,
    v_old,
    v_new
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Trigger en care_guides (después de actualizar la función).
create trigger trg_audit_care_guides
after insert or update or delete on public.care_guides
for each row execute function public.audit_trigger_fn();

-- ============================================================================
-- RLS
-- ============================================================================

alter table public.care_guides enable row level security;

create policy "care_guides: members can read"
  on public.care_guides
  for select
  to authenticated
  using (public.is_family_member(family_group_id));

create policy "care_guides: members can create (self-attributed)"
  on public.care_guides
  for insert
  to authenticated
  with check (
    public.is_family_member(family_group_id)
    and created_by = auth.uid()
  );

create policy "care_guides: author or admin can update"
  on public.care_guides
  for update
  to authenticated
  using (
    created_by = auth.uid()
    or public.is_family_admin(family_group_id)
  )
  with check (
    created_by = auth.uid()
    or public.is_family_admin(family_group_id)
  );

create policy "care_guides: author or admin can delete"
  on public.care_guides
  for delete
  to authenticated
  using (
    created_by = auth.uid()
    or public.is_family_admin(family_group_id)
  );
