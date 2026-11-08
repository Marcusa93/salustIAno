-- ============================================================================
-- Fotos de las comidas.
--
-- Una foto de `media_items` puede quedar asociada a una comida
-- (feeding_events type='solid'), igual que note_id la asocia a una nota.
-- La foto también entra al álbum del mes. Si la comida se borra en serio,
-- la foto sobrevive en el álbum con feeding_event_id en NULL.
-- Las policies de media_items ya filtran por familia: no cambian.
-- ============================================================================

alter table public.media_items
  add column if not exists feeding_event_id uuid
    references public.feeding_events(id) on delete set null;

create index if not exists media_items_feeding_event_idx
  on public.media_items (feeding_event_id)
  where feeding_event_id is not null and deleted_at is null;
