-- ============================================================================
-- Migration 022 — family_memories: memoria persistente cross-session de SalustIA.
--
-- Hasta acá el chat sólo recordaba los últimos 30 mensajes literales. Cuando
-- la familia decía "recordá que la obra social es OSDE", al rato el modelo
-- ya no lo tenía. Esta tabla guarda hechos persistentes que la familia
-- explícitamente le pide al chat que recuerde, y que el agente reinjecta al
-- system prompt en cada turno.
--
-- Decisiones:
--   - Memoria por familia (no por user). La obra social, el pediatra,
--     alergias, miedos típicos, son cosas que TODOS los miembros activos
--     deberían ver. Hay un flag `private_to_user` para casos personales
--     (ej. "anotame que tengo turno con la obstetra" — eso es del user).
--   - Sin tipos/categorías por ahora. content libre + kind opcional para
--     futura UI de gestión sin migration.
--   - Soft delete, audit trail intacto.
--   - Cota dura de tamaño (500 chars) y cantidad por familia (manejada en
--     app + un índice limitado por la app, no constraint duro acá).
--   - Insert vía proposal flow (igual que feeding/sleep/diaper) — la
--     familia confirma con un botón antes de persistir.
-- ============================================================================

create table if not exists public.family_memories (
  id uuid primary key default uuid_generate_v4(),
  family_group_id uuid not null references public.family_groups(id) on delete cascade,
  -- Cuando NO es null, sólo ese user lo ve. Default null → memoria de
  -- la familia entera.
  private_to_user uuid references auth.users(id) on delete cascade,
  content text not null,
  -- Categorización opcional para futura UI ("salud", "preferencia",
  -- "logística"). El agente puede dejarlo en null en v1.
  kind text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint family_memories_content_length check (char_length(content) between 1 and 500),
  constraint family_memories_kind_length check (kind is null or char_length(kind) between 1 and 40)
);

create index if not exists family_memories_family_active_idx
  on public.family_memories (family_group_id, created_at desc)
  where deleted_at is null;

create index if not exists family_memories_user_active_idx
  on public.family_memories (private_to_user)
  where private_to_user is not null and deleted_at is null;

drop trigger if exists trg_family_memories_set_updated_at on public.family_memories;
create trigger trg_family_memories_set_updated_at
before update on public.family_memories
for each row execute function public.set_updated_at();

comment on table public.family_memories is
  'Hechos persistentes que SalustIA recuerda entre sesiones. Inyectados en el '
  'system prompt cada turno. Memoria compartida por familia salvo private_to_user.';

-- RLS ----------------------------------------------------------------------

alter table public.family_memories enable row level security;

-- SELECT: miembro de la familia, y si es privada, debe ser el dueño.
drop policy if exists "family_memories: select propios o de familia" on public.family_memories;
create policy "family_memories: select propios o de familia" on public.family_memories
  for select using (
    public.is_family_member(family_group_id)
    and deleted_at is null
    and (private_to_user is null or private_to_user = auth.uid())
  );

-- INSERT: tiene que ser miembro y el created_by tiene que ser él. Si la
-- memoria es privada, sólo puede serlo del propio user (no podés crear
-- una memoria privada "para otro").
drop policy if exists "family_memories: insert por miembro" on public.family_memories;
create policy "family_memories: insert por miembro" on public.family_memories
  for insert with check (
    public.is_family_member(family_group_id)
    and created_by = auth.uid()
    and (private_to_user is null or private_to_user = auth.uid())
  );

-- UPDATE: el creador o un admin de la familia. Cubre soft-delete.
drop policy if exists "family_memories: update propios o admin" on public.family_memories;
create policy "family_memories: update propios o admin" on public.family_memories
  for update using (
    auth.uid() = created_by or public.is_family_admin(family_group_id)
  ) with check (
    public.is_family_member(family_group_id)
    and (private_to_user is null or private_to_user = auth.uid())
  );

-- DELETE duro: sólo admin de la familia (los users normales soft-deletean).
drop policy if exists "family_memories: delete admin" on public.family_memories;
create policy "family_memories: delete admin" on public.family_memories
  for delete using (
    public.is_family_admin(family_group_id)
  );
