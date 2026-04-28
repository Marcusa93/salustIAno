-- ============================================================================
-- Migration 005 — Timeline view + función paginada.
--
-- timeline_events agrega los seis tipos de eventos del MVP en un stream
-- común. El view es SECURITY INVOKER, así que las RLS de las tablas base se
-- aplican al caller.
--
-- get_timeline(child_id, event_types, from, to, limit, offset) es la API
-- canónica para el frontend: paginada, filtrable por tipo y rango temporal,
-- siempre ordenada DESC por occurred_at.
-- ============================================================================

create view public.timeline_events
with (security_invoker = true) as
  -- measurement -----------------------------------------------------------
  select
    'measurement'::text as event_type,
    m.id,
    m.child_id,
    m.measured_at as occurred_at,
    jsonb_build_object(
      'weight_grams', m.weight_grams,
      'height_cm', m.height_cm,
      'head_circumference_cm', m.head_circumference_cm,
      'notes', m.notes
    ) as payload,
    m.created_at,
    m.created_by
  from public.child_measurements m
  where m.deleted_at is null

  union all

  -- sleep -----------------------------------------------------------------
  select
    'sleep'::text as event_type,
    s.id,
    s.child_id,
    s.started_at as occurred_at,
    jsonb_build_object(
      'started_at', s.started_at,
      'ended_at', s.ended_at,
      'quality', s.quality,
      'is_nap', s.is_nap,
      'notes', s.notes
    ) as payload,
    s.created_at,
    s.created_by
  from public.sleep_sessions s
  where s.deleted_at is null

  union all

  -- feeding ---------------------------------------------------------------
  select
    'feeding'::text as event_type,
    f.id,
    f.child_id,
    f.occurred_at,
    jsonb_build_object(
      'type', f.type,
      'side', f.side,
      'duration_minutes', f.duration_minutes,
      'amount_ml', f.amount_ml,
      'foods', f.foods,
      'reaction', f.reaction,
      'notes', f.notes
    ) as payload,
    f.created_at,
    f.created_by
  from public.feeding_events f
  where f.deleted_at is null

  union all

  -- diaper ----------------------------------------------------------------
  select
    'diaper'::text as event_type,
    d.id,
    d.child_id,
    d.occurred_at,
    jsonb_build_object(
      'type', d.type,
      'notes', d.notes
    ) as payload,
    d.created_at,
    d.created_by
  from public.diaper_events d
  where d.deleted_at is null

  union all

  -- note ------------------------------------------------------------------
  select
    'note'::text as event_type,
    n.id,
    n.child_id,
    n.occurred_at,
    jsonb_build_object(
      'category', n.category,
      'content', n.content
    ) as payload,
    n.created_at,
    n.created_by
  from public.notes n
  where n.deleted_at is null

  union all

  -- media -----------------------------------------------------------------
  select
    'media'::text as event_type,
    mi.id,
    mi.child_id,
    coalesce(mi.taken_at, mi.created_at) as occurred_at,
    jsonb_build_object(
      'storage_path', mi.storage_path,
      'mime_type', mi.mime_type,
      'caption', mi.caption,
      'width', mi.width,
      'height', mi.height
    ) as payload,
    mi.created_at,
    mi.created_by
  from public.media_items mi
  where mi.deleted_at is null;

comment on view public.timeline_events is
  'Stream unificado de los seis tipos de eventos del MVP. SECURITY INVOKER: '
  'la RLS de cada tabla base se aplica al caller.';

-- get_timeline -------------------------------------------------------------

create or replace function public.get_timeline(
  p_child_id uuid,
  p_event_types text[] default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  event_type text,
  id uuid,
  child_id uuid,
  occurred_at timestamptz,
  payload jsonb,
  created_at timestamptz,
  created_by uuid
)
language sql
stable
security invoker
as $$
  select
    t.event_type,
    t.id,
    t.child_id,
    t.occurred_at,
    t.payload,
    t.created_at,
    t.created_by
  from public.timeline_events t
  where t.child_id = p_child_id
    and (p_event_types is null or t.event_type = any (p_event_types))
    and (p_from is null or t.occurred_at >= p_from)
    and (p_to is null or t.occurred_at <= p_to)
  order by t.occurred_at desc
  limit p_limit offset p_offset;
$$;

comment on function public.get_timeline(uuid, text[], timestamptz, timestamptz, int, int) is
  'Devuelve eventos del timeline para un niño, paginados y filtrables. '
  'SECURITY INVOKER: respeta RLS del caller sobre las tablas base.';
