-- ============================================================================
-- Migration 023 — Habilita Realtime publication para las tablas que el
-- /home suscribe.
--
-- Supabase Realtime requiere que cada tabla esté agregada a la
-- publication `supabase_realtime` para emitir postgres_changes a los
-- clientes. Sin esto, el componente RealtimeRefresher se suscribe pero
-- nunca recibe eventos.
--
-- RLS sigue gobernando qué fila ve cada user — Realtime respeta las
-- mismas policies que las queries normales.
--
-- Idempotencia: las cláusulas `add table` no son idempotentes. El
-- bloque DO con exception handling permite re-correr la migration sin
-- fallar.
-- ============================================================================

do $$
begin
  -- Cada tabla por separado: si una ya está, las otras siguen.
  begin
    alter publication supabase_realtime add table public.feeding_events;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.sleep_sessions;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.diaper_events;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.media_items;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.notes;
  exception when duplicate_object then null;
  end;
end $$;
