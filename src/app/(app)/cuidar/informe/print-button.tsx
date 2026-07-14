'use client';

import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

export function PrintButton() {
  return (
    <Button
      type="button"
      variant="default"
      size="sm"
      onClick={() => window.print()}
      className="gap-2 print:hidden"
    >
      <Printer className="size-4" aria-hidden />
      Imprimir / Guardar PDF
    </Button>
  );
}
