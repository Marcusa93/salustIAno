'use client';

import { FormField } from '@/components/salu/form-field';
import { Button } from '@/components/ui/button';
import { type RedeemInvitationInput, redeemInvitationSchema } from '@/lib/validators/invitation';
import { zodResolver } from '@/lib/zod-compat';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { redeemInvitationAction } from '../actions';

/**
 * Formulario para redimir un código de invitación. Reemplazó al signup
 * público — Salu solo acepta cuentas que vienen invitadas por un admin
 * del grupo (Marco o Abril). Sin código no se entra: la idea es que
 * cada bebé tenga UNA familia, y nadie cae por accidente en otro grupo.
 */
export function SignupForm({ initialCode }: { initialCode?: string }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RedeemInvitationInput>({
    resolver: zodResolver(redeemInvitationSchema),
    defaultValues: { code: initialCode ?? '' },
  });

  async function onSubmit(data: RedeemInvitationInput) {
    const result = await redeemInvitationAction(data);

    if (!result.ok) {
      const fieldKeys: ReadonlyArray<keyof RedeemInvitationInput> = [
        'code',
        'displayName',
        'email',
        'password',
        'passwordConfirm',
      ];
      let surfaced = false;
      for (const k of fieldKeys) {
        const msg = result.errors[k];
        if (msg) {
          setError(k, { message: msg });
          surfaced = true;
        }
      }
      if (!surfaced || result.errors.root) {
        toast.error(result.errors.root ?? 'No pudimos completar tu registro.');
      }
      return;
    }

    toast.success('¡Bienvenido a la familia!');
    router.push('/home');
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      aria-label="Sumarse con código de invitación"
      className="flex flex-col gap-5"
    >
      <FormField
        id="signup-code"
        label="Código de invitación"
        type="text"
        autoComplete="one-time-code"
        placeholder="ABCD-1234"
        spellCheck={false}
        error={errors.code?.message}
        className="h-12 font-mono uppercase tracking-[0.18em]"
        {...register('code')}
      />
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
        {isSubmitting ? 'Sumándote…' : 'Sumarme.'}
      </Button>
    </form>
  );
}
