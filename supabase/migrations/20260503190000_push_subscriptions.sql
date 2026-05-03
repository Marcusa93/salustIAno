-- ============================================================================
-- Migration 019 — Suscripciones a Web Push.
--
-- Cada user puede tener múltiples suscripciones (1 por device/browser). El
-- endpoint es único globalmente — si el mismo browser se suscribe dos veces
-- el endpoint coincide y hacemos upsert en lugar de duplicar.
-- ============================================================================

create table if not exists public.push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  family_group_id uuid not null references public.family_groups(id) on delete cascade,
  endpoint text not null unique,
  -- Keys del PushSubscription serializado (p256dh, auth). JSONB para no
  -- inventar columnas si la spec cambia.
  keys jsonb not null,
  user_agent text,
  created_at timestamptz not null default now(),
  -- Marcamos como inválida cuando el push falla con 410 Gone — facilita
  -- limpiar después sin romper FKs.
  invalidated_at timestamptz
);

create index if not exists push_subscriptions_user_active_idx
  on public.push_subscriptions (user_id)
  where invalidated_at is null;

create index if not exists push_subscriptions_family_active_idx
  on public.push_subscriptions (family_group_id)
  where invalidated_at is null;

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subs: select propios" on public.push_subscriptions;
create policy "push_subs: select propios" on public.push_subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "push_subs: insert propios" on public.push_subscriptions;
create policy "push_subs: insert propios" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);

drop policy if exists "push_subs: delete propios" on public.push_subscriptions;
create policy "push_subs: delete propios" on public.push_subscriptions
  for delete using (auth.uid() = user_id);
