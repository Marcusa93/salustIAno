'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ImageIcon, Loader2, Trash2, Upload } from 'lucide-react';
import { type ChangeEvent, useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { getPhotoUrlAction } from '../../../album/actions';
import { type NotePhoto, attachPhotosToNoteAction, detachPhotoFromNoteAction } from '../../actions';

interface NotePhotosProps {
  noteId: string;
  initial: NotePhoto[];
  /** Si false, ocultamos uploader y delete. */
  canEdit: boolean;
}

/**
 * Sección de fotos adjuntas al pie de la nota. Permite:
 *  - Subir 1+ fotos al bucket photos/{family}/notes/...
 *  - Ver miniaturas con caption
 *  - Sacar foto de la nota (no la borra, solo desasocia)
 *
 * Las URLs firmadas se piden client-side para mantener el path privado;
 * se cachean en el state para que no se recarguen al cambiar lista.
 */
export function NotePhotos({ noteId, initial, canEdit }: NotePhotosProps) {
  const [photos, setPhotos] = useState(initial);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [uploading, startUpload] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  // Cargar signed URLs cuando cambia la lista. Pedimos solo las que faltan
  // (acumulamos en `urls` para evitar doble fetch al sumar/sacar fotos).
  useEffect(() => {
    let cancelled = false;
    async function loadUrls() {
      const missing = photos.filter((p) => urls[p.id] === undefined);
      if (missing.length === 0) return;
      const next: Record<string, string> = {};
      for (const p of missing) {
        const r = await getPhotoUrlAction(p.storagePath);
        if (r.ok) next[p.id] = r.url;
      }
      if (!cancelled && Object.keys(next).length > 0) {
        setUrls((prev) => ({ ...prev, ...next }));
      }
    }
    loadUrls();
    return () => {
      cancelled = true;
    };
  }, [photos, urls]);

  function handlePick() {
    fileRef.current?.click();
  }

  function handleFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const fd = new FormData();
    for (const f of Array.from(files)) fd.append('photos', f);

    startUpload(async () => {
      const result = await attachPhotosToNoteAction(noteId, fd);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.uploaded === 0) {
        toast.error('No pudimos subir ninguna foto.');
      } else {
        toast.success(
          `Subimos ${result.uploaded} foto${result.uploaded === 1 ? '' : 's'}${
            result.failed > 0 ? `. ${result.failed} fallaron.` : '.'
          }`,
        );
        // Refrescar — el server action hizo revalidatePath, pero nosotros
        // necesitamos hidratar la lista local. Usamos location.reload para
        // simplicidad (la ruta SSR rehidrata photos del server).
        window.location.reload();
      }
    });
    if (fileRef.current) fileRef.current.value = '';
  }

  function handleDetach(photoId: string) {
    if (!window.confirm('¿Sacar esta foto de la nota? La foto sigue en tu álbum.')) return;
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    void detachPhotoFromNoteAction(photoId).then((r) => {
      if (!r.ok) toast.error(r.error);
    });
  }

  if (photos.length === 0 && !canEdit) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-medium text-muted-foreground text-xs uppercase tracking-[0.18em]">
          Fotos del momento
        </h2>
        {canEdit && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              multiple
              className="hidden"
              onChange={handleFiles}
            />
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={handlePick}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="size-3 animate-spin" aria-hidden />
              ) : (
                <Upload className="size-3" aria-hidden />
              )}
              {uploading ? 'Subiendo…' : photos.length === 0 ? 'Sumar fotos' : 'Sumar más'}
            </Button>
          </>
        )}
      </div>

      {photos.length === 0 ? (
        canEdit && (
          <Card className="flex flex-col items-center gap-2 p-6 text-center text-muted-foreground text-sm">
            <ImageIcon className="size-6" aria-hidden />
            <span>Sumá una foto si querés que el momento quede más completo.</span>
          </Card>
        )
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {photos.map((p) => {
            const url = urls[p.id];
            return (
              <li
                key={p.id}
                className="group relative aspect-square overflow-hidden rounded-xl bg-muted/40"
              >
                {url ? (
                  <img
                    src={url}
                    alt={p.caption ?? 'Foto del momento'}
                    className="size-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-muted-foreground/40">
                    <Loader2 className="size-5 animate-spin" aria-hidden />
                  </div>
                )}
                {p.caption && (
                  <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-foreground/60 to-transparent p-2 text-left font-medium text-[11px] text-white">
                    {p.caption}
                  </span>
                )}
                {canEdit && (
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    onClick={() => handleDetach(p.id)}
                    aria-label="Sacar foto de la nota"
                    className="absolute top-1 right-1 bg-background/80 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Trash2 className="size-3" aria-hidden />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
