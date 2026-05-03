-- ============================================================================
-- Migration 014 — Tokens de compartir para canciones y cuentos.
--
-- Agregamos `share_token text unique` a `lullabies` y `stories`. Cuando
-- la familia clickea "Compartir", el server genera un token random y lo
-- guarda. La URL pública `/compartir/[token]` lookup por token sin
-- requerir auth — para que la abuela pueda escuchar la nana sin tener
-- cuenta en la app. Revocable poniendo el campo a NULL.
-- ============================================================================

alter table public.lullabies
  add column if not exists share_token text unique,
  add column if not exists shared_at timestamptz;

alter table public.stories
  add column if not exists share_token text unique,
  add column if not exists shared_at timestamptz;

-- Index para lookup por token (queries públicas sin auth).
create index if not exists lullabies_share_token_idx
  on public.lullabies (share_token)
  where share_token is not null and deleted_at is null;

create index if not exists stories_share_token_idx
  on public.stories (share_token)
  where share_token is not null and deleted_at is null;

-- Policies adicionales: cuando hay share_token, permitimos SELECT sin auth.
-- Para esto el shared client pública usa la public key (anon). La RLS
-- existente sigue protegiendo todo lo demás — solo abrimos lo que tiene
-- token explícitamente seteado.

create policy "lullabies: select por share_token" on public.lullabies
  for select to anon, authenticated
  using (share_token is not null and deleted_at is null);

create policy "stories: select por share_token" on public.stories
  for select to anon, authenticated
  using (share_token is not null and deleted_at is null);

-- También necesitamos que el bucket lullabies sirva a anon cuando el
-- objeto pertenece a una nana compartida. Hacemos una policy más amplia:
-- cualquier select sobre objetos del bucket lullabies cuyo path
-- corresponde a una nana con share_token activo.

drop policy if exists "lullabies storage: select compartidas" on storage.objects;
create policy "lullabies storage: select compartidas"
  on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'lullabies'
    and exists (
      select 1 from public.lullabies l
      where l.audio_path = name
        and l.share_token is not null
        and l.deleted_at is null
    )
  );
