-- ============================================================================
-- Migration 020 — Scheduled Reminders.
--
-- Sumamos infraestructura para que la edge function `scheduled-reminders`
-- corra cada hora desde pg_cron y mande pushes para:
--   1. Hitos médicos próximos a vencer (24h antes).
--   2. Bebés que llevan 4h+ sin toma registrada.
--
-- Esta migration:
--   1. Agrega columnas `last_reminded_at` (medical_milestones) y
--      `last_feeding_reminder_at` (child_profiles) para idempotencia.
--   2. Activa pg_cron + pg_net si no estaban activos.
--   3. Programa el cron job que invoca la edge function por HTTP.
--
-- ⚠️  La edge function requiere secrets seteados ANTES de que el cron
--     empiece a tener efecto. Ver al final del archivo para los pasos.
-- ============================================================================

-- 1. Columnas de idempotencia
alter table public.medical_milestones
  add column if not exists last_reminded_at timestamptz;

alter table public.child_profiles
  add column if not exists last_feeding_reminder_at timestamptz;

-- 2. Extensiones requeridas (idempotente — si ya están, no falla)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 3. Schedule del cron job
-- IMPORTANTE: reemplazar <PROJECT_REF> por el ref del proyecto Supabase
-- antes de aplicar (o setearlo como secret y reescribirlo después).
-- Por defecto: cwzngscywmgnjuudsgva.
--
-- Cómo funciona: cada hora a los :05, hacemos POST a la edge function.
-- El header Authorization usa el SUPABASE_SERVICE_ROLE_KEY del proyecto
-- (también stored como secret). Si necesitás regenerar el cron, primero
-- borrá el job con `select cron.unschedule('salu-scheduled-reminders');`.

do $$
declare
  v_project_ref text := 'cwzngscywmgnjuudsgva';
  v_existing int;
begin
  -- Borramos cualquier schedule previo con el mismo nombre para re-crear
  -- limpio (idempotente al re-aplicar la migration).
  select count(*) into v_existing from cron.job where jobname = 'salu-scheduled-reminders';
  if v_existing > 0 then
    perform cron.unschedule('salu-scheduled-reminders');
  end if;

  perform cron.schedule(
    'salu-scheduled-reminders',
    '5 * * * *', -- cada hora, a los :05
    format(
      $cron$
        select net.http_post(
          url := 'https://%s.supabase.co/functions/v1/scheduled-reminders',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
          ),
          body := '{}'::jsonb,
          timeout_milliseconds := 60000
        );
      $cron$,
      v_project_ref
    )
  );
end $$;

-- ============================================================================
-- Pasos manuales adicionales (NO se aplican vía SQL):
--
-- 1. Setear los secrets de la edge function en Supabase CLI o dashboard:
--    supabase secrets set \
--      VAPID_PUBLIC_KEY=BDRLJJWN... \
--      VAPID_PRIVATE_KEY=P1rMDpFD... \
--      VAPID_EMAIL=marco.rossi@derecho.unt.edu.ar
--
-- 2. Setear el service role key como GUC para pg_cron (en SQL editor):
--    alter database postgres set app.settings.service_role_key to '<service_role_key>';
--
-- 3. Deploy de la edge function:
--    supabase functions deploy scheduled-reminders
--
-- 4. (Opcional) Probar invocación manual:
--    curl -X POST \
--      -H "Authorization: Bearer <service_role_key>" \
--      -H "Content-Type: application/json" \
--      https://cwzngscywmgnjuudsgva.supabase.co/functions/v1/scheduled-reminders
-- ============================================================================
