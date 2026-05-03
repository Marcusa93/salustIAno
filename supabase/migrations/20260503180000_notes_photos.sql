-- ============================================================================
-- Migration 018 — Notas con fotos adjuntas.
--
-- Permitimos asociar fotos de `media_items` a una `note` puntual. Una foto
-- puede pertenecer a un álbum (album_id), a una nota (note_id), o a ambos.
-- Cuando la nota se borra (soft o hard), el note_id se setea NULL — la foto
-- sobrevive como item del álbum o suelta en el bucket.
-- ============================================================================

alter table public.media_items
  add column if not exists note_id uuid references public.notes(id) on delete set null;

create index if not exists media_items_note_idx
  on public.media_items (note_id)
  where note_id is not null and deleted_at is null;
