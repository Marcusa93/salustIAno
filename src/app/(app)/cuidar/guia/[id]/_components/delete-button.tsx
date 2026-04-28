'use client';

import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { deleteCareGuideAction } from '../../actions';

interface DeleteButtonProps {
  id: string;
  title: string;
}

/**
 * Botón con confirmación nativa para borrar una entrada de la guía.
 *
 * Usa `confirm()` del browser — sencillo y funciona sin librerías. Si la
 * UX se vuelve más exigente (ej. modal con razón de borrado), reemplazar
 * por un AlertDialog de shadcn.
 */
export function DeleteCareGuideButton({ id, title }: DeleteButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm(`¿Borrar "${title}"? Lo podés restaurar si te arrepentís.`)) return;

    startTransition(async () => {
      const result = await deleteCareGuideAction(id);
      if (!result.ok) {
        toast.error(result.errors.root ?? 'No pudimos borrar la entrada.');
      }
    });
  }

  return (
    <Button onClick={handleClick} variant="ghost" size="sm" disabled={isPending}>
      <Trash2 className="size-4" aria-hidden />
      Borrar
    </Button>
  );
}
