-- ============================================================================
-- Migration 011 — Persistencia del historial de chat con SalustIA.
--
-- Hasta acá el chat era efímero: cada refresh empezaba en blanco. Con
-- Slice 2 (escrituras conversacionales con confirmación), el chat
-- pasa a ser la interfaz principal y perder el contexto en cada visita
-- es doloroso. Esta migration crea la tabla y las RLS.
--
-- Decisiones:
--   - Una fila por mensaje (no thread/conversation tables) — single
--     rolling history por usuario, lo más simple que funciona.
--   - Solo guardamos role + content. Proposals son transitorias (las
--     cards ya se confirmaron/descartaron); no las re-renderizamos.
--   - Soft delete (deleted_at) — un "limpiar conversación" no destruye
--     audit trail. La query principal filtra is null.
--   - RLS por usuario, no por familia: el chat es íntimo. Distintos
--     miembros de una familia tienen sus propios threads.
-- ============================================================================

create type public.chat_role as enum ('user', 'assistant');

create table public.chat_messages (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  family_group_id uuid not null references public.family_groups(id) on delete cascade,
  role public.chat_role not null,
  content text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index chat_messages_user_active_idx
  on public.chat_messages (user_id, created_at desc)
  where deleted_at is null;

comment on table public.chat_messages is
  'Historial conversacional con SalustIA por usuario. Soft delete vía deleted_at; las queries de UI filtran activos.';

-- RLS — privado por usuario.
alter table public.chat_messages enable row level security;

create policy "chat_messages: select propios" on public.chat_messages
  for select using (auth.uid() = user_id);

create policy "chat_messages: insert propios" on public.chat_messages
  for insert with check (auth.uid() = user_id);

-- Update solo soft-delete (poder marcar deleted_at). No editamos contenido.
create policy "chat_messages: soft-delete propios" on public.chat_messages
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
