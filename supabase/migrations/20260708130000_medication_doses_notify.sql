-- Agrega next_dose_notified_at a medication_doses para idempotencia del
-- recordatorio push: la edge function lo setea cuando manda el push y
-- no vuelve a notificar la misma dosis.

alter table public.medication_doses
  add column next_dose_notified_at timestamptz;

comment on column public.medication_doses.next_dose_notified_at is
  'Timestamp en que se envió el push de recordatorio de esta dosis. NULL = todavía no se notificó.';

-- Índice para que la edge function encuentre rápido los doses a notificar.
create index idx_medication_doses_next_dose_pending
  on public.medication_doses (next_dose_at)
  where deleted_at is null and next_dose_notified_at is null;
