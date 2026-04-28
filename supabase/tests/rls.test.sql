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
-- Setup adicional para tests 7-9: insertar un ai_log en cada familia.
-- Usamos el rol postgres (BYPASSRLS por defecto en Supabase) para simular
-- el INSERT que en producción haría el admin client server-side.
-- ---------------------------------------------------------------------------

reset role;

insert into public.ai_logs (
  agent, model, prompt_tokens, completion_tokens, latency_ms, family_group_id
) values
  ('story-generator', 'anthropic/claude-haiku-4-5', 120, 480, 850, current_setting('test.family_a')::uuid),
  ('daily-summary',  'anthropic/claude-haiku-4-5',  90, 220, 540, current_setting('test.family_b')::uuid);

-- ---------------------------------------------------------------------------
-- Test 7: admin de Familia A lee solo los ai_logs de su familia
-- ---------------------------------------------------------------------------

do $$
declare
  v_count_a int;
  v_count_b_visible int;
begin
  perform pg_temp.switch_user(current_setting('test.user_admin_a')::uuid);
  set local role authenticated;

  select count(*) into v_count_a
  from public.ai_logs
  where family_group_id = current_setting('test.family_a')::uuid;

  select count(*) into v_count_b_visible
  from public.ai_logs
  where family_group_id = current_setting('test.family_b')::uuid;

  reset role;

  if v_count_a <> 1 then
    raise exception 'FAIL test 7a: admin_a should see 1 ai_log from family_a (got %)', v_count_a;
  end if;
  if v_count_b_visible <> 0 then
    raise exception 'FAIL test 7b: admin_a should not see ai_logs from family_b (got %)', v_count_b_visible;
  end if;
  raise notice 'PASS test 7: admin_a lee ai_logs propios (1) y no lee los de family_b (0)';
end;
$$;

-- ---------------------------------------------------------------------------
-- Test 8: rol family no lee ai_logs
-- ---------------------------------------------------------------------------

do $$
declare
  v_count_family int;
begin
  perform pg_temp.switch_user(current_setting('test.user_family_a')::uuid);
  set local role authenticated;

  select count(*) into v_count_family from public.ai_logs;

  reset role;

  if v_count_family <> 0 then
    raise exception 'FAIL test 8: role family should not see ai_logs (got %)', v_count_family;
  end if;
  raise notice 'PASS test 8: role family no lee ai_logs (count=0)';
end;
$$;

-- ---------------------------------------------------------------------------
-- Test 9: INSERT directo en ai_logs es rechazado para authenticated
-- (no hay policy de INSERT — solo el admin client server-side puede escribir).
-- ---------------------------------------------------------------------------

do $$
declare
  v_blocked boolean := false;
begin
  perform pg_temp.switch_user(current_setting('test.user_admin_a')::uuid);
  set local role authenticated;

  begin
    insert into public.ai_logs (agent, model, family_group_id)
    values (
      'story-generator',
      'anthropic/claude-haiku-4-5',
      current_setting('test.family_a')::uuid
    );
  exception
    when insufficient_privilege or check_violation then
      v_blocked := true;
  end;

  reset role;

  if not v_blocked then
    raise exception 'FAIL test 9: authenticated should not be able to INSERT into ai_logs';
  end if;
  raise notice 'PASS test 9: authenticated no inserta en ai_logs (RLS bloquea)';
end;
$$;

-- ---------------------------------------------------------------------------
-- Test 10: care_guides — miembro lee, no-miembro no lee
-- ---------------------------------------------------------------------------

reset role;

-- Insertamos como postgres (BYPASSRLS) una entrada de care_guide para
-- cada familia, con un autor (admin de cada una) plausible.
insert into public.care_guides (family_group_id, category, title, content, source, created_by)
values
  (
    current_setting('test.family_a')::uuid,
    'dormir',
    'Sueño seguro',
    'Boca arriba, en su Moisés. Colchón duro, sin nada alrededor.',
    'Pediatra Dra. Romero',
    current_setting('test.user_admin_a')::uuid
  ),
  (
    current_setting('test.family_b')::uuid,
    'higiene',
    'Limpieza',
    'Algodón con óleo calcáreo o agua y jabón.',
    null,
    current_setting('test.user_admin_b')::uuid
  );

do $$
declare
  v_count_a int;
  v_count_b_visible int;
begin
  perform pg_temp.switch_user(current_setting('test.user_admin_a')::uuid);
  set local role authenticated;

  select count(*) into v_count_a
  from public.care_guides
  where family_group_id = current_setting('test.family_a')::uuid;

  select count(*) into v_count_b_visible
  from public.care_guides
  where family_group_id = current_setting('test.family_b')::uuid;

  reset role;

  if v_count_a <> 1 then
    raise exception 'FAIL test 10a: admin_a should see 1 care_guide from family_a (got %)', v_count_a;
  end if;
  if v_count_b_visible <> 0 then
    raise exception 'FAIL test 10b: admin_a should not see care_guides from family_b (got %)', v_count_b_visible;
  end if;
  raise notice 'PASS test 10: admin_a lee care_guides propios (1) y no los de family_b (0)';
end;
$$;

-- ---------------------------------------------------------------------------
-- Test 11: care_guides — miembro family puede insertar (con self-attribution)
-- ---------------------------------------------------------------------------

do $$
declare
  v_inserted int := 0;
begin
  perform pg_temp.switch_user(current_setting('test.user_family_a')::uuid);
  set local role authenticated;

  insert into public.care_guides (family_group_id, category, title, content, created_by)
  values (
    current_setting('test.family_a')::uuid,
    'otros',
    'Algo que aprendí',
    'Anotación corta del rol family.',
    current_setting('test.user_family_a')::uuid
  )
  returning 1 into v_inserted;

  reset role;

  if v_inserted is null or v_inserted <> 1 then
    raise exception 'FAIL test 11: rol family debería poder insertar care_guides en su familia';
  end if;
  raise notice 'PASS test 11: rol family inserta care_guides en su familia (self-attributed)';
end;
$$;

-- ---------------------------------------------------------------------------
-- Test 12: care_guides — admin_a NO puede insertar en family_b (cross-family)
-- ---------------------------------------------------------------------------

do $$
declare
  v_blocked boolean := false;
begin
  perform pg_temp.switch_user(current_setting('test.user_admin_a')::uuid);
  set local role authenticated;

  begin
    insert into public.care_guides (family_group_id, category, title, content, created_by)
    values (
      current_setting('test.family_b')::uuid,
      'otros',
      'Cross family attempt',
      'Esto no debería pasar.',
      current_setting('test.user_admin_a')::uuid
    );
  exception
    when insufficient_privilege or check_violation then
      v_blocked := true;
  end;

  reset role;

  if not v_blocked then
    raise exception 'FAIL test 12: admin_a no debería poder insertar care_guides en family_b';
  end if;
  raise notice 'PASS test 12: admin_a no inserta care_guides cross-family (RLS bloquea)';
end;
$$;

-- ---------------------------------------------------------------------------
-- Test 13: medical_milestones — admin lee solo los propios; family lee
-- pero family de A no ve los de B.
-- ---------------------------------------------------------------------------

reset role;

insert into public.medical_milestones (
  family_group_id, category, title, description, due_at, created_by
) values
  (
    current_setting('test.family_a')::uuid,
    'pesquisa',
    'Pesquisa neonatal',
    'Le sacan sangre del talón.',
    now() + interval '5 days',
    current_setting('test.user_admin_a')::uuid
  ),
  (
    current_setting('test.family_b')::uuid,
    'control_pediatrico',
    'Primer control',
    null,
    now() + interval '7 days',
    current_setting('test.user_admin_b')::uuid
  );

do $$
declare
  v_count_a int;
  v_count_b_visible int;
begin
  perform pg_temp.switch_user(current_setting('test.user_admin_a')::uuid);
  set local role authenticated;

  select count(*) into v_count_a
  from public.medical_milestones
  where family_group_id = current_setting('test.family_a')::uuid;

  select count(*) into v_count_b_visible
  from public.medical_milestones
  where family_group_id = current_setting('test.family_b')::uuid;

  reset role;

  if v_count_a <> 1 then
    raise exception 'FAIL test 13a: admin_a debería ver 1 milestone (got %)', v_count_a;
  end if;
  if v_count_b_visible <> 0 then
    raise exception 'FAIL test 13b: admin_a no debería ver milestones de family_b (got %)', v_count_b_visible;
  end if;
  raise notice 'PASS test 13: admin_a lee milestones propios (1) y no los de family_b (0)';
end;
$$;

-- ---------------------------------------------------------------------------
-- Test 14: rol family puede LEER milestones pero NO INSERT (ADR 0004)
-- ---------------------------------------------------------------------------

do $$
declare
  v_count int;
  v_blocked boolean := false;
begin
  perform pg_temp.switch_user(current_setting('test.user_family_a')::uuid);
  set local role authenticated;

  select count(*) into v_count
  from public.medical_milestones
  where family_group_id = current_setting('test.family_a')::uuid;

  begin
    insert into public.medical_milestones (
      family_group_id, category, title, created_by
    ) values (
      current_setting('test.family_a')::uuid,
      'otro',
      'Intento de family',
      current_setting('test.user_family_a')::uuid
    );
  exception
    when insufficient_privilege or check_violation then
      v_blocked := true;
  end;

  reset role;

  if v_count <> 1 then
    raise exception 'FAIL test 14a: rol family debería leer milestones (got %)', v_count;
  end if;
  if not v_blocked then
    raise exception 'FAIL test 14b: rol family NO debería poder insertar milestones (ADR 0004)';
  end if;
  raise notice 'PASS test 14: rol family lee milestones (1) pero no inserta (RLS bloquea)';
end;
$$;

-- ---------------------------------------------------------------------------
-- Test 15: admin puede UPDATE (toggle completed) y DELETE; family no.
-- ---------------------------------------------------------------------------

do $$
declare
  v_milestone_id uuid;
  v_blocked_update boolean := false;
  v_admin_update_ok boolean := false;
begin
  -- Buscamos el milestone de family_a creado en setup del test 13.
  reset role;
  select id into v_milestone_id
  from public.medical_milestones
  where family_group_id = current_setting('test.family_a')::uuid
  limit 1;

  -- family intenta UPDATE → bloqueado.
  perform pg_temp.switch_user(current_setting('test.user_family_a')::uuid);
  set local role authenticated;

  begin
    update public.medical_milestones
    set notes = 'family intenta editar'
    where id = v_milestone_id;
    -- Si no tira error, RLS USING devolvió 0 rows actualizadas.
    if found then
      raise exception 'FAIL test 15a: family no debería poder actualizar';
    end if;
    v_blocked_update := true;
  exception
    when insufficient_privilege then
      v_blocked_update := true;
  end;

  reset role;

  -- admin SÍ puede actualizar.
  perform pg_temp.switch_user(current_setting('test.user_admin_a')::uuid);
  set local role authenticated;

  update public.medical_milestones
  set completed_at = now()
  where id = v_milestone_id;
  v_admin_update_ok := found;

  reset role;

  if not v_blocked_update then
    raise exception 'FAIL test 15a: family no debería actualizar';
  end if;
  if not v_admin_update_ok then
    raise exception 'FAIL test 15b: admin debería actualizar y FOUND debería ser true';
  end if;
  raise notice 'PASS test 15: admin actualiza milestones; family no (RLS bloquea)';
end;
$$;

-- ---------------------------------------------------------------------------
-- End of tests
-- ---------------------------------------------------------------------------

\echo '---'
\echo 'All RLS tests passed.'

rollback;
