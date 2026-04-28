'use client';

import { FormField } from '@/components/salu/form-field';
import { Button } from '@/components/ui/button';
import { type SignupInput, signupSchema } from '@/lib/validators/auth';
import { zodResolver } from '@/lib/zod-compat';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { signupAction } from '../actions';

export function SignupForm() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
  });

  async function onSubmit(data: SignupInput) {
    const result = await signupAction(data);

    if (!result.ok) {
      const rootMessage =
        result.errors.root ??
        result.errors.email ??
        'Hubo un problema al crear tu cuenta. Revisá los datos.';
      toast.error(rootMessage);
      return;
    }

    if (result.requiresEmailConfirmation) {
      toast.success('Te mandamos un mail para confirmar tu cuenta.');
      router.push('/login?confirmed=pending');
      return;
    }

    // Cuando el proyecto tiene confirmation desactivada, signUp ya deja
    // sesión activa. Mandamos directo al onboarding.
    toast.success('¡La casa está lista!');
    router.push('/onboarding');
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      aria-label="Formulario de registro"
      className="flex flex-col gap-5"
    >
      <FormField
        id="signup-display-name"
        label="Tu nombre"
        type="text"
        autoComplete="given-name"
        placeholder="Marco"
        error={errors.displayName?.message}
        className="h-12"
        {...register('displayName')}
      />
      <FormField
        id="signup-family-name"
        label="Nombre de familia"
        type="text"
        autoComplete="family-name"
        placeholder="Los Rossi"
        error={errors.familyName?.message}
        className="h-12"
        {...register('familyName')}
      />
      <FormField
        id="signup-email"
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="tu@email.com"
        error={errors.email?.message}
        className="h-12"
        {...register('email')}
      />
      <FormField
        id="signup-password"
        label="Contraseña"
        type="password"
        autoComplete="new-password"
        placeholder="••••••••"
        error={errors.password?.message}
        className="h-12"
        {...register('password')}
      />
      <FormField
        id="signup-password-confirm"
        label="Confirmá tu contraseña"
        type="password"
        autoComplete="new-password"
        placeholder="••••••••"
        error={errors.passwordConfirm?.message}
        className="h-12"
        {...register('passwordConfirm')}
      />
      <Button type="submit" className="mt-1 h-12 w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Creando…' : 'Crear.'}
      </Button>
    </form>
  );
}
