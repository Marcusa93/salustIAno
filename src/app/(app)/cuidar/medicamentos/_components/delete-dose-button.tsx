'use client';

import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { deleteMedicationDoseAction } from '../actions';

export function DeleteDoseButton({ id }: { id: string }) {
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    if (!confirm('¿Borrar esta dosis del historial?')) return;
    setPending(true);
    await deleteMedicationDoseAction(id);
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Borrar dosis"
      disabled={pending}
      onClick={handleDelete}
      className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
    >
      <Trash2 className="size-3.5" aria-hidden />
    </Button>
  );
}
