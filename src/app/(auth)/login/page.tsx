import type { Metadata } from 'next';
import Link from 'next/link';
import { LoginForm } from './_components/login-form';

export const metadata: Metadata = {
  title: 'Entrá',
};

interface LoginPageProps {
  searchParams: Promise<{ next?: string; error?: string; confirmed?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-2.5">
        <span className="font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.22em]">
          Entrá
        </span>
        <h1 className="font-display text-[clamp(1.875rem,5vw,2.5rem)] text-foreground leading-[1.1] tracking-tight">
          A tu casa, Salu.
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Te está esperando lo del día — tomas, sueños, fotos, lo que registró la familia.
        </p>
      </div>

      <LoginForm
        next={params.next}
        errorParam={params.error}
        confirmedPending={params.confirmed === 'pending'}
      />

      <p className="text-muted-foreground text-sm">
        ¿Todavía no tenés casa?{' '}
        <Link
          href="/signup"
          className="font-display text-foreground italic underline-offset-4 hover:underline"
        >
          Creá una.
        </Link>
      </p>
    </div>
  );
}
