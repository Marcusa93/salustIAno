-- ============================================================================
-- RLS regression tests para Salu.
--
-- Crea un escenario con dos familias y tres usuarios, ejecuta seis tests
-- contra las policies, y rollbackea todo. No deja datos persistentes —
-- safe para correr contra cualquier DB (incluyendo el remoto vacío).
--
-- Uso:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.test.sql
--
-- Convención: cada test imprime 'PASS: <descripción>' o lanza RAISE EXCEPTION.
-- Con ON_ERROR_STOP=1, el primer FAIL aborta y deja a psql con exit code != 0.
-- ============================================================================

\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------------------
-- Setup
-- ---------------------------------------------------------------------------

-- IDs determinísticos para hacer el test reproducible y debuggear fácil.
select set_config('test.user_admin_a',  '00000000-0000-0000-0000-00000000a001', true);
select set_config('test.user_admin_b',  '00000000-0000-0000-0000-00000000a002', true);
select set_config('test.user_family_a', '00000000-0000-0000-0000-00000000a003', true);
select set_config('test.family_a',      '00000000-0000-0000-0000-00000000f001', true);
select set_config('test.family_b',      '00000000-0000-0000-0000-00000000f002', true);
select set_config('test.child_a',       '00000000-0000-0000-0000-00000000c001', true);
select set_config('test.child_b',       '00000000-0000-0000-0000-00000000c002', true);

-- Tres users: admin_a y family_a en family_a; admin_b en family_b.
insert into auth.users (id, email, aud, role)
values
  (current_setting('test.user_admin_a')::uuid,  'admin_a@test.local',  'authenticated', 'authenticated'),
  (current_setting('test.user_admin_b')::uuid,  'admin_b@test.local',  'authenticated', 'authenticated'),
  (current_setting('test.user_family_a')::uuid, 'family_a@test.local', 'authenticated', 'authenticated');

-- Dos familias.
insert into public.family_groups (id, name)
values
  (current_setting('test.family_a')::uuid, 'Familia A'),
  (current_setting('test.family_b')::uuid, 'Familia B');

-- Memberships:
--   admin_a  → admin de family_a
--   family_a → family de family_a
--   admin_b  → admin de family_b
insert into public.family_memberships (family_group_id, user_id, role)
values
  (current_setting('test.family_a')::uuid, current_setting('test.user_admin_a')::uuid,  'admin'),
  (current_setting('test.family_a')::uuid, current_setting('test.user_family_a')::uuid, 'family'),
  (current_setting('test.family_b')::uuid, current_setting('test.user_admin_b')::uuid,  'admin');

-- Un niño por familia.
insert into public.child_profiles (id, family_group_id, name, birth_date)
values
  (current_setting('test.child_a')::uuid, current_setting('test.family_a')::uuid, 'Salu A', '2026-04-01'),
  (current_setting('test.child_b')::uuid, current_setting('test.family_b')::uuid, 'Salu B', '2026-04-15');

-- ---------------------------------------------------------------------------
-- Helper: switch_user(user_id) — setea JWT claims y SET LOCAL ROLE.
-- ---------------------------------------------------------------------------

create or replace function pg_temp.switch_user(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user_id::text, 'role', 'authenticated')::text,
    true
  );
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Test 1: admin_a (familia A) NO lee family_groups de familia B
-- ---------------------------------------------------------------------------

do $$
declare
  v_count int;
begin
  perform pg_temp.switch_user(current_setting('test.user_admin_a')::uuid);
  set local role authenticated;

  select count(*) into v_count
  from public.family_groups
  where id = current_setting('test.family_b')::uuid;

  reset role;

  if v_count <> 0 then
    raise exception 'FAIL test 1: admin_a should not see family_b (got count=%)', v_count;
  end if;
  raise notice 'PASS test 1: admin_a no lee family_groups de familia B (count=0)';
end;
$$;

-- ---------------------------------------------------------------------------
-- Test 2: admin_a NO lee child_profiles de familia B
-- ---------------------------------------------------------------------------

do $$
declare
  v_count int;
begin
  perform pg_temp.switch_user(current_setting('test.user_admin_a')::uuid);
  set local role authenticated;

  select count(*) into v_count
  from public.child_profiles
  where family_group_id = current_setting('test.family_b')::uuid;

  reset role;

  if v_count <> 0 then
    raise exception 'FAIL test 2: admin_a should not see child_profiles de familia B (got count=%)', v_count;
  end if;
  raise notice 'PASS test 2: admin_a no lee child_profiles de familia B (count=0)';
end;
$$;

-- ---------------------------------------------------------------------------
-- Test 3: admin_a NO inserta sleep_sessions sobre child de familia B
-- ---------------------------------------------------------------------------

do $$
declare
  v_blocked boolean := false;
begin
  perform pg_temp.switch_user(current_setting('test.user_admin_a')::uuid);
  set local role authenticated;

  begin
    insert into public.sleep_sessions (child_id, started_at, created_by)
    values (
      current_setting('test.child_b')::uuid,
      now() - interval '1 hour',
      current_setting('test.user_admin_a')::uuid
    );
  exception
    when insufficient_privilege or check_violation then
      v_blocked := true;
  end;

  reset role;

  if not v_blocked then
    raise exception 'FAIL test 3: admin_a should not be able to insert sleep_session in family_b child';
  end if;
  raise notice 'PASS test 3: admin_a no inserta en sleep_sessions de child de familia B';
end;
$$;

-- ---------------------------------------------------------------------------
-- Test 4: family_a (rol 'family' en familia A) NO inserta child_measurements
--         (ADR 0004 — solo admin carga datos médicos)
-- ---------------------------------------------------------------------------

do $$
declare
  v_blocked boolean := false;
begin
  perform pg_temp.switch_user(current_setting('test.user_family_a')::uuid);
  set local role authenticated;

  begin
    insert into public.child_measurements (
      child_id, measured_at, weight_grams, created_by
    ) values (
      current_setting('test.child_a')::uuid,
      now(),
      4500,
      current_setting('test.user_family_a')::uuid
    );
  exception
    when insufficient_privilege or check_violation then
      v_blocked := true;
  end;

  reset role;

  if not v_blocked then
    raise exception 'FAIL test 4: role family should not insert child_measurements (ADR 0004)';
  end if;
  raise notice 'PASS test 4: role family no inserta child_measurements (ADR 0004)';
end;
$$;

-- ---------------------------------------------------------------------------
-- Test 5: family_a SÍ inserta notes y SÍ lee child_profiles de su familia
-- ---------------------------------------------------------------------------

do $$
declare
  v_inserted int := 0;
  v_visible_children int := 0;
begin
  perform pg_temp.switch_user(current_setting('test.user_family_a')::uuid);
  set local role authenticated;

  insert into public.notes (child_id, content, created_by)
  values (
    current_setting('test.child_a')::uuid,
    'Salu sonrió por primera vez',
    current_setting('test.user_family_a')::uuid
  )
  returning 1 into v_inserted;

  select count(*) into v_visible_children
  from public.child_profiles
  where family_group_id = current_setting('test.family_a')::uuid;

  reset role;

  if v_inserted is null or v_inserted <> 1 then
    raise exception 'FAIL test 5a: role family should be able to insert notes';
  end if;
  if v_visible_children <> 1 then
    raise exception 'FAIL test 5b: role family should see child_profiles of own family (got count=%)', v_visible_children;
  end if;
  raise notice 'PASS test 5: role family inserta notes y lee child_profiles propios';
end;
$$;

-- ---------------------------------------------------------------------------
-- Test 6: audit_logs — family no lee, admin sí lee
-- ---------------------------------------------------------------------------

do $$
declare
  v_count_family int;
  v_count_admin int;
begin
  -- Como rol family
  perform pg_temp.switch_user(current_setting('test.user_family_a')::uuid);
  set local role authenticated;
  select count(*) into v_count_family from public.audit_logs;
  reset role;

  -- Como admin
  perform pg_temp.switch_user(current_setting('test.user_admin_a')::uuid);
  set local role authenticated;
  select count(*) into v_count_admin
  from public.audit_logs
  where family_group_id = current_setting('test.family_a')::uuid;
  reset role;

  if v_count_family <> 0 then
    raise exception 'FAIL test 6a: role family should not see audit_logs (got count=%)', v_count_family;
  end if;
  if v_count_admin <= 0 then
    raise exception 'FAIL test 6b: admin should see audit_logs of own family (got count=%)', v_count_admin;
  end if;
  raise notice 'PASS test 6: family no lee audit_logs (0); admin lee audit_logs propios (% rows)', v_count_admin;
end;
$$;

-- ---------------------------------------------------------------------------
-- End of tests
-- ---------------------------------------------------------------------------

\echo '---'
\echo 'All RLS tests passed.'

rollback;
