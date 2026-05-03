-- ============================================================================
-- Migration 015 — Persistir borradores de control pediátrico.
--
-- Cada generación pide tokens al LLM. Si la familia genera el resumen el
-- lunes para llevarlo el martes al control, no tiene sentido regenerar.
-- Guardamos el último (o varios) por familia + período.
-- ============================================================================

create table public.pediatric_summaries (
  id uuid primary key default uuid_generate_v4(),
  child_id uuid references public.child_profiles(id) on delete cascade,
  family_group_id uuid not null references public.family_groups(id) on delete cascade,

  days_back int not null check (days_back in (7, 14, 30)),
  period_label text not null,
  headline text not null,
  metrics jsonb not null,
  observations jsonb not null default '[]'::jsonb,
  questions jsonb not null default '[]'::jsonb,
  pending_milestones jsonb not null default '[]'::jsonb,

  generation_meta jsonb not null default '{}'::jsonb,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index pediatric_summaries_family_active_idx
  on public.pediatric_summaries (family_group_id, created_at desc)
  where deleted_at is null;

comment on table public.pediatric_summaries is
  'Borradores generados por el agente pediatric-prep. Persistir evita re-pagar tokens y facilita comparar entre generaciones.';

alter table public.pediatric_summaries enable row level security;

create policy "ped_summaries: select por familia" on public.pediatric_summaries
  for select using (
    public.is_family_member(family_group_id) and deleted_at is null
  );

create policy "ped_summaries: insert por miembro" on public.pediatric_summaries
  for insert with check (public.is_family_member(family_group_id));

create policy "ped_summaries: update propios" on public.pediatric_summaries
  for update using (
    auth.uid() = created_by or public.is_family_admin(family_group_id)
  );
