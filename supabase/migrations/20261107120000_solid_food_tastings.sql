-- Alimentación complementaria: el detalle de cada alimento de una comida.
--
-- La comida en sí sigue siendo un feeding_events con type = 'solid' (así
-- aparece en el registro, el inicio, el realtime y lo que lee SalustIA).
-- Esta tabla guarda, por cada alimento de esa comida, cómo se lo
-- ofrecieron, si le gustó, cuánto comió y si hubo arcadas o reacción.
-- Con eso la app cuenta exposiciones por alimento, sigue los alérgenos y
-- sugiere qué probar después.

create type public.food_format as enum ('puree', 'mashed', 'preloaded', 'finger');
create type public.food_acceptance as enum ('loved', 'liked', 'neutral', 'disliked', 'refused');
create type public.food_amount as enum ('taste', 'some', 'half', 'most', 'all');

create table public.solid_food_tastings (
  id uuid primary key default gen_random_uuid(),
  feeding_event_id uuid not null references public.feeding_events(id) on delete cascade,
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  -- Id del catálogo de la app (src/lib/solids/catalog.ts) u "otro:<nombre>".
  food_key text not null,
  food_name text not null,
  format public.food_format,
  acceptance public.food_acceptance,
  amount public.food_amount,
  gagged boolean not null default false,
  reaction public.feeding_reaction not null default 'none',
  reaction_signs text[] not null default '{}',
  position smallint not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- No se usa para borrar (editar reemplaza las filas), pero el trigger de
  -- auditoría compara old/new.deleted_at en cada UPDATE.
  deleted_at timestamptz,
  constraint solid_food_tastings_key_length check (char_length(food_key) between 1 and 120),
  constraint solid_food_tastings_name_length check (char_length(food_name) between 1 and 100),
  constraint solid_food_tastings_signs_count check (cardinality(reaction_signs) <= 10),
  constraint solid_food_tastings_position_range check (position between 0 and 30)
);

comment on table public.solid_food_tastings is
  'Alimentos de cada comida sólida (feeding_events type=solid): formato, aceptación, cantidad, arcadas y reacción.';

create index solid_food_tastings_event_idx on public.solid_food_tastings (feeding_event_id);
create index solid_food_tastings_child_food_idx on public.solid_food_tastings (child_id, food_key);

create trigger trg_solid_food_tastings_set_updated_at
before update on public.solid_food_tastings
for each row execute function public.set_updated_at();

create trigger trg_audit_solid_food_tastings
after insert or update or delete on public.solid_food_tastings
for each row execute function public.audit_trigger_fn();

-- RLS: igual que feeding_events, y además el alimento tiene que colgar de
-- una comida sólida del mismo bebé.
alter table public.solid_food_tastings enable row level security;

create policy "solid_food_tastings: members can read"
  on public.solid_food_tastings
  for select
  to authenticated
  using (public.is_family_member(public.child_family_group_id(child_id)));

create policy "solid_food_tastings: caregiver+admin can create"
  on public.solid_food_tastings
  for insert
  to authenticated
  with check (
    public.is_family_caregiver_or_admin(public.child_family_group_id(child_id))
    and created_by = auth.uid()
    and exists (
      select 1 from public.feeding_events f
      where f.id = feeding_event_id
        and f.child_id = solid_food_tastings.child_id
        and f.type = 'solid'
    )
  );

create policy "solid_food_tastings: caregiver+admin can update"
  on public.solid_food_tastings
  for update
  to authenticated
  using (public.is_family_caregiver_or_admin(public.child_family_group_id(child_id)))
  with check (
    public.is_family_caregiver_or_admin(public.child_family_group_id(child_id))
    and exists (
      select 1 from public.feeding_events f
      where f.id = feeding_event_id
        and f.child_id = solid_food_tastings.child_id
        and f.type = 'solid'
    )
  );

-- Editar una comida reemplaza sus alimentos, así que cuidadores también
-- pueden borrar filas (la comida en sí se sigue borrando de forma lógica).
create policy "solid_food_tastings: caregiver+admin can delete"
  on public.solid_food_tastings
  for delete
  to authenticated
  using (public.is_family_caregiver_or_admin(public.child_family_group_id(child_id)));
