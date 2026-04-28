import { HeartIllustration } from '@/components/salu/illustrations';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 text-center">
      <HeartIllustration className="h-24 w-24 text-primary opacity-40" />
      <div className="flex flex-col gap-3">
        <h1 className="font-heading text-3xl tracking-tight">Esta página no existe todavía.</h1>
        <p className="mx-auto max-w-xs text-muted-foreground">
          Como tantas cosas que todavía no pasaron.
        </p>
      </div>
      <Link
        href="/"
        className="flex items-center gap-1 text-muted-foreground text-sm transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        volver
      </Link>
    </div>
  );
}
