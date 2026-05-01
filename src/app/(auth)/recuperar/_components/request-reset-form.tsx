'use client';

import { FormField } from '@/components/salu/form-field';
import { Button } from '@/components/ui/button';
import { type RequestResetInput, requestResetSchema } from '@/lib/validators/auth';
import { zodResolver } from '@/lib/zod-compat';
import { Loader2, Mail } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { requestResetAction } from '../actions';

export function RequestResetForm() {
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RequestResetInput>({
    resolver: zodResolver(requestResetSchema),
  });

  async function onSubmit(data: RequestResetInput) {
    const result = await requestResetAction(data);
    if (!result.ok) {
      toast.error(result.errors.email ?? 'Algo salió mal. Probá de nuevo.');
      return;
    }
    setSubmittedEmail(data.email);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex size-11 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Mail className="size-5" aria-hidden />
        </div>
        <h2 className="font-heading text-xl">Revisá tu email.</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Si <strong className="text-foreground">{submittedEmail}</strong> está registrado, te
          mandamos un link para elegir una contraseña nueva. Si no lo ves, mirá en spam.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      aria-label="Pedir link de recuperación"
      className="flex flex-col gap-5"
    >
      <FormField
        id="reset-email"
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="tu@email.com"
        error={errors.email?.message}
        className="h-12"
        {...register('email')}
      />

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Mandando…
          </>
        ) : (
          'Mandame el link'
        )}
      </Button>
    </form>
  );
}
