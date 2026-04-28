-- ============================================================================
-- Migration 004 — Row Level Security.
--
-- Enable RLS en todas las tablas (incluyendo audit_logs e invitations).
-- Roles: solo `authenticated` tiene policies. `anon` y otros no acceden.
--
-- Convenciones:
--   - Para tablas con `family_group_id` directo: lookup vía is_family_*.
--   - Para tablas con `child_id`: lookup vía is_family_*(child_family_group_id(child_id)).
--   - Soft delete (deleted_at) NO se filtra en RLS — se filtra en app (vía
--     índices parciales y vista timeline). RLS deja a admins ver y
--     restaurar filas borradas.
--
-- Reglas por dominio (ver docs/03-roles-permisos.md y ADR 0004):
--   - family_groups: cualquier authenticated crea; admin edita/borra.
--   - family_memberships: el propio user se agrega O un admin agrega; solo admin edita/borra.
--   - invitations: solo admin (SELECT/INSERT/DELETE).
--   - child_profiles: solo admin escribe (ADR 0004).
--   - child_measurements: solo admin escribe (ADR 0004).
--   - sleep/feeding/diaper: caregiver+admin insertan/editan; solo admin borra.
--   - notes: cualquier miembro inserta; autor o admin edita; solo admin borra.
--   - media_items: cualquier miembro inserta; autor o admin edita y borra.
--   - audit_logs: solo admin lee; nadie escribe (trigger SECURITY DEFINER).
-- ============================================================================

-- Enable RLS ----------------------------------------------------------------

alter table public.family_groups enable row level security;
alter table public.family_memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.child_profiles enable row level security;
alter table public.child_measurements enable row level security;
alter table public.sleep_sessions enable row level security;
alter table public.feeding_events enable row level security;
alter table public.diaper_events enable row level security;
alter table public.notes enable row level security;
alter table public.media_items enable row level security;
alter table public.audit_logs enable row level security;

-- family_groups -------------------------------------------------------------

create policy "family_groups: members can read"
  on public.family_groups
  for select
  to authenticated
  using (public.is_family_member(id));

create policy "family_groups: any authenticated can create"
  on public.family_groups
  for insert
  to authenticated
  with check (true);

create policy "family_groups: admins can update"
  on public.family_groups
  for update
  to authenticated
  using (public.is_family_admin(id))
  with check (public.is_family_admin(id));

create policy "family_groups: admins can delete"
  on public.family_groups
  for delete
  to authenticated
  using (public.is_family_admin(id));

-- family_memberships --------------------------------------------------------

create policy "family_memberships: members can read"
  on public.family_memberships
  for select
  to authenticated
  using (public.is_family_member(family_group_id));

-- INSERT permitido en dos casos:
--   (a) el propio user se agrega (necesario para bootstrap del primer admin
--       después de crear un family_group);
--   (b) un admin existente agrega a otro user.
create policy "family_memberships: self-add or admin-add"
  on public.family_memberships
  for insert
  to authenticated
  with check (
    user_id = auth.uid() or public.is_family_admin(family_group_id)
  );

create policy "family_memberships: admins can update"
  on public.family_memberships
  for update
  to authenticated
  using (public.is_family_admin(family_group_id))
  with check (public.is_family_admin(family_group_id));

create policy "family_memberships: admins can delete"
  on public.family_memberships
  for delete
  to authenticated
  using (public.is_family_admin(family_group_id));

-- invitations ---------------------------------------------------------------

create policy "invitations: admins can read"
  on public.invitations
  for select
  to authenticated
  using (public.is_family_admin(family_group_id));

create policy "invitations: admins can create (must self-attribute)"
  on public.invitations
  for insert
  to authenticated
  with check (
    public.is_family_admin(family_group_id)
    and invited_by = auth.uid()
  );

create policy "invitations: admins can delete"
  on public.invitations
  for delete
  to authenticated
  using (public.is_family_admin(family_group_id));

-- child_profiles (ADR 0004) -------------------------------------------------

create policy "child_profiles: members can read"
  on public.child_profiles
  for select
  to authenticated
  using (public.is_family_member(family_group_id));

create policy "child_profiles: admins can create"
  on public.child_profiles
  for insert
  to authenticated
  with check (public.is_family_admin(family_group_id));

create policy "child_profiles: admins can update"
  on public.child_profiles
  for update
  to authenticated
  using (public.is_family_admin(family_group_id))
  with check (public.is_family_admin(family_group_id));

create policy "child_profiles: admins can delete"
  on public.child_profiles
  for delete
  to authenticated
  using (public.is_family_admin(family_group_id));

-- child_measurements (ADR 0004 — datos médicos) -----------------------------

create policy "child_measurements: members can read"
  on public.child_measurements
  for select
  to authenticated
  using (public.is_family_member(public.child_family_group_id(child_id)));

create policy "child_measurements: admins can create (must self-attribute)"
  on public.child_measurements
  for insert
  to authenticated
  with check (
    public.is_family_admin(public.child_family_group_id(child_id))
    and created_by = auth.uid()
  );

create policy "child_measurements: admins can update"
  on public.child_measurements
  for update
  to authenticated
  using (public.is_family_admin(public.child_family_group_id(child_id)))
  with check (public.is_family_admin(public.child_family_group_id(child_id)));

create policy "child_measurements: admins can delete"
  on public.child_measurements
  for delete
  to authenticated
  using (public.is_family_admin(public.child_family_group_id(child_id)));

-- sleep_sessions ------------------------------------------------------------

create policy "sleep_sessions: members can read"
  on public.sleep_sessions
  for select
  to authenticated
  using (public.is_family_member(public.child_family_group_id(child_id)));

create policy "sleep_sessions: caregiver+admin can create (self-attributed)"
  on public.sleep_sessions
  for insert
  to authenticated
  with check (
    public.is_family_caregiver_or_admin(public.child_family_group_id(child_id))
    and created_by = auth.uid()
  );

create policy "sleep_sessions: caregiver+admin can update"
  on public.sleep_sessions
  for update
  to authenticated
  using (public.is_family_caregiver_or_admin(public.child_family_group_id(child_id)))
  with check (public.is_family_caregiver_or_admin(public.child_family_group_id(child_id)));

create policy "sleep_sessions: admins can delete"
  on public.sleep_sessions
  for delete
  to authenticated
  using (public.is_family_admin(public.child_family_group_id(child_id)));

-- feeding_events ------------------------------------------------------------

create policy "feeding_events: members can read"
  on public.feeding_events
  for select
  to authenticated
  using (public.is_family_member(public.child_family_group_id(child_id)));

create policy "feeding_events: caregiver+admin can create (self-attributed)"
  on public.feeding_events
  for insert
  to authenticated
  with check (
    public.is_family_caregiver_or_admin(public.child_family_group_id(child_id))
    and created_by = auth.uid()
  );

create policy "feeding_events: caregiver+admin can update"
  on public.feeding_events
  for update
  to authenticated
  using (public.is_family_caregiver_or_admin(public.child_family_group_id(child_id)))
  with check (public.is_family_caregiver_or_admin(public.child_family_group_id(child_id)));

create policy "feeding_events: admins can delete"
  on public.feeding_events
  for delete
  to authenticated
  using (public.is_family_admin(public.child_family_group_id(child_id)));

-- diaper_events -------------------------------------------------------------

create policy "diaper_events: members can read"
  on public.diaper_events
  for select
  to authenticated
  using (public.is_family_member(public.child_family_group_id(child_id)));

create policy "diaper_events: caregiver+admin can create (self-attributed)"
  on public.diaper_events
  for insert
  to authenticated
  with check (
    public.is_family_caregiver_or_admin(public.child_family_group_id(child_id))
    and created_by = auth.uid()
  );

create policy "diaper_events: caregiver+admin can update"
  on public.diaper_events
  for update
  to authenticated
  using (public.is_family_caregiver_or_admin(public.child_family_group_id(child_id)))
  with check (public.is_family_caregiver_or_admin(public.child_family_group_id(child_id)));

create policy "diaper_events: admins can delete"
  on public.diaper_events
  for delete
  to authenticated
  using (public.is_family_admin(public.child_family_group_id(child_id)));

-- notes ---------------------------------------------------------------------

create policy "notes: members can read"
  on public.notes
  for select
  to authenticated
  using (public.is_family_member(public.child_family_group_id(child_id)));

create policy "notes: members can create (self-attributed)"
  on public.notes
  for insert
  to authenticated
  with check (
    public.is_family_member(public.child_family_group_id(child_id))
    and created_by = auth.uid()
  );

create policy "notes: author or admin can update"
  on public.notes
  for update
  to authenticated
  using (
    created_by = auth.uid()
    or public.is_family_admin(public.child_family_group_id(child_id))
  )
  with check (
    created_by = auth.uid()
    or public.is_family_admin(public.child_family_group_id(child_id))
  );

create policy "notes: admins can delete"
  on public.notes
  for delete
  to authenticated
  using (public.is_family_admin(public.child_family_group_id(child_id)));

-- media_items ---------------------------------------------------------------

create policy "media_items: members can read"
  on public.media_items
  for select
  to authenticated
  using (public.is_family_member(public.child_family_group_id(child_id)));

create policy "media_items: members can create (self-attributed)"
  on public.media_items
  for insert
  to authenticated
  with check (
    public.is_family_member(public.child_family_group_id(child_id))
    and created_by = auth.uid()
  );

create policy "media_items: uploader or admin can update"
  on public.media_items
  for update
  to authenticated
  using (
    created_by = auth.uid()
    or public.is_family_admin(public.child_family_group_id(child_id))
  )
  with check (
    created_by = auth.uid()
    or public.is_family_admin(public.child_family_group_id(child_id))
  );

create policy "media_items: uploader or admin can delete"
  on public.media_items
  for delete
  to authenticated
  using (
    created_by = auth.uid()
    or public.is_family_admin(public.child_family_group_id(child_id))
  );

-- audit_logs ----------------------------------------------------------------
-- Solo SELECT, y solo para admins de la familia involucrada.
-- INSERT ocurre vía audit_trigger_fn() (SECURITY DEFINER → bypassea RLS).
-- UPDATE y DELETE no tienen policy: la tabla es inmutable para roles app.

create policy "audit_logs: family admins can read"
  on public.audit_logs
  for select
  to authenticated
  using (
    family_group_id is not null
    and public.is_family_admin(family_group_id)
  );
