-- Resumen diario: columna para idempotencia (no mandar dos veces el mismo día).
alter table public.child_profiles
  add column if not exists last_daily_summary_at timestamptz;

-- Link mágico (modo observador): token único por bebé para la URL pública /salu/[token].
-- No expira automáticamente — la familia puede revocarlo con un botón.
alter table public.child_profiles
  add column if not exists share_token text unique,
  add column if not exists share_token_created_at timestamptz;
