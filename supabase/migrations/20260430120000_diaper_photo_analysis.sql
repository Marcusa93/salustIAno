-- ============================================================================
-- Migration 009 — Persistencia del análisis estructurado de fotos de pañal.
--
-- El agente diaper-vision (Capa 5 slice 1) devuelve un JSON con color,
-- consistencia, observaciones, alarma y recomendación. Hasta acá ese
-- resultado se mostraba en pantalla y se perdía. Esta migración agrega
-- la columna donde lo guardamos junto al evento.
--
-- La FOTO en sí no se persiste todavía. El bucket de Supabase Storage,
-- las RLS por familia y la columna `photo_path` quedan para una
-- migración separada cuando lleguemos al slice 3 de Capa 5.
--
-- Forma esperada del JSON (validado en TS por diaperAnalysisSchema):
--   {
--     "color": "amarillo mostaza",
--     "consistency": "pastosa",
--     "observations": "...",
--     "alarm": false,
--     "alarm_reason": "",
--     "recommendation": "..."
--   }
-- ============================================================================

alter table public.diaper_events
  add column photo_analysis jsonb;

comment on column public.diaper_events.photo_analysis is
  'JSON estructurado del agente diaper-vision (color, consistency, observations, alarm, alarm_reason, recommendation). NULL cuando el evento se cargó sin foto.';

-- timeline_events -----------------------------------------------------------
-- Recreamos el view para exponer photo_analysis en el payload de diaper.
-- Resto del view queda igual; reescribimos completo para mantener el archivo
-- legible como referencia única del shape del payload.

create or replace view public.timeline_events
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
      'notes', d.notes,
      'photo_analysis', d.photo_analysis
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
