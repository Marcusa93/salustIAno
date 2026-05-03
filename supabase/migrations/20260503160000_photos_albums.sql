-- ============================================================================
-- Migration 016 — Álbumes de fotos.
--
-- Bucket privado `photos` con RLS por familia + tabla `albums` + extensión
-- de `media_items` para asociar fotos a álbumes y soportar tags.
--
-- Convención de path: {family_group_id}/{ts}-{rand}.{ext}
-- (el primer segmento permite que la RLS de Storage filtre por familia).
--
-- Auto-álbumes mensuales: cuando la familia sube una foto, la action
-- crea/encuentra el álbum del mes (`kind='monthly'`, `month_key` = primer
-- día del mes) y lo asocia. Álbumes manuales pueden venir después.
-- ============================================================================

-- 1. Bucket privado
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'photos',
  'photos',
  false,
  20971520, -- 20 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

drop policy if exists "photos: select por familia" on storage.objects;
create policy "photos: select por familia"
  on storage.objects for select
  using (
    bucket_id = 'photos'
    and exists (
      select 1 from public.family_memberships fm
      where fm.user_id = auth.uid()
        and fm.deleted_at is null
        and fm.family_group_id::text = (storage.foldername(name))[1]
    )
  );

drop policy if exists "photos: insert por familia" on storage.objects;
create policy "photos: insert por familia"
  on storage.objects for insert
  with check (
    bucket_id = 'photos'
    and exists (
      select 1 from public.family_memberships fm
      where fm.user_id = auth.uid()
        and fm.deleted_at is null
        and fm.family_group_id::text = (storage.foldername(name))[1]
    )
  );

drop policy if exists "photos: delete por familia" on storage.objects;
create policy "photos: delete por familia"
  on storage.objects for delete
  using (
    bucket_id = 'photos'
    and exists (
      select 1 from public.family_memberships fm
      where fm.user_id = auth.uid()
        and fm.deleted_at is null
        and fm.family_group_id::text = (storage.foldername(name))[1]
    )
  );

-- 2. Tipo + tabla albums

do $$ begin
  create type public.album_kind as enum ('manual', 'monthly', 'milestone');
exception when duplicate_object then null; end $$;

create table if not exists public.albums (
  id uuid primary key default uuid_generate_v4(),
  family_group_id uuid not null references public.family_groups(id) on delete cascade,
  child_id uuid references public.child_profiles(id) on delete cascade,

  name text not null,
  kind public.album_kind not null default 'manual',
  -- Para mensuales: primer día del mes — único por familia.
  month_key date,
  cover_path text,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  unique (family_group_id, month_key)
);

create index if not exists albums_family_active_idx
  on public.albums (family_group_id, kind, created_at desc)
  where deleted_at is null;

drop trigger if exists trg_albums_set_updated_at on public.albums;
create trigger trg_albums_set_updated_at
before update on public.albums
for each row execute function public.set_updated_at();

alter table public.albums enable row level security;

drop policy if exists "albums: select por familia" on public.albums;
create policy "albums: select por familia" on public.albums
  for select using (
    public.is_family_member(family_group_id) and deleted_at is null
  );

drop policy if exists "albums: insert por miembro" on public.albums;
create policy "albums: insert por miembro" on public.albums
  for insert with check (public.is_family_member(family_group_id));

drop policy if exists "albums: update propios" on public.albums;
create policy "albums: update propios" on public.albums
  for update using (
    auth.uid() = created_by or public.is_family_admin(family_group_id)
  );

-- 3. media_items: + album_id + tags + family_group_id (para queries directas)

alter table public.media_items
  add column if not exists album_id uuid references public.albums(id) on delete set null,
  add column if not exists tags text[] not null default '{}',
  add column if not exists family_group_id uuid references public.family_groups(id) on delete cascade;

-- Backfill family_group_id desde child_profiles si está vacío
update public.media_items mi
set family_group_id = cp.family_group_id
from public.child_profiles cp
where mi.child_id = cp.id
  and mi.family_group_id is null;

create index if not exists media_items_album_idx
  on public.media_items (album_id) where deleted_at is null;
create index if not exists media_items_family_idx
  on public.media_items (family_group_id, taken_at desc) where deleted_at is null;
create index if not exists media_items_tags_gin_idx
  on public.media_items using gin (tags);

-- Policy nueva sobre media_items: select/insert/update/delete por familia.
-- Las RLS originales (por child) siguen funcionando — esto agrega que
-- cualquier miembro de la familia pueda gestionar fotos sin necesidad de
-- pasar por child_profiles (importante para fotos pre-nacimiento).

drop policy if exists "media_items: select por familia" on public.media_items;
create policy "media_items: select por familia" on public.media_items
  for select using (
    family_group_id is not null
    and public.is_family_member(family_group_id)
    and deleted_at is null
  );

drop policy if exists "media_items: insert por familia" on public.media_items;
create policy "media_items: insert por familia" on public.media_items
  for insert with check (
    family_group_id is not null
    and public.is_family_member(family_group_id)
  );

drop policy if exists "media_items: update por familia" on public.media_items;
create policy "media_items: update por familia" on public.media_items
  for update using (
    family_group_id is not null
    and (auth.uid() = created_by or public.is_family_admin(family_group_id))
  );

drop policy if exists "media_items: delete por familia" on public.media_items;
create policy "media_items: delete por familia" on public.media_items
  for delete using (
    family_group_id is not null
    and (auth.uid() = created_by or public.is_family_admin(family_group_id))
  );
