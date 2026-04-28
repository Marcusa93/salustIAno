import type { Metadata } from 'next';
import Link from 'next/link';
import { LoginForm } from './_components/login-form';

export const metadata: Metadata = {
  title: 'Entrá',
};

export default function LoginPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h1 className="font-heading text-4xl leading-tight tracking-tight">Entrá a Salu.</h1>
        <p className="text-muted-foreground">Tu casa te está esperando.</p>
      </div>

      <LoginForm />

      <p className="text-muted-foreground text-sm">
        ¿Todavía no tenés casa?{' '}
        <Link
          href="/signup"
          className="font-heading text-foreground italic underline-offset-4 hover:underline"
        >
          Creá una.
        </Link>
      </p>
    </div>
  );
}
