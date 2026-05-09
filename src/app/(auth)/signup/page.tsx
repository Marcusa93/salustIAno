import type { Metadata } from 'next';
import Link from 'next/link';
import { SignupForm } from './_components/signup-form';

export const metadata: Metadata = {
  title: 'Creá la casa',
};

export default function SignupPage() {
  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-2.5">
        <span className="font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.22em]">
          Empezá
        </span>
        <h1 className="font-display text-[clamp(1.875rem,5vw,2.5rem)] text-foreground leading-[1.1] tracking-tight">
          Creá la casa.
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Para que cuando llegue, todo esté listo. Privado, sin redes, sin publicidad.
        </p>
      </div>

      <SignupForm />

      <p className="text-muted-foreground text-sm">
        ¿Ya tenés casa?{' '}
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
