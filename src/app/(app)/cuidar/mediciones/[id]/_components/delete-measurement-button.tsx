'use client';

import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { deleteMeasurementAction } from '../../actions';

export function DeleteMeasurementButton({ id }: { id: string }) {
  const [pending, start] = useTransition();

  function handleClick() {
    if (!confirm('¿Borrar esta medición? La podés restaurar dentro de 30 días.')) return;
    start(async () => {
      const result = await deleteMeasurementAction(id);
      if (!result.ok) {
        toast.error(result.error);
      }
    });
  }

  return (
    <Button onClick={handleClick} variant="ghost" size="sm" disabled={pending}>
      <Trash2 className="size-4" aria-hidden />
      Borrar
    </Button>
  );
}
