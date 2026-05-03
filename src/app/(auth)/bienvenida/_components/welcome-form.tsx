'use client';

import { FormField } from '@/components/salu/form-field';
import { Button } from '@/components/ui/button';
import {
  type CompleteOnboardingInput,
  completeOnboardingSchema,
} from '@/lib/validators/onboarding';
import { zodResolver } from '@/lib/zod-compat';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { completeOnboardingAction } from '../actions';

export function WelcomeForm() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CompleteOnboardingInput>({
    resolver: zodResolver(completeOnboardingSchema),
    defaultValues: { password: '', passwordConfirm: '' },
  });

  async function onSubmit(data: CompleteOnboardingInput) {
    const result = await completeOnboardingAction(data);
    if (!result.ok) {
      if (result.field) {
        setError(result.field, { message: result.error });
      } else {
        toast.error(result.error);
      }
      return;
    }
    toast.success('¡Listo! Tu cuenta ya está activa.');
    // El proxy puede tardar un tick en ver el JWT actualizado — usamos
    // router.replace para que el siguiente request mande el cookie nuevo.
    router.replace('/home');
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      aria-label="Elegir contraseña nueva"
      className="flex flex-col gap-5"
    >
      <div className="flex flex-col gap-1">
        <FormField
          id="welcome-password"
          label="Tu nueva contraseña"
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          className="h-12"
          {...register('password')}
        />
        {!errors.password && (
          <p className="text-muted-foreground text-xs">
            Al menos 8 caracteres, una mayúscula y un número.
          </p>
        )}
      </div>

      <FormField
        id="welcome-password-confirm"
        label="Repetí la contraseña"
        type="password"
        autoComplete="new-password"
        error={errors.passwordConfirm?.message}
        className="h-12"
        {...register('passwordConfirm')}
      />

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Guardando…
          </>
        ) : (
          'Empezar a usar Salu'
        )}
      </Button>
    </form>
  );
}
