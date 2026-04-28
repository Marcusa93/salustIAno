-- ============================================================================
-- Migration 001 — Init: extensions, enums, tablas y indexes.
--
-- Este archivo establece el esquema base de Salu para la fase 0 / MVP:
--   - Identidad y familia: family_groups, family_memberships, invitations.
--   - Niño y salud: child_profiles, child_measurements.
--   - Eventos de cuidado: sleep_sessions, feeding_events, diaper_events.
--   - Memoria: notes, media_items.
--   - Gobernanza: audit_logs.
--
-- Reglas no negociables (ver docs/01-arquitectura.md y ADR 0006):
--   - Soft delete obligatorio (`deleted_at`) en toda tabla con datos del niño.
--   - Trazabilidad por defecto: created_at, updated_at, created_by donde aplique.
--   - Edad gestacional al nacer modelada con flag `is_preterm` derivado.
--
-- RLS, triggers de auditoría y la vista timeline se aplican en migraciones
-- posteriores (002–005).
-- ============================================================================

-- Extensions ----------------------------------------------------------------

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Trigger genérico para mantener updated_at -------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger genérico que setea updated_at = now() en cada UPDATE.';

-- Enums ---------------------------------------------------------------------

create type public.family_role as enum ('admin', 'caregiver', 'family', 'viewer');
create type public.sleep_quality as enum ('good', 'regular', 'bad', 'unknown');
create type public.feeding_type as enum ('breastfeeding', 'bottle', 'solid');
create type public.breast_side as enum ('left', 'right', 'both');
create type public.feeding_reaction as enum ('none', 'mild', 'strong');
create type public.diaper_type as enum ('wet', 'dirty', 'both', 'dry');
create type public.note_category as enum ('memory', 'observation', 'milestone', 'other');
create type public.audit_action as enum ('insert', 'update', 'soft_delete', 'restore', 'hard_delete');

-- Tablas --------------------------------------------------------------------

-- family_groups -------------------------------------------------------------

create table public.family_groups (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint family_groups_name_length check (char_length(name) between 1 and 100)
);

create trigger trg_family_groups_set_updated_at
before update on public.family_groups
for each row execute function public.set_updated_at();

-- family_memberships --------------------------------------------------------

create table public.family_memberships (
  id uuid primary key default uuid_generate_v4(),
  family_group_id uuid not null references public.family_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.family_role not null default 'family',
  display_name text,
  relationship text,
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint family_memberships_unique_user_per_group unique (family_group_id, user_id)
);

create trigger trg_family_memberships_set_updated_at
before update on public.family_memberships
for each row execute function public.set_updated_at();

-- invitations ---------------------------------------------------------------
-- Sin updated_at ni deleted_at: una invitación es inmutable hasta que se
-- acepta (se setea accepted_at) o se revoca (DELETE real).

create table public.invitations (
  id uuid primary key default uuid_generate_v4(),
  family_group_id uuid not null references public.family_groups(id) on delete cascade,
  email text not null,
  role public.family_role not null,
  token text not null unique default encode(gen_random_bytes(32), 'hex'),
  invited_by uuid not null references auth.users(id) on delete restrict,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint invitations_email_format check (email ~* '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$')
);

-- child_profiles ------------------------------------------------------------

create table public.child_profiles (
  id uuid primary key default uuid_generate_v4(),
  family_group_id uuid not null references public.family_groups(id) on delete cascade,
  name text not null,
  birth_date date,
  birth_time time,
  birth_place text,
  birth_weight_grams integer,
  birth_height_cm numeric(4, 1),
  gestational_weeks_at_birth integer,
  is_preterm boolean generated always as (
    gestational_weeks_at_birth is not null and gestational_weeks_at_birth < 37
  ) stored,
  pediatrician_name text,
  pediatrician_phone text,
  health_insurance text,
  blood_type text,
  notes text,
  avatar_path text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint child_profiles_name_length check (char_length(name) between 1 and 100),
  constraint child_profiles_birth_weight_range check (
    birth_weight_grams is null or birth_weight_grams between 200 and 8000
  ),
  constraint child_profiles_birth_height_range check (
    birth_height_cm is null or birth_height_cm between 20 and 70
  ),
  constraint child_profiles_gest_weeks_range check (
    gestational_weeks_at_birth is null or gestational_weeks_at_birth between 22 and 45
  ),
  constraint child_profiles_blood_type check (
    blood_type is null or blood_type in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')
  )
);

create trigger trg_child_profiles_set_updated_at
before update on public.child_profiles
for each row execute function public.set_updated_at();

-- child_measurements --------------------------------------------------------

create table public.child_measurements (
  id uuid primary key default uuid_generate_v4(),
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  measured_at timestamptz not null,
  weight_grams integer,
  height_cm numeric(4, 1),
  head_circumference_cm numeric(4, 1),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint child_measurements_at_least_one check (
    weight_grams is not null
    or height_cm is not null
    or head_circumference_cm is not null
  ),
  constraint child_measurements_weight_range check (
    weight_grams is null or weight_grams between 500 and 50000
  ),
  constraint child_measurements_height_range check (
    height_cm is null or height_cm between 30 and 200
  ),
  constraint child_measurements_head_range check (
    head_circumference_cm is null or head_circumference_cm between 25 and 65
  )
);

create trigger trg_child_measurements_set_updated_at
before update on public.child_measurements
for each row execute function public.set_updated_at();

-- sleep_sessions ------------------------------------------------------------

create table public.sleep_sessions (
  id uuid primary key default uuid_generate_v4(),
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  quality public.sleep_quality not null default 'unknown',
  is_nap boolean not null default false,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint sleep_sessions_ended_after_started check (
    ended_at is null or ended_at > started_at
  ),
  constraint sleep_sessions_max_duration check (
    ended_at is null or (ended_at - started_at) < interval '24 hours'
  )
);

create trigger trg_sleep_sessions_set_updated_at
before update on public.sleep_sessions
for each row execute function public.set_updated_at();

-- feeding_events ------------------------------------------------------------

create table public.feeding_events (
  id uuid primary key default uuid_generate_v4(),
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  occurred_at timestamptz not null,
  type public.feeding_type not null,
  side public.breast_side,
  duration_minutes integer,
  amount_ml integer,
  foods text[],
  reaction public.feeding_reaction not null default 'none',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint feeding_events_duration_range check (
    duration_minutes is null or duration_minutes between 0 and 180
  ),
  constraint feeding_events_amount_range check (
    amount_ml is null or amount_ml between 0 and 1000
  ),
  -- Coherencia tipo ↔ campos:
  --   breastfeeding: side y duration permitidos; amount_ml y foods deben ser NULL.
  --   bottle:        duration y amount permitidos; side y foods deben ser NULL.
  --   solid:         foods permitido; side, duration y amount deben ser NULL.
  constraint feeding_events_type_consistency check (
    (type = 'breastfeeding' and amount_ml is null and foods is null)
    or (type = 'bottle' and side is null and foods is null)
    or (type = 'solid' and side is null and duration_minutes is null and amount_ml is null)
  )
);

create trigger trg_feeding_events_set_updated_at
before update on public.feeding_events
for each row execute function public.set_updated_at();

-- diaper_events -------------------------------------------------------------

create table public.diaper_events (
  id uuid primary key default uuid_generate_v4(),
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  occurred_at timestamptz not null,
  type public.diaper_type not null,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger trg_diaper_events_set_updated_at
before update on public.diaper_events
for each row execute function public.set_updated_at();

-- notes ---------------------------------------------------------------------

create table public.notes (
  id uuid primary key default uuid_generate_v4(),
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  category public.note_category not null default 'memory',
  content text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint notes_content_length check (char_length(content) between 1 and 5000)
);

create trigger trg_notes_set_updated_at
before update on public.notes
for each row execute function public.set_updated_at();

-- media_items ---------------------------------------------------------------

create table public.media_items (
  id uuid primary key default uuid_generate_v4(),
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint,
  width integer,
  height integer,
  caption text,
  taken_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint media_items_size_positive check (size_bytes is null or size_bytes > 0),
  constraint media_items_width_positive check (width is null or width > 0),
  constraint media_items_height_positive check (height is null or height > 0),
  constraint media_items_caption_length check (caption is null or char_length(caption) <= 1000)
);

create trigger trg_media_items_set_updated_at
before update on public.media_items
for each row execute function public.set_updated_at();

-- audit_logs ----------------------------------------------------------------
-- Tabla inmutable. No tiene updated_at ni deleted_at; los inserts ocurren
-- vía trigger SECURITY DEFINER (ver migration 003), y RLS bloquea
-- INSERT/UPDATE/DELETE desde roles de aplicación.

create table public.audit_logs (
  id uuid primary key default uuid_generate_v4(),
  family_group_id uuid references public.family_groups(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action public.audit_action not null,
  table_name text not null,
  record_id uuid not null,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

comment on table public.audit_logs is
  'Registro inmutable de mutaciones sobre tablas sensibles. Solo el trigger '
  'audit_trigger_fn() inserta filas (SECURITY DEFINER); ningún rol de '
  'aplicación tiene policies de INSERT, UPDATE o DELETE sobre esta tabla.';

-- Indexes -------------------------------------------------------------------

-- family_groups: lookup activo por id (uso típico desde joins/RLS).
create index idx_family_groups_id_active
  on public.family_groups (id)
  where deleted_at is null;

-- family_memberships: membership lookup por user y por group.
create index idx_family_memberships_user_active
  on public.family_memberships (user_id)
  where deleted_at is null;

create index idx_family_memberships_group_active
  on public.family_memberships (family_group_id)
  where deleted_at is null;

-- invitations: pending lookup por token y por email.
create index idx_invitations_token_pending
  on public.invitations (token)
  where accepted_at is null;

create index idx_invitations_email_pending
  on public.invitations (email)
  where accepted_at is null;

-- child_profiles: niños activos por familia.
create index idx_child_profiles_family_active
  on public.child_profiles (family_group_id)
  where deleted_at is null;

-- Eventos: por niño + orden cronológico inverso (queries de timeline).
create index idx_child_measurements_child_measured_active
  on public.child_measurements (child_id, measured_at desc)
  where deleted_at is null;

create index idx_sleep_sessions_child_started_active
  on public.sleep_sessions (child_id, started_at desc)
  where deleted_at is null;

create index idx_feeding_events_child_occurred_active
  on public.feeding_events (child_id, occurred_at desc)
  where deleted_at is null;

create index idx_diaper_events_child_occurred_active
  on public.diaper_events (child_id, occurred_at desc)
  where deleted_at is null;

create index idx_notes_child_occurred_active
  on public.notes (child_id, occurred_at desc)
  where deleted_at is null;

create index idx_media_items_child_taken_active
  on public.media_items (child_id, coalesce(taken_at, created_at) desc)
  where deleted_at is null;

-- audit_logs: lookup por familia (admin view) y por (tabla, registro).
create index idx_audit_logs_family_created
  on public.audit_logs (family_group_id, created_at desc);

create index idx_audit_logs_table_record
  on public.audit_logs (table_name, record_id);
