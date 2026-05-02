-- ============================================================================
-- Migration 012 — Biblioteca de canciones cantadas para Salu.
--
-- Cada generación de audio cuesta ~$0.04 USD, así que persistir las nanas
-- es importante: la familia las elige por mood y las reproduce sin pagar
-- cada vez. Tabla `lullabies` + bucket `lullabies` con RLS por familia.
-- ============================================================================

create type public.lullaby_mood as enum ('dulce', 'jugueton', 'calmo', 'valiente');

create table public.lullabies (
  id uuid primary key default uuid_generate_v4(),
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  family_group_id uuid not null references public.family_groups(id) on delete cascade,

  title text not null,
  intro text not null,
  -- Lyrics estructurados igual que LullabyOutput. Guardamos JSONB para
  -- no perder estructura (verses/chorus/closing) si después queremos
  -- re-renderizar la letra en otro layout.
  verses jsonb not null,
  chorus text not null default '',
  closing text not null default '',
  mood public.lullaby_mood not null,

  -- Path al MP3 en el bucket lullabies (formato {family}/{child}/{id}.mp3).
  audio_path text,
  -- Metadata de la generación de audio (model, latencia, costo si aplica)
  generation_meta jsonb not null default '{}'::jsonb,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index lullabies_family_active_idx
  on public.lullabies (family_group_id, mood, created_at desc)
  where deleted_at is null;

create index lullabies_child_idx
  on public.lullabies (child_id)
  where deleted_at is null;

create trigger trg_lullabies_set_updated_at
before update on public.lullabies
for each row execute function public.set_updated_at();

comment on table public.lullabies is
  'Biblioteca de canciones generadas. Permite reusar audio sin re-pagar la generación.';

-- ----------------------------------------------------------------------------
-- RLS sobre lullabies
-- ----------------------------------------------------------------------------

alter table public.lullabies enable row level security;

create policy "lullabies: select por familia" on public.lullabies
  for select using (
    public.is_family_member(family_group_id)
    and deleted_at is null
  );

create policy "lullabies: insert por miembro de familia" on public.lullabies
  for insert with check (
    public.is_family_member(family_group_id)
  );

create policy "lullabies: update propios" on public.lullabies
  for update using (
    auth.uid() = created_by
    or public.is_family_admin(family_group_id)
  );

-- ----------------------------------------------------------------------------
-- Storage bucket privado para los MP3
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lullabies',
  'lullabies',
  false,
  20971520, -- 20 MB (un MP3 de 60s con 128kbps anda ~1MB; 20MB es margen amplio).
  array['audio/mpeg', 'audio/mp3', 'audio/wav']
)
on conflict (id) do nothing;

drop policy if exists "lullabies storage: select por familia" on storage.objects;
create policy "lullabies storage: select por familia"
  on storage.objects for select
  using (
    bucket_id = 'lullabies'
    and exists (
      select 1 from public.family_memberships fm
      where fm.user_id = auth.uid()
        and fm.deleted_at is null
        and fm.family_group_id::text = (storage.foldername(name))[1]
    )
  );

drop policy if exists "lullabies storage: insert por familia" on storage.objects;
create policy "lullabies storage: insert por familia"
  on storage.objects for insert
  with check (
    bucket_id = 'lullabies'
    and exists (
      select 1 from public.family_memberships fm
      where fm.user_id = auth.uid()
        and fm.deleted_at is null
        and fm.family_group_id::text = (storage.foldername(name))[1]
    )
  );

drop policy if exists "lullabies storage: delete por familia" on storage.objects;
create policy "lullabies storage: delete por familia"
  on storage.objects for delete
  using (
    bucket_id = 'lullabies'
    and exists (
      select 1 from public.family_memberships fm
      where fm.user_id = auth.uid()
        and fm.deleted_at is null
        and fm.family_group_id::text = (storage.foldername(name))[1]
    )
  );
