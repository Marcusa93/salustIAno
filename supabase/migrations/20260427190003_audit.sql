-- ============================================================================
-- Migration 003 — Auditoría inmutable.
--
-- audit_trigger_fn() registra cada INSERT/UPDATE/DELETE en audit_logs.
-- Es SECURITY DEFINER + search_path pinneado para que el INSERT en audit_logs
-- ocurra incluso cuando el rol de aplicación no tiene policies de escritura
-- sobre esa tabla (ningún rol las tiene; ver migration 004).
--
-- Action codes:
--   INSERT                                     → 'insert'
--   DELETE                                     → 'hard_delete'
--   UPDATE setting deleted_at NULL → NOT NULL  → 'soft_delete'
--   UPDATE setting deleted_at NOT NULL → NULL  → 'restore'
--   Cualquier otro UPDATE                      → 'update'
--
-- Resolución de family_group_id:
--   - family_groups        → record_id (la fila ES el family_group)
--   - family_memberships,
--     invitations,
--     child_profiles       → row.family_group_id (columna directa)
--   - tablas de eventos    → child_family_group_id(row.child_id)
--
-- El trigger se aplica a 9 tablas. invitations queda fuera deliberadamente
-- (es inmutable por diseño y no necesita timeline). audit_logs tampoco se
-- audita (sería recursivo).
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
  -- 1. action + record_id + payload --------------------------------------
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
    -- UPDATE: distinguir soft_delete / restore / update normal.
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

  -- 2. family_group_id según la tabla ------------------------------------
  if tg_table_name = 'family_groups' then
    v_family_group_id := v_record_id;
  elsif tg_table_name in ('family_memberships', 'invitations', 'child_profiles') then
    v_family_group_id := (v_row->>'family_group_id')::uuid;
  else
    v_child_id := (v_row->>'child_id')::uuid;
    v_family_group_id := public.child_family_group_id(v_child_id);
  end if;

  -- 3. INSERT en audit_logs ----------------------------------------------
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

  -- 4. Return apropiado ---------------------------------------------------
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

comment on function public.audit_trigger_fn() is
  'Registra mutaciones en audit_logs. SECURITY DEFINER para bypassear RLS. '
  'Fire AFTER INSERT/UPDATE/DELETE FOR EACH ROW en tablas sensibles.';

-- Triggers ------------------------------------------------------------------

create trigger trg_audit_family_groups
after insert or update or delete on public.family_groups
for each row execute function public.audit_trigger_fn();

create trigger trg_audit_family_memberships
after insert or update or delete on public.family_memberships
for each row execute function public.audit_trigger_fn();

create trigger trg_audit_child_profiles
after insert or update or delete on public.child_profiles
for each row execute function public.audit_trigger_fn();

create trigger trg_audit_child_measurements
after insert or update or delete on public.child_measurements
for each row execute function public.audit_trigger_fn();

create trigger trg_audit_sleep_sessions
after insert or update or delete on public.sleep_sessions
for each row execute function public.audit_trigger_fn();

create trigger trg_audit_feeding_events
after insert or update or delete on public.feeding_events
for each row execute function public.audit_trigger_fn();

create trigger trg_audit_diaper_events
after insert or update or delete on public.diaper_events
for each row execute function public.audit_trigger_fn();

create trigger trg_audit_notes
after insert or update or delete on public.notes
for each row execute function public.audit_trigger_fn();

create trigger trg_audit_media_items
after insert or update or delete on public.media_items
for each row execute function public.audit_trigger_fn();
