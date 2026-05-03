-- ============================================================================
-- Migration 021 — Comentarios en eventos / notas.
--
-- Tabla genérica para que la familia "converse" sobre un evento puntual:
-- una toma, una nota, un milestone. target_type discrimina, target_id es el
-- UUID del row al que apunta. No hay FK estricta porque la tabla destino
-- depende del target_type — se valida via app + RLS.
--
-- Uso v1 (en /notas/[id]/page.tsx): solo target_type='note'. Se extenderá
-- a otros tipos cuando se requiera.
-- ============================================================================

do $$ begin
  create type public.comment_target as enum (
    'note',
    'feeding',
    'sleep',
    'diaper',
    'milestone',
    'media'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.event_comments (
  id uuid primary key default uuid_generate_v4(),
  family_group_id uuid not null references public.family_groups(id) on delete cascade,
  target_type public.comment_target not null,
  target_id uuid not null,
  content text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint event_comments_content_length check (char_length(content) between 1 and 500)
);

create index if not exists event_comments_target_idx
  on public.event_comments (target_type, target_id, created_at)
  where deleted_at is null;

create index if not exists event_comments_family_active_idx
  on public.event_comments (family_group_id, created_at desc)
  where deleted_at is null;

drop trigger if exists trg_event_comments_set_updated_at on public.event_comments;
create trigger trg_event_comments_set_updated_at
before update on public.event_comments
for each row execute function public.set_updated_at();

alter table public.event_comments enable row level security;

drop policy if exists "event_comments: select por familia" on public.event_comments;
create policy "event_comments: select por familia" on public.event_comments
  for select using (
    public.is_family_member(family_group_id) and deleted_at is null
  );

drop policy if exists "event_comments: insert por miembro" on public.event_comments;
create policy "event_comments: insert por miembro" on public.event_comments
  for insert with check (
    public.is_family_member(family_group_id)
    and created_by = auth.uid()
  );

drop policy if exists "event_comments: update propios" on public.event_comments;
create policy "event_comments: update propios" on public.event_comments
  for update using (
    auth.uid() = created_by or public.is_family_admin(family_group_id)
  );

drop policy if exists "event_comments: delete propios o admin" on public.event_comments;
create policy "event_comments: delete propios o admin" on public.event_comments
  for delete using (
    auth.uid() = created_by or public.is_family_admin(family_group_id)
  );
