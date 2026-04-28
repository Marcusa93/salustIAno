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

export function LoginForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginInput) {
    const result = await loginAction(data);

    if (!result.ok) {
      toast.error('No pudimos iniciarte la sesión. Revisá tus datos.');
      return;
    }

    toast.success('¡Bienvenido de vuelta!');
    // TODO: redirect to /home after Supabase auth is connected
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      aria-label="Formulario de inicio de sesión"
      className="flex flex-col gap-5"
    >
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
            href="#"
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
