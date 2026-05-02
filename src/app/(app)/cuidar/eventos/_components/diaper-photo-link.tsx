'use client';

import { Button } from '@/components/ui/button';
import { ImageIcon, Loader2 } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { getDiaperPhotoUrlAction } from '../actions';

/**
 * Mini-botón "Ver foto" que aparece en filas de timeline / home cuando
 * un pañal tiene una foto adjunta. Al click pide un signed URL al server
 * (válido 5 min) y abre la foto en una pestaña nueva.
 *
 * Mantenemos el flujo lazy: no generamos URLs para todas las filas al
 * renderizar — solo cuando la familia las pide. Importante porque un
 * timeline puede tener cientos de eventos.
 */
export function DiaperPhotoLink({ path }: { path: string }) {
  const [pending, startTransition] = useTransition();

  function open() {
    startTransition(async () => {
      const result = await getDiaperPhotoUrlAction(path);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      window.open(result.url, '_blank', 'noopener,noreferrer');
    });
  }

  return (
    <Button
      type="button"
      size="xs"
      variant="ghost"
      onClick={open}
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
  );
}
