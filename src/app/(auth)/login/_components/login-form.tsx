'use client';

import { FormField } from '@/components/salu/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type LoginInput, loginSchema } from '@/lib/validators/auth';
import { zodResolver } from '@/lib/zod-compat';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { loginAction } from '../actions';

const ERROR_PARAM_MESSAGES: Record<string, string> = {
  callback_failed: 'No pudimos confirmar la sesión. Probá entrar de nuevo.',
  callback_missing_code: 'Link de confirmación inválido. Probá entrar de nuevo.',
  confirm_invalid_link: 'El link del mail venció o es inválido. Probá entrar.',
  confirm_failed: 'No pudimos confirmar tu mail. Probá generar uno nuevo.',
};

interface LoginFormProps {
  next?: string;
  errorParam?: string;
  confirmedPending?: boolean;
}

export function LoginForm({ next, errorParam, confirmedPending = false }: LoginFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginInput) {
    const result = await loginAction(data, next);

    if (!result.ok) {
      const rootMessage = result.errors.root ?? 'No pudimos iniciarte la sesión. Revisá tus datos.';
      toast.error(rootMessage);
    }
    // En éxito el server hace redirect; nada más que hacer en el cliente.
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      aria-label="Formulario de inicio de sesión"
      className="flex flex-col gap-5"
    >
      {confirmedPending && (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-4 text-foreground text-sm">
          Te mandamos un mail para confirmar tu cuenta. Hacé click en el link y volvé acá a entrar.
        </div>
      )}
      {errorParam && ERROR_PARAM_MESSAGES[errorParam] && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-destructive text-sm">
          {ERROR_PARAM_MESSAGES[errorParam]}
        </div>
      )}

      <FormField
        id="login-email"
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="tu@email.com"
        error={errors.email?.message}
        className="h-12"
        {...register('email')}
      />

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="login-password">Contraseña</Label>
          <Link
            href="/recuperar"
            tabIndex={-1}
            className="text-muted-foreground text-xs underline-offset-4 transition-colors hover:text-foreground"
          >
            ¿La olvidaste?
          </Link>
        </div>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          className="h-12"
          aria-describedby={errors.password ? 'login-password-error' : undefined}
          aria-invalid={!!errors.password}
          {...register('password')}
        />
        {errors.password && (
          <p id="login-password-error" role="alert" className="text-destructive text-sm">
            {errors.password.message}
          </p>
        )}
      </div>

      <Button type="submit" className="mt-1 h-12 w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Entrando…' : 'Entrar.'}
      </Button>
    </form>
  );
}
