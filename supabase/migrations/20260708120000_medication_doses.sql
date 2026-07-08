-- medication_doses ──────────────────────────────────────────────────────────
-- Registro de cada dosis de medicamento administrada al bebé.
-- RLS: los cuidadores y admins registran dosis; todos los miembros leen;
-- solo admins borran (soft-delete).
-- ──────────────────────────────────────────────────────────────────────────────

create table public.medication_doses (
  id               uuid        not null default gen_random_uuid() primary key,
  child_id         uuid        not null references public.child_profiles(id),
  medication_name  text        not null,
  dose_amount      text,
  given_at         timestamptz not null default now(),
  interval_hours   numeric(4,1),
  next_dose_at     timestamptz,
  notes            text,
  created_by       uuid        not null references auth.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,

  constraint medication_doses_name_length
    check (char_length(medication_name) between 1 and 100),
  constraint medication_doses_dose_amount_length
    check (dose_amount is null or char_length(dose_amount) <= 50),
  constraint medication_doses_notes_length
    check (notes is null or char_length(notes) <= 500),
  constraint medication_doses_interval_range
    check (interval_hours is null or (interval_hours > 0 and interval_hours <= 72)),
  constraint medication_doses_next_after_given
    check (next_dose_at is null or next_dose_at >= given_at)
);

comment on table public.medication_doses is
  'Cada fila representa una dosis de medicamento administrada al bebé.';

create trigger trg_medication_doses_set_updated_at
  before update on public.medication_doses
  for each row execute function public.set_updated_at();

create index idx_medication_doses_child_given_active
  on public.medication_doses (child_id, given_at desc)
  where deleted_at is null;

-- RLS -------------------------------------------------------------------------

alter table public.medication_doses enable row level security;

create policy "medication_doses: members can read"
  on public.medication_doses
  for select
  to authenticated
  using (public.is_family_member(public.child_family_group_id(child_id)));

create policy "medication_doses: caregiver+admin can create (self-attributed)"
  on public.medication_doses
  for insert
  to authenticated
  with check (
    public.is_family_caregiver_or_admin(public.child_family_group_id(child_id))
    and created_by = auth.uid()
  );

create policy "medication_doses: caregiver+admin can update"
  on public.medication_doses
  for update
  to authenticated
  using (public.is_family_caregiver_or_admin(public.child_family_group_id(child_id)))
  with check (public.is_family_caregiver_or_admin(public.child_family_group_id(child_id)));

create policy "medication_doses: admins can delete"
  on public.medication_doses
  for delete
  to authenticated
  using (public.is_family_admin(public.child_family_group_id(child_id)));
