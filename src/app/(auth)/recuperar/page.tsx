import type { Metadata } from 'next';
import Link from 'next/link';
import { RequestResetForm } from './_components/request-reset-form';

export const metadata: Metadata = {
  title: 'Recuperar contraseña',
};

interface RecuperarPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function RecuperarPage({ searchParams }: RecuperarPageProps) {
  const { error } = await searchParams;
  const expiredLink = error === 'session_missing';

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h1 className="font-heading text-4xl leading-tight tracking-tight">
          ¿Olvidaste tu contraseña?
        </h1>
        <p className="text-muted-foreground">
          Te mandamos un link al mail para que elijas una nueva.
        </p>
      </div>

      {expiredLink && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-destructive text-sm">
          El link venció o ya se usó. Pedí uno nuevo abajo.
        </div>
      )}

      <RequestResetForm />

      <p className="text-muted-foreground text-sm">
        ¿La recordaste?{' '}
        <Link
          href="/login"
          className="font-heading text-foreground italic underline-offset-4 hover:underline"
        >
          Volver a entrar.
        </Link>
      </p>
    </div>
  );
}
