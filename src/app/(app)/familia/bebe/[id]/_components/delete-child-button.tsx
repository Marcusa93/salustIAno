'use client';

import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { deleteChildAction } from '../../actions';

export function DeleteChildButton({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();

  function handleClick() {
    if (
      !confirm(
        `¿Borrar el perfil de ${name}? Lo podés restaurar si te arrepentís (queda en histórico 30 días).`,
      )
    )
      return;
    start(async () => {
      const result = await deleteChildAction(id);
      if (!result.ok) {
        toast.error(result.error);
      }
    });
  }

  return (
    <Button onClick={handleClick} variant="ghost" size="sm" disabled={pending}>
      <Trash2 className="size-4" aria-hidden />
      Borrar perfil
    </Button>
  );
}
