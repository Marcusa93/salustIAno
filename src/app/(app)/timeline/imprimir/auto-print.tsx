'use client';

import { useEffect } from 'react';

/**
 * Dispara `window.print()` apenas el componente hidrata. La página de
 * impresión usa la print stylesheet de globals.css (oculta nav/sidebar/
 * footer, fuerza fondo blanco). El usuario decide en el diálogo si
 * imprime o exporta a PDF.
 */
export function AutoPrint() {
  useEffect(() => {
    // Pequeño delay para asegurarnos que las fuentes y el layout terminaron
    // de pintar antes de invocar el diálogo.
    const t = setTimeout(() => {
      window.print();
    }, 400);
    return () => clearTimeout(t);
  }, []);
  return null;
}
