'use client';

import { Button } from '@/components/ui/button';
import { ImageIcon, Loader2, X } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { getDiaperPhotoUrlAction } from '../actions';

/**
 * Mini-botón "Ver foto" que aparece en filas de timeline / home cuando
 * un pañal tiene una foto adjunta. Al click pide un signed URL al server
 * (válido 5 min) y la abre en un modal centrado con backdrop.
 *
 * Lazy: solo pedimos el signed URL cuando la familia hace click. Un
 * timeline con cientos de pañales no genera cientos de URLs.
 */
export function DiaperPhotoLink({ path }: { path: string }) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  function handleOpen() {
    if (url) {
      setOpen(true);
      return;
    }
    startTransition(async () => {
      const result = await getDiaperPhotoUrlAction(path);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setUrl(result.url);
      setOpen(true);
    });
  }

  // Cerrar con Escape.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <Button
        type="button"
        size="xs"
        variant="ghost"
        onClick={handleOpen}
        disabled={pending}
        aria-label="Ver foto del pañal"
      >
        {pending ? (
          <Loader2 className="size-3 animate-spin" aria-hidden />
        ) : (
          <ImageIcon className="size-3" aria-hidden />
        )}
        Ver foto
      </Button>

      {open && url && (
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Cerrar"
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm"
        >
          <div
            // El click en la imagen no cierra el modal.
            onClickCapture={(e) => e.stopPropagation()}
            className="relative max-h-[90vh] max-w-[90vw]"
          >
            <span
              role="presentation"
              className="absolute -top-2 -right-2 z-10 inline-flex size-9 items-center justify-center rounded-full bg-card text-foreground shadow-lg"
            >
              <X className="size-4" aria-hidden />
            </span>
            <img
              src={url}
              alt="Foto del pañal"
              className="max-h-[90vh] max-w-[90vw] rounded-2xl bg-card object-contain shadow-2xl"
            />
          </div>
        </button>
      )}
    </>
  );
}
