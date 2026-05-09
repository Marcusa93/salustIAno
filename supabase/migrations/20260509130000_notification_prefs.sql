-- ============================================================================
-- Migration 024 — Notification prefs + columnas de idempotencia para
-- predicciones rule-based.
--
-- Suma:
--   1. Tabla `notification_prefs` (1 fila por user) con flags JSONB para
--      cada tipo de push. Default: solo los reminders "tradicionales"
--      (controles + toma vencida) están ON. Los predictivos son opt-in.
--   2. Columnas en child_profiles para dedup de pushes predictivos:
--      `last_predicted_feeding_reminder_at`,
--      `last_predicted_diaper_reminder_at`.
--   3. Re-schedule del cron a cada 15 min (antes era cada hora) para que
--      la ventana de predicción "próximos 30 min" sea útil.
-- ============================================================================

-- 1. Tabla de prefs
create table if not exists public.notification_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  prefs jsonb not null default '{
    "controls": true,
    "feeding_overdue": true,
    "feeding_predicted": false,
    "diaper_predicted": false
  }'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_notification_prefs_set_updated_at on public.notification_prefs;
create trigger trg_notification_prefs_set_updated_at
before update on public.notification_prefs
for each row execute function public.set_updated_at();

alter table public.notification_prefs enable row level security;

drop policy if exists "notification_prefs: select propios" on public.notification_prefs;
create policy "notification_prefs: select propios" on public.notification_prefs
  for select using (auth.uid() = user_id);

drop policy if exists "notification_prefs: insert propios" on public.notification_prefs;
create policy "notification_prefs: insert propios" on public.notification_prefs
  for insert with check (auth.uid() = user_id);

drop policy if exists "notification_prefs: update propios" on public.notification_prefs;
create policy "notification_prefs: update propios" on public.notification_prefs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2. Dedup columns para los pushes predictivos.
alter table public.child_profiles
  add column if not exists last_predicted_feeding_reminder_at timestamptz,
  add column if not exists last_predicted_diaper_reminder_at timestamptz;

-- 3. Re-schedule del cron a cada 15 min.
-- La predicción usa una ventana de "próximos 30 min" — corriendo cada
-- 15 min nos da margen para no perderla.
do $$
declare
  v_project_ref text := 'cwzngscywmgnjuudsgva';
  v_existing int;
begin
  select count(*) into v_existing from cron.job where jobname = 'salu-scheduled-reminders';
  if v_existing > 0 then
    perform cron.unschedule('salu-scheduled-reminders');
  end if;

  perform cron.schedule(
    'salu-scheduled-reminders',
    '*/15 * * * *', -- cada 15 minutos
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
