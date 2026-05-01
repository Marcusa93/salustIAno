import { createClient } from '@/lib/supabase/server';
import type { Metadata, Route } from 'next';
import { redirect } from 'next/navigation';
import { ResetPasswordForm } from './_components/reset-password-form';

export const metadata: Metadata = {
  title: 'Nueva contraseña',
};

export default async function RestablecerPage() {
  // Para llegar acá tenés que tener sesión activa, que se setea cuando
  // /auth/confirm verifyOtp con type=recovery. Si no hay sesión (link
  // expiró, lo abriste mal, etc.) volvemos a /recuperar con un mensaje.
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    redirect('/recuperar?error=session_missing' as Route);
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h1 className="font-heading text-4xl leading-tight tracking-tight">
          Elegí una contraseña nueva.
        </h1>
        <p className="text-muted-foreground">
          Tiene que ser distinta a la que tenías. Después te llevamos a casa.
        </p>
      </div>

      <ResetPasswordForm />
    </div>
  );
}
