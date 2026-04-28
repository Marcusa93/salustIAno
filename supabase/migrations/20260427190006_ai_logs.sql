-- ============================================================================
-- Migration 006 — ai_logs: observabilidad de la capa de IA.
--
-- La capa lib/ai/ (próxima fase) registra metadata de cada llamada a un LLM:
-- agente, modelo, tokens, latencia, errores. NUNCA contenido (ni prompts ni
-- outputs). Esa restricción está documentada en docs/06-privacidad.md y
-- docs/04-agentes-llm.md.
--
-- Tabla independiente: no toca el resto del schema. Puramente aditiva.
--
-- Inmutable por diseño (igual que audit_logs):
--   - Sin updated_at: el log nunca se modifica después de crearse.
--   - Sin deleted_at: la purga es por job programado (no soft delete).
--   - Sin policies de INSERT/UPDATE/DELETE para roles authenticated/anon.
--
-- Los inserts ocurren server-side desde lib/ai/ usando el admin client
-- (service_role), que bypasea RLS por diseño. Es seguro porque:
--   1. Nuestro código controla qué se loguea (no input arbitrario del user).
--   2. El admin client jamás cruza el límite servidor → cliente.
--   3. RLS bloquea cualquier escritura desde authenticated/anon.
-- ============================================================================

create table public.ai_logs (
  id uuid primary key default uuid_generate_v4(),
  agent text not null,
  model text not null,
  prompt_version text,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer generated always as (
    coalesce(prompt_tokens, 0) + coalesce(completion_tokens, 0)
  ) stored,
  latency_ms integer,
  error text,
  family_group_id uuid references public.family_groups(id) on delete set null,
  child_id uuid references public.child_profiles(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint ai_logs_prompt_tokens_nonneg check (prompt_tokens is null or prompt_tokens >= 0),
  constraint ai_logs_completion_tokens_nonneg check (completion_tokens is null or completion_tokens >= 0),
  constraint ai_logs_latency_nonneg check (latency_ms is null or latency_ms >= 0)
);

comment on table public.ai_logs is
  'Logs de llamadas a LLMs. Solo metadata, nunca contenido. Inmutable: '
  'solo INSERT permitido vía admin client (service_role), bloqueado para '
  'roles authenticated/anon vía RLS.';

-- Indexes -------------------------------------------------------------------

-- Listado por familia ordenado cronológicamente (uso típico desde admin UI).
create index idx_ai_logs_family_created
  on public.ai_logs (family_group_id, created_at desc);

-- Análisis por agente (cuántas llamadas hizo story-generator esta semana, etc.).
create index idx_ai_logs_agent_created
  on public.ai_logs (agent, created_at desc);

-- Errores recientes (debugging y alertas).
create index idx_ai_logs_errors_created
  on public.ai_logs (created_at desc)
  where error is not null;

-- RLS -----------------------------------------------------------------------

alter table public.ai_logs enable row level security;

-- Solo SELECT, y solo para admins de la familia involucrada (o logs de
-- sistema sin familia, útiles en debug). INSERT/UPDATE/DELETE no tienen
-- policy: la tabla solo se escribe vía admin client desde server-side.
create policy "ai_logs: family admins can read"
  on public.ai_logs
  for select
  to authenticated
  using (
    family_group_id is null
    or public.is_family_admin(family_group_id)
  );
