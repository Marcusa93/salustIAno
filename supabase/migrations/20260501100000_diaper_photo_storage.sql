-- ============================================================================
-- Migration 010 — Storage de fotos de pañal (Capa 5 fase 3).
--
-- Crea el bucket privado `diaper-photos` con RLS por familia, y agrega
-- la columna `photo_path` a `diaper_events` que apunta al objeto en
-- Storage. El timeline_events view se recrea para exponerla en el
-- payload de diaper.
--
-- Convención de path:
--   {family_group_id}/{child_id}/{event_id}-{timestamp}.{ext}
--
-- El `family_group_id` como primer segmento es CLAVE: las RLS policies
-- usan `(storage.foldername(name))[1]` para chequear membresía. Cualquier
-- intento de leer/escribir fuera de la propia familia rebota.
-- ============================================================================

-- 1. Bucket privado
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'diaper-photos',
  'diaper-photos',
  false,
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

-- 2. RLS policies sobre storage.objects para este bucket.
-- (RLS sobre storage.objects ya está enabled por defecto en Supabase.)

drop policy if exists "diaper photos: select por familia" on storage.objects;
create policy "diaper photos: select por familia"
  on storage.objects for select
  using (
    bucket_id = 'diaper-photos'
    and exists (
      select 1 from public.family_memberships fm
      where fm.user_id = auth.uid()
        and fm.deleted_at is null
        and fm.family_group_id::text = (storage.foldername(name))[1]
    )
  );

drop policy if exists "diaper photos: insert por familia" on storage.objects;
create policy "diaper photos: insert por familia"
  on storage.objects for insert
  with check (
    bucket_id = 'diaper-photos'
    and exists (
      select 1 from public.family_memberships fm
      where fm.user_id = auth.uid()
        and fm.deleted_at is null
        and fm.family_group_id::text = (storage.foldername(name))[1]
    )
  );

drop policy if exists "diaper photos: delete por familia" on storage.objects;
create policy "diaper photos: delete por familia"
  on storage.objects for delete
  using (
    bucket_id = 'diaper-photos'
    and exists (
      select 1 from public.family_memberships fm
      where fm.user_id = auth.uid()
        and fm.deleted_at is null
        and fm.family_group_id::text = (storage.foldername(name))[1]
    )
  );

-- 3. Columna en diaper_events
alter table public.diaper_events
  add column if not exists photo_path text;

comment on column public.diaper_events.photo_path is
  'Path del objeto en el bucket diaper-photos (formato {family_group_id}/{child_id}/{event_id}-{timestamp}.{ext}). NULL cuando el evento se cargó sin foto.';

-- 4. timeline_events view: recreado para exponer photo_path.
create or replace view public.timeline_events
with (security_invoker = true) as
  select
    'measurement'::text as event_type,
    m.id, m.child_id, m.measured_at as occurred_at,
    jsonb_build_object(
      'weight_grams', m.weight_grams,
      'height_cm', m.height_cm,
      'head_circumference_cm', m.head_circumference_cm,
      'notes', m.notes
    ) as payload,
    m.created_at, m.created_by
  from public.child_measurements m
  where m.deleted_at is null
  union all
  select
    'sleep'::text as event_type,
    s.id, s.child_id, s.started_at as occurred_at,
    jsonb_build_object(
      'started_at', s.started_at,
      'ended_at', s.ended_at,
      'quality', s.quality,
      'is_nap', s.is_nap,
      'notes', s.notes
    ) as payload,
    s.created_at, s.created_by
  from public.sleep_sessions s
  where s.deleted_at is null
  union all
  select
    'feeding'::text as event_type,
    f.id, f.child_id, f.occurred_at,
    jsonb_build_object(
      'type', f.type,
      'side', f.side,
      'duration_minutes', f.duration_minutes,
      'amount_ml', f.amount_ml,
      'foods', f.foods,
      'reaction', f.reaction,
      'notes', f.notes
    ) as payload,
    f.created_at, f.created_by
  from public.feeding_events f
  where f.deleted_at is null
  union all
  select
    'diaper'::text as event_type,
    d.id, d.child_id, d.occurred_at,
    jsonb_build_object(
      'type', d.type,
      'notes', d.notes,
      'photo_analysis', d.photo_analysis,
      'photo_path', d.photo_path
    ) as payload,
    d.created_at, d.created_by
  from public.diaper_events d
  where d.deleted_at is null
  union all
  select
    'note'::text as event_type,
    n.id, n.child_id, n.occurred_at,
    jsonb_build_object(
      'category', n.category,
      'content', n.content
    ) as payload,
    n.created_at, n.created_by
  from public.notes n
  where n.deleted_at is null
  union all
  select
    'media'::text as event_type,
    mi.id, mi.child_id, coalesce(mi.taken_at, mi.created_at) as occurred_at,
    jsonb_build_object(
      'storage_path', mi.storage_path,
      'mime_type', mi.mime_type,
      'caption', mi.caption,
      'width', mi.width,
      'height', mi.height
    ) as payload,
    mi.created_at, mi.created_by
  from public.media_items mi
  where mi.deleted_at is null;
