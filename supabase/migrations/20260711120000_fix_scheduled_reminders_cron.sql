-- ============================================================================
-- Fix cron job scheduled-reminders.
--
-- La función está deployada con --no-verify-jwt, así que ya no necesita
-- el Bearer token en el header. El intento anterior usaba
-- current_setting('app.settings.service_role_key') que nunca se pudo
-- setear por falta de permisos de superuser → el cron llamaba con
-- "Authorization: Bearer null" y Supabase rechazaba el request.
--
-- Ahora el cron llama sin Authorization header y la edge function corre.
-- La función usa sus propios secrets (SUPABASE_SERVICE_ROLE_KEY) para
-- hacer queries con el admin client internamente.
-- ============================================================================

do $$
declare
  v_project_ref text := 'nszwkhwqfezcrvvqskdb';
  v_existing int;
begin
  select count(*) into v_existing from cron.job where jobname = 'salu-scheduled-reminders';
  if v_existing > 0 then
    perform cron.unschedule('salu-scheduled-reminders');
  end if;

  perform cron.schedule(
    'salu-scheduled-reminders',
    '5 * * * *',
    format(
      $cron$
        select net.http_post(
          url := 'https://%s.supabase.co/functions/v1/scheduled-reminders',
          headers := '{"Content-Type": "application/json"}'::jsonb,
          body := '{}'::jsonb,
          timeout_milliseconds := 60000
        );
      $cron$,
      v_project_ref
    )
  );
end $$;
