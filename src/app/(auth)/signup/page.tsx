import type { Metadata } from 'next';
import Link from 'next/link';
import { SignupForm } from './_components/signup-form';

export const metadata: Metadata = {
  title: 'Creá la casa',
};

export default function SignupPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h1 className="font-heading text-4xl leading-tight tracking-tight">Creá la casa.</h1>
        <p className="text-muted-foreground">Para que cuando llegue, todo esté listo.</p>
      </div>

      <SignupForm />

      <p className="text-muted-foreground text-sm">
        ¿Ya tenés casa?{' '}
        <Link
          href="/login"
          className="font-heading text-foreground italic underline-offset-4 hover:underline"
        >
          Entrá.
        </Link>
      </p>
    </div>
  );
}
