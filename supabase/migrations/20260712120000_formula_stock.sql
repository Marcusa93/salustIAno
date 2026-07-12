-- Stock de fórmula láctea (en cajas/latas) por bebé.
-- Una fila por familia+bebé; se actualiza con UPDATE atómico desde la app.

create table if not exists public.formula_stock (
  id              uuid primary key default gen_random_uuid(),
  family_group_id uuid not null
    references public.family_groups (id) on delete cascade,
  child_id        uuid not null
    references public.child_profiles (id) on delete cascade,

  -- Estado actual del stock
  current_boxes   integer not null default 0,

  -- Configuración de alerta y presentación
  alert_threshold integer not null default 10,
  ml_per_box      integer not null default 200,
  brand           text,

  -- Auditoría
  updated_by      uuid references auth.users (id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint formula_stock_unique_per_child unique (family_group_id, child_id),
  constraint formula_stock_boxes_gte_0      check (current_boxes   >= 0),
  constraint formula_stock_threshold_gte_0  check (alert_threshold >= 0),
  constraint formula_stock_ml_positive      check (ml_per_box       > 0)
);

comment on table public.formula_stock is
  'Stock de fórmula láctea por bebé. Una fila por familia+bebé, actualizada manualmente.';

alter table public.formula_stock enable row level security;

-- SELECT: cualquier miembro del grupo familiar.
create policy "formula_stock: leer"
  on public.formula_stock for select
  using (
    exists (
      select 1 from public.family_memberships m
      where m.family_group_id = formula_stock.family_group_id
        and m.user_id = auth.uid()
        and m.deleted_at is null
    )
  );

-- INSERT: cuidadores y admins.
create policy "formula_stock: insertar"
  on public.formula_stock for insert
  with check (
    exists (
      select 1 from public.family_memberships m
      where m.family_group_id = formula_stock.family_group_id
        and m.user_id = auth.uid()
        and m.role in ('admin', 'caregiver')
        and m.deleted_at is null
    )
  );

-- UPDATE: cuidadores y admins.
create policy "formula_stock: actualizar"
  on public.formula_stock for update
  using (
    exists (
      select 1 from public.family_memberships m
      where m.family_group_id = formula_stock.family_group_id
        and m.user_id = auth.uid()
        and m.role in ('admin', 'caregiver')
        and m.deleted_at is null
    )
  );
