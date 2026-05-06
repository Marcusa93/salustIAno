'use client';

import { FormField } from '@/components/salu/form-field';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { type CreateMemberInput, createMemberSchema } from '@/lib/validators/family-member';
import { zodResolver } from '@/lib/zod-compat';
import { Loader2, UserPlus } from 'lucide-react';
import { Controller, useForm, useWatch } from 'react-hook-form';

const ROLE_OPTIONS = [
  {
    value: 'caregiver' as const,
    label: 'Cuidador/a',
    hint: 'Mamá, papá, niñera. Puede registrar tomas, sueño, pañales y notas.',
  },
  {
    value: 'family' as const,
    label: 'Familia',
    hint: 'Abuelos, tíos, primos. Lee todo y deja notas.',
  },
  {
    value: 'viewer' as const,
    label: 'Solo ver',
    hint: 'Solo puede mirar — sin escribir nada.',
  },
];

interface CreateMemberSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Devuelve `true` si se creó OK (cierra el sheet) o `false` para mantenerlo
   * abierto (errores de campo).
   */
  onSubmit: (input: CreateMemberInput) => Promise<boolean>;
}

export function CreateMemberSheet({ open, onOpenChange, onSubmit }: CreateMemberSheetProps) {
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateMemberInput>({
    resolver: zodResolver(createMemberSchema),
    defaultValues: {
      email: '',
      displayName: '',
      relationship: '',
      role: 'family',
    },
  });

  const watchedRole = useWatch({ control, name: 'role' });

  async function submit(data: CreateMemberInput) {
    const ok = await onSubmit(data);
    if (ok) reset();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <SheetContent
        side="right"
        className="flex h-[100dvh] w-full max-h-none flex-col gap-0 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))] sm:h-full sm:max-w-md"
      >
        <SheetHeader className="border-border/60 border-b p-5">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <UserPlus className="size-5 text-primary" aria-hidden />
            Agregar miembro
          </SheetTitle>
          <SheetDescription>
            Creamos la cuenta con una contraseña temporal que vas a poder copiar después.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(submit)} className="flex flex-1 flex-col gap-4 p-5" noValidate>
          <FormField
            id="m-display-name"
            label="Nombre"
            type="text"
            autoComplete="given-name"
            placeholder="Mamá Ana"
            error={errors.displayName?.message}
            {...register('displayName')}
          />

          <FormField
            id="m-email"
            label="Email"
            type="email"
            autoComplete="off"
            placeholder="ana@ejemplo.com"
            error={errors.email?.message}
            {...register('email')}
          />

          <FormField
            id="m-relationship"
            label="Vínculo (opcional)"
            type="text"
            autoComplete="off"
            placeholder="mamá, abuela, tío…"
            error={errors.relationship?.message}
            {...register('relationship')}
          />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="m-role">Rol</Label>
            <Controller
              name="role"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="m-role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-muted-foreground text-xs">
              {ROLE_OPTIONS.find((o) => o.value === watchedRole)?.hint}
            </p>
            {errors.role?.message && (
              <p role="alert" className="text-destructive text-sm">
                {errors.role.message}
              </p>
            )}
          </div>

          <div className="mt-auto flex flex-col gap-2 pt-2">
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Creando…
                </>
              ) : (
                <>
                  <UserPlus className="size-4" aria-hidden />
                  Crear cuenta
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="w-full"
            >
              Cancelar
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
