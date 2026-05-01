'use client';

import { FormField } from '@/components/salu/form-field';
import { Button } from '@/components/ui/button';
import { type ResetPasswordInput, resetPasswordSchema } from '@/lib/validators/auth';
import { zodResolver } from '@/lib/zod-compat';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { resetPasswordAction } from '../actions';

export function ResetPasswordForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
  });

  async function onSubmit(data: ResetPasswordInput) {
    const result = await resetPasswordAction(data);
    if (!result.ok) {
      const rootMessage =
        result.errors.root ??
        result.errors.password ??
        result.errors.passwordConfirm ??
        'No pudimos actualizar la contraseña.';
      toast.error(rootMessage);
    }
    // Éxito → server hace redirect a /home.
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      aria-label="Establecer nueva contraseña"
      className="flex flex-col gap-5"
    >
      <div className="flex flex-col gap-1">
        <FormField
          id="reset-password"
          label="Nueva contraseña"
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
        id="reset-password-confirm"
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
          'Actualizar contraseña'
        )}
      </Button>
    </form>
  );
}
