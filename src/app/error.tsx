'use client';

import { HeartIllustration } from '@/components/salu/illustrations';
import Link from 'next/link';

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 text-center">
      <HeartIllustration className="h-24 w-24 text-primary opacity-40" />
      <div className="flex flex-col gap-3">
        <h1 className="font-heading text-3xl tracking-tight">Algo se rompió.</h1>
        <p className="mx-auto max-w-xs text-muted-foreground">
          Probá de nuevo. Si sigue, escribime.
        </p>
        {process.env.NODE_ENV === 'development' && (
          <pre className="mx-auto mt-2 max-w-sm overflow-auto rounded-lg bg-muted p-4 text-left text-destructive text-xs">
            {error.message}
            {error.digest && `\ndigest: ${error.digest}`}
          </pre>
        )}
      </div>
      <div className="flex items-center gap-6">
        <button
          type="button"
          onClick={unstable_retry}
          className="text-foreground text-sm underline underline-offset-4 transition-colors hover:text-muted-foreground"
        >
          Reintentar.
        </button>
        <Link
          href="/"
          className="text-muted-foreground text-sm transition-colors hover:text-foreground"
        >
          Volver al inicio.
        </Link>
      </div>
    </div>
  );
}
