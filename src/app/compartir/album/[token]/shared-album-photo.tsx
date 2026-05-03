'use client';

import { ImageIcon } from 'lucide-react';
import { useState } from 'react';

/**
 * Thumbnail dentro del álbum compartido. Click → abre la foto en grande
 * en una nueva pestaña (sin necesidad de modal complicado: la página es
 * pública y read-only).
 */
export function SharedAlbumPhoto({
  photo,
}: {
  photo: { id: string; signedUrl: string | null; caption: string | null; takenAt: string | null };
}) {
  const [errored, setErrored] = useState(false);

  if (!photo.signedUrl || errored) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-xl bg-muted/40 text-muted-foreground/40">
        <ImageIcon className="size-6" aria-hidden />
      </div>
    );
  }

  return (
    <a
      href={photo.signedUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative aspect-square overflow-hidden rounded-xl bg-muted/40 outline-none transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
    >
      <img
        src={photo.signedUrl}
        alt={photo.caption ?? 'Foto'}
        loading="lazy"
        onError={() => setErrored(true)}
        className="size-full object-cover transition-transform group-hover:scale-105"
      />
      {photo.caption && (
        <span className="absolute right-0 bottom-0 left-0 truncate bg-gradient-to-t from-foreground/60 to-transparent p-2 text-left font-medium text-[11px] text-white">
          {photo.caption}
        </span>
      )}
    </a>
  );
}
