-- ============================================================================
-- Migration 008 — medical_milestones: calendario de controles pediátricos.
--
-- Hitos médicos del bebé: primer control pediátrico, pesquisa neonatal,
-- ecografía de cadera, fondo de ojo, vacunas, etc. Cada hito tiene una
-- fecha programada (`due_at`), un estado (pendiente / completado /
-- vencido — derivado de due_at + completed_at + now()) y notas.
--
-- Nivel: family_group (no child) por la misma razón que care_guides — la
-- familia puede empezar a cargar hitos durante el embarazo. Si en el
-- futuro hay múltiples niños, sumamos `child_id` opcional para
-- desambiguar; por ahora todos los hitos pertenecen al family_group.
--
-- Roles (ADR 0004 — info médica restringida a admin):
--   - SELECT: cualquier miembro (family/caregiver/viewer pueden ver).
--   - INSERT/UPDATE/DELETE: solo admin.
--
-- Soft delete + audit + trazabilidad estándar.
-- ============================================================================

create type public.milestone_category as enum (
  'control_pediatrico',
  'pesquisa',
  'estudio',
  'vacuna',
  'otro'
);

create table public.medical_milestones (
  id uuid primary key default uuid_generate_v4(),
  family_group_id uuid not null references public.family_groups(id) on delete cascade,
  category public.milestone_category not null default 'otro',
  title text not null,
  description text,
  due_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint medical_milestones_title_length check (char_length(title) between 1 and 200),
  constraint medical_milestones_description_length check (
    description is null or char_length(description) <= 2000
  ),
  constraint medical_milestones_notes_length check (
    notes is null or char_length(notes) <= 5000
  ),
  constraint medical_milestones_completed_after_creation check (
    completed_at is null or completed_at >= created_at
  )
);

create trigger trg_medical_milestones_set_updated_at
before update on public.medical_milestones
for each row execute function public.set_updated_at();

-- Index para la query típica: lista activa por familia, con próximos
-- (pendientes ordenados por due_at) primero. Mantenemos dos parciales
-- para los queries más comunes.
create index idx_medical_milestones_family_pending
  on public.medical_milestones (family_group_id, due_at asc nulls last)
  where deleted_at is null and completed_at is null;

create index idx_medical_milestones_family_completed
  on public.medical_milestones (family_group_id, completed_at desc)
  where deleted_at is null and completed_at is not null;

-- ============================================================================
-- audit_trigger_fn: agregar medical_milestones a la lista de tablas con
-- family_group_id directo.
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
    'care_guides',
    'medical_milestones'
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

create trigger trg_audit_medical_milestones
after insert or update or delete on public.medical_milestones
for each row execute function public.audit_trigger_fn();

-- ============================================================================
-- RLS — info médica restringida a admin (ADR 0004).
-- ============================================================================

alter table public.medical_milestones enable row level security;

create policy "medical_milestones: members can read"
  on public.medical_milestones
  for select
  to authenticated
  using (public.is_family_member(family_group_id));

create policy "medical_milestones: admins can create"
  on public.medical_milestones
  for insert
  to authenticated
  with check (
    public.is_family_admin(family_group_id)
    and created_by = auth.uid()
  );

create policy "medical_milestones: admins can update"
  on public.medical_milestones
  for update
  to authenticated
  using (public.is_family_admin(family_group_id))
  with check (public.is_family_admin(family_group_id));

create policy "medical_milestones: admins can delete"
  on public.medical_milestones
  for delete
  to authenticated
  using (public.is_family_admin(family_group_id));
