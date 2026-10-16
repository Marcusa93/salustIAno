import { MailOpen } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';

/**
 * Aviso de una carta programada (ver `scheduledLetterAt`). Solo aparece en
 * la ventana de fechas de la carta, así que antes nadie se la cruza.
 */
export function LetterEnvelopeCard({ slug }: { slug: string }) {
  return (
    <Link
      href={`/carta/${slug}` as Route}
      className="group relative flex items-center gap-5 overflow-hidden rounded-2xl bg-carta-night px-6 py-5 text-carta-night-foreground shadow-[0_20px_40px_-24px_var(--carta-shadow)] outline-none transition-transform focus-visible:ring-4 focus-visible:ring-carta-glow/50 active:scale-[0.99]"
    >
      <span
        aria-hidden
        className="-top-16 -left-10 absolute size-48 rounded-full bg-carta-glow/20 blur-3xl"
      />
      <span className="relative grid size-14 shrink-0 animate-breathe place-items-center rounded-full bg-carta-seal text-carta-paper shadow-lg ring-4 ring-carta-seal/30">
        <MailOpen className="size-6" aria-hidden />
      </span>
      <span className="relative flex flex-col">
        <span className="font-display text-2xl italic leading-tight">Salu te dejó una carta</span>
        <span className="text-carta-night-foreground/70 text-sm">
          Para mamá. Abrila con tiempo y con volumen.
        </span>
      </span>
    </Link>
  );
}
