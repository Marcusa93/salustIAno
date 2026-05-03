-- ============================================================================
-- Migration 017 — Compartir álbumes por link público.
--
-- Mismo patrón que canciones y cuentos: agregamos `share_token` + `shared_at`
-- a `albums`. Cuando la familia clickea Compartir, generamos un token random
-- y guardamos. La URL `/compartir/album/[token]` lookup sin auth (anon).
-- Revocable poniendo a NULL.
--
-- Para que el público pueda ver las fotos del álbum compartido, sumamos
-- policies que permitan SELECT en `media_items` y en `storage.objects`
-- (bucket `photos`) cuando el álbum tiene un share_token activo.
-- ============================================================================

alter table public.albums
  add column if not exists share_token text unique,
  add column if not exists shared_at timestamptz;

create index if not exists albums_share_token_idx
  on public.albums (share_token)
  where share_token is not null and deleted_at is null;

-- 1. Anon puede leer el álbum si tiene share_token.
drop policy if exists "albums: select por share_token" on public.albums;
create policy "albums: select por share_token" on public.albums
  for select to anon, authenticated
  using (share_token is not null and deleted_at is null);

-- 2. Anon puede leer las media_items asociadas a álbumes compartidos.
--    No tocamos las policies de media_items por familia (ya existen) —
--    sumamos esta como condición OR.
drop policy if exists "media_items: select por album_share_token" on public.media_items;
create policy "media_items: select por album_share_token" on public.media_items
  for select to anon, authenticated
  using (
    deleted_at is null
    and album_id is not null
    and exists (
      select 1 from public.albums a
      where a.id = album_id
        and a.share_token is not null
        and a.deleted_at is null
    )
  );

-- 3. Anon puede leer los objetos de storage (bucket photos) cuyas filas
--    correspondientes en media_items están en un álbum compartido.
drop policy if exists "photos storage: select compartidas" on storage.objects;
create policy "photos storage: select compartidas"
  on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'photos'
    and exists (
      select 1
      from public.media_items mi
      join public.albums a on a.id = mi.album_id
      where mi.storage_path = name
        and mi.deleted_at is null
        and a.share_token is not null
        and a.deleted_at is null
    )
  );
