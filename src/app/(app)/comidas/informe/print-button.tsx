'use client';

import { Printer } from 'lucide-react';

/** Abre el diálogo del navegador: desde ahí se imprime o se guarda como PDF. */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-10 items-center gap-2 rounded-xl bg-solid px-4 font-medium text-sm text-white shadow-[0_12px_24px_-16px_var(--elevation)] transition-transform active:scale-[0.98] dark:text-background print:hidden"
    >
      <Printer className="size-4" aria-hidden />
      Imprimir o guardar PDF
    </button>
  );
}
