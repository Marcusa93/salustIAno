'use client';

// Error boundary catch-all para rutas de (app).
// reset() reintenta el render del segmento.

import { Button } from '@/components/ui/button';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ reset }: ErrorPageProps) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center justify-center gap-6 px-4 py-20 sm:px-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-muted-foreground text-base">Algo salió mal. Probá de nuevo.</p>
      </div>
      <Button onClick={reset} variant="outline">
        Intentar de nuevo
      </Button>
    </div>
  );
}
