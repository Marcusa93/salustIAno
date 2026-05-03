'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KeyRound, Loader2, LogOut, Pencil } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { changePasswordAction, logoutAction, updateDisplayNameAction } from './actions';

export function PerfilForm({ initialDisplayName }: { initialDisplayName: string }) {
  return (
    <div className="flex flex-col gap-4">
      <DisplayNameSection initial={initialDisplayName} />
      <PasswordSection />
      <LogoutSection />
    </div>
  );
}

function DisplayNameSection({ initial }: { initial: string }) {
  const [name, setName] = useState(initial);
  const [pending, startSave] = useTransition();
  const dirty = name.trim() !== initial;

  function save() {
    startSave(async () => {
      const result = await updateDisplayNameAction(name);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Nombre guardado.');
    });
  }

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-center gap-2">
        <Pencil className="size-4 text-muted-foreground" aria-hidden />
        <span className="font-medium text-foreground text-sm">Nombre que verán</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="p-name">Tu nombre</Label>
        <Input
          id="p-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          placeholder="Marco"
        />
      </div>
      <Button
        type="button"
        size="sm"
        onClick={save}
        disabled={!dirty || pending}
        className="self-start"
      >
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Guardar
      </Button>
    </Card>
  );
}

function PasswordSection() {
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [pending, startSave] = useTransition();

  function save() {
    if (pwd.length < 8) {
      toast.error('La contraseña tiene que tener al menos 8 caracteres.');
      return;
    }
    if (pwd !== pwd2) {
      toast.error('Las contraseñas no coinciden.');
      return;
    }
    startSave(async () => {
      const result = await changePasswordAction(pwd);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setPwd('');
      setPwd2('');
      toast.success('Contraseña cambiada.');
    });
  }

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-center gap-2">
        <KeyRound className="size-4 text-muted-foreground" aria-hidden />
        <span className="font-medium text-foreground text-sm">Cambiar contraseña</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="p-pw1">Nueva contraseña</Label>
          <Input
            id="p-pw1"
            type="password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            autoComplete="new-password"
            minLength={8}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="p-pw2">Repetir</Label>
          <Input
            id="p-pw2"
            type="password"
            value={pwd2}
            onChange={(e) => setPwd2(e.target.value)}
            autoComplete="new-password"
            minLength={8}
          />
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={save}
        disabled={pending || pwd.length === 0}
        className="self-start"
      >
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Cambiar contraseña
      </Button>
    </Card>
  );
}

function LogoutSection() {
  const [pending, startLogout] = useTransition();
  function handleLogout() {
    startLogout(async () => {
      // Server action — redirect adentro.
      await logoutAction();
    });
  }
  return (
    <Card className="flex items-center gap-3 p-5">
      <LogOut className="size-4 text-muted-foreground" aria-hidden />
      <span className="flex-1 font-medium text-foreground text-sm">Cerrar sesión</span>
      <Button type="button" size="sm" variant="outline" onClick={handleLogout} disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Salir
      </Button>
    </Card>
  );
}
