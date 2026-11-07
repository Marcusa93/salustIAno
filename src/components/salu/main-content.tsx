import type * as React from 'react';
import { ViewTransition } from 'react';

interface Props {
  children: React.ReactNode;
}

/**
 * Contenido principal. Cada navegación anima solo esta parte (fundido con
 * un leve deslizamiento, ver `salu-page` en globals.css): el header, la
 * barra de abajo y el sidebar quedan quietos.
 */
export function MainContent({ children }: Props) {
  return (
    <ViewTransition default="salu-page">
      <main id="main" className="min-w-0 flex-1 py-8 pb-20 md:pb-8 print:py-0 print:pb-0">
        {children}
      </main>
    </ViewTransition>
  );
}
