-- ============================================================================
-- Migration 013 — Biblioteca de cuentos generados.
--
-- Mismo motivo que las canciones: cada generación gasta tokens y la familia
-- los usa varias veces (un cuento se vuelve a leer en distintas noches).
-- Persistimos lo generado para que la biblioteca crezca y el costo
-- se amortice. RLS por familia, soft-delete.
-- ============================================================================

create table public.stories (
  id uuid primary key default uuid_generate_v4(),
  child_id uuid references public.child_profiles(id) on delete cascade,
  family_group_id uuid not null references public.family_groups(id) on delete cascade,

  title text not null,
  story text not null,
  moral_or_theme text not null,
  characters_used jsonb not null default '[]'::jsonb,

  -- Input que generó el cuento (moment, characters, duration, etc.) —
  -- útil para "regenerar con los mismos parámetros" después.
  input_meta jsonb not null default '{}'::jsonb,
  generation_meta jsonb not null default '{}'::jsonb,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index stories_family_active_idx
  on public.stories (family_group_id, created_at desc)
  where deleted_at is null;

create trigger trg_stories_set_updated_at
before update on public.stories
for each row execute function public.set_updated_at();

comment on table public.stories is
  'Biblioteca de cuentos generados. Permite re-leer sin re-pagar tokens del LLM.';

alter table public.stories enable row level security;

create policy "stories: select por familia" on public.stories
  for select using (
    public.is_family_member(family_group_id)
    and deleted_at is null
  );

create policy "stories: insert por miembro" on public.stories
  for insert with check (public.is_family_member(family_group_id));

create policy "stories: update propios" on public.stories
  for update using (
    auth.uid() = created_by
    or public.is_family_admin(family_group_id)
  );
