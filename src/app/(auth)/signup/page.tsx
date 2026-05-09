import type { Metadata } from 'next';
import Link from 'next/link';
import { SignupForm } from './_components/signup-form';

export const metadata: Metadata = {
  title: 'Sumate a la familia',
};

interface PageProps {
  searchParams: Promise<{ code?: string }>;
}

/**
 * Página para redimir un código de invitación. Salu es privado: cada
 * cuenta nueva entra invitada por un admin del grupo (Marco o Abril).
 * Si el link viene con `?code=ABCD-1234` el form pre-rellena el campo —
 * así un share por WhatsApp con el deep link te deja a un toque de entrar.
 */
export default async function SignupPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const initialCode =
    typeof params.code === 'string' ? params.code.trim().toUpperCase() : undefined;

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-2.5">
        <span className="font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.22em]">
          Sumate
        </span>
        <h1 className="font-display text-[clamp(1.875rem,5vw,2.5rem)] text-foreground leading-[1.1] tracking-tight">
          Pegá tu código.
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Salu es privado por familia. Para entrar necesitás un código que te pasa Marco o Abril
          desde su /familia. Si todavía no lo tenés, pedíselo.
        </p>
      </div>

      <SignupForm {...(initialCode ? { initialCode } : {})} />

      <p className="text-muted-foreground text-sm">
        ¿Ya tenés cuenta?{' '}
        <Link
          href="/login"
          className="font-display text-foreground italic underline-offset-4 hover:underline"
        >
          Entrá.
        </Link>
      </p>
    </div>
  );
}
