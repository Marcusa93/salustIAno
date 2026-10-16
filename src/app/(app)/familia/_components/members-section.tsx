'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  type FamilyActor,
  type FamilyRole,
  type MemberPermissions,
  assignableRoles,
  memberPermissions,
} from '@/lib/family-permissions';
import { cn } from '@/lib/utils';
import type { CreateMemberAsSuperadminInput } from '@/lib/validators/family-member';
import {
  KeyRound,
  Loader2,
  MoreVertical,
  Plus,
  Trash2,
  UserPlus,
  UserX,
  Users,
} from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  type MemberEntry,
  createMemberAction,
  deleteMemberAccountAction,
  removeMemberAction,
  resetMemberPasswordAction,
  updateMemberRoleAction,
} from '../miembros/actions';
import { CreateMemberSheet } from './create-member-sheet';

const ROLE_LABEL: Record<MemberEntry['role'], string> = {
  admin: 'Admin',
  caregiver: 'Cuidador/a',
  family: 'Familia',
  viewer: 'Solo ver',
};

const ROLE_TONE: Record<MemberEntry['role'], string> = {
  admin: 'bg-primary/10 text-primary',
  caregiver: 'bg-secondary text-secondary-foreground',
  family: 'bg-accent text-accent-foreground',
  viewer: 'bg-muted text-muted-foreground',
};

interface MembersSectionProps {
  initialMembers: MemberEntry[];
  isAdmin: boolean;
  isSuperadmin: boolean;
}

export function MembersSection({ initialMembers, isAdmin, isSuperadmin }: MembersSectionProps) {
  const [members, setMembers] = useState(initialMembers);
  const actor: FamilyActor = { role: isAdmin ? 'admin' : null, isSuperadmin };
  const roles = assignableRoles(actor);
  const [open, setOpen] = useState(false);
  const [pendingPassword, setPendingPassword] = useState<{
    email: string;
    password: string;
  } | null>(null);

  function handleCreated(result: { member: MemberEntry; tempPassword: string }) {
    setMembers((prev) => [...prev, result.member]);
    if (result.tempPassword) {
      setPendingPassword({ email: result.member.email ?? '', password: result.tempPassword });
    }
    setOpen(false);
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.22em]">
          Miembros
        </h2>
        {isAdmin && (
          <Button type="button" size="sm" onClick={() => setOpen(true)}>
            <Plus className="size-4" aria-hidden />
            Agregar miembro
          </Button>
        )}
      </div>

      {members.length === 0 ? (
        <Card className="flex flex-col items-center gap-4 p-10 text-center opacity-80">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Users className="size-6" aria-hidden />
          </div>
          <div className="flex flex-col gap-1">
            <p className="font-medium text-foreground text-sm">Todavía no hay miembros.</p>
            {isAdmin && (
              <p className="max-w-md text-muted-foreground text-xs">
                Agregá a mamá, abuelos o tíos como cuidadores o familia.
              </p>
            )}
          </div>
          {isAdmin && (
            <Button type="button" onClick={() => setOpen(true)}>
              <UserPlus className="size-4" aria-hidden />
              Agregar primer miembro
            </Button>
          )}
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {members.map((m) => (
            <MemberCard
              key={m.membershipId}
              member={m}
              permissions={memberPermissions(actor, m)}
              roles={roles}
              onRemoved={() =>
                setMembers((prev) => prev.filter((x) => x.membershipId !== m.membershipId))
              }
              onRoleChanged={(newRole) =>
                setMembers((prev) =>
                  prev.map((x) =>
                    x.membershipId === m.membershipId ? { ...x, role: newRole } : x,
                  ),
                )
              }
              onPasswordReset={(password, email) => setPendingPassword({ password, email })}
            />
          ))}
        </ul>
      )}

      <CreateMemberSheet
        open={open}
        onOpenChange={setOpen}
        allowAdmin={roles.includes('admin')}
        onSubmit={async (input: CreateMemberAsSuperadminInput) => {
          const result = await createMemberAction(input);
          if (!result.ok) {
            toast.error(result.error);
            return false;
          }
          handleCreated({ member: result.member, tempPassword: result.tempPassword });
          if (result.tempPassword) {
            toast.success('Miembro creado. Copiá la contraseña antes de cerrar.');
          } else {
            toast.success('Miembro agregado a la familia.');
          }
          return true;
        }}
      />

      {pendingPassword && (
        <PasswordRevealCard
          email={pendingPassword.email}
          password={pendingPassword.password}
          onClose={() => setPendingPassword(null)}
        />
      )}
    </section>
  );
}

// ----------------------------------------------------------------------------
// MemberCard: card por miembro, con eliminar (si aplica).
// ----------------------------------------------------------------------------

function MemberCard({
  member,
  permissions,
  roles,
  onRemoved,
  onRoleChanged,
  onPasswordReset,
}: {
  member: MemberEntry;
  permissions: MemberPermissions;
  roles: FamilyRole[];
  onRemoved: () => void;
  onRoleChanged: (newRole: FamilyRole) => void;
  onPasswordReset: (tempPassword: string, email: string) => void;
}) {
  const [pending, startPending] = useTransition();
  const name = member.displayName ?? member.email ?? 'este miembro';
  const canManage = Object.values(permissions).some(Boolean);

  function handleRemove() {
    if (
      !window.confirm(
        `¿Sacar a ${name} de la familia? Pierde acceso pero la cuenta sigue existiendo.`,
      )
    ) {
      return;
    }
    startPending(async () => {
      const result = await removeMemberAction(member.membershipId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onRemoved();
      toast.success('Miembro eliminado.');
    });
  }

  function handleDeleteAccount() {
    if (
      !window.confirm(
        `¿Borrar la cuenta de ${name}? No va a poder volver a entrar y no se puede deshacer. Lo que cargó en la app se conserva.`,
      )
    ) {
      return;
    }
    startPending(async () => {
      const result = await deleteMemberAccountAction(member.membershipId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onRemoved();
      toast.success(
        result.mode === 'deleted'
          ? 'Cuenta borrada.'
          : 'Cuenta dada de baja. Su historial en la app se conserva.',
      );
    });
  }

  function handleRoleChange(value: string) {
    const role = roles.find((r) => r === value);
    if (!role || role === member.role) return;
    startPending(async () => {
      const result = await updateMemberRoleAction(member.membershipId, role);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onRoleChanged(role);
      toast.success('Rol actualizado.');
    });
  }

  function handleResetPassword() {
    if (
      !window.confirm(
        `¿Resetear la contraseña de ${name}? La nueva contraseña va a aparecer una sola vez.`,
      )
    ) {
      return;
    }
    startPending(async () => {
      const result = await resetMemberPasswordAction(member.membershipId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onPasswordReset(result.tempPassword, result.email);
      toast.success('Contraseña reseteada. Copiala antes de cerrar.');
    });
  }

  const initial = (member.displayName?.[0] ?? member.email?.[0] ?? '?').toUpperCase();

  return (
    <li>
      <Card className="flex items-center gap-4 p-4">
        <Avatar size="lg">
          <AvatarFallback tone={member.isSelf ? 'primary' : 'muted'}>{initial}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate font-medium text-foreground">
            {member.displayName ?? member.email ?? 'Sin nombre'}
            {member.isSelf && (
              <span className="ml-2 font-normal text-muted-foreground text-xs">(vos)</span>
            )}
          </span>
          <span className="truncate text-muted-foreground text-xs">
            {member.relationship ? `${member.relationship} · ` : ''}
            {member.email ?? 'sin email'}
          </span>
        </div>
        <span
          className={cn(
            'inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 font-medium text-xs',
            ROLE_TONE[member.role],
          )}
        >
          {member.isSuperadmin ? 'Superadmin' : ROLE_LABEL[member.role]}
        </span>
        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Opciones para ${name}`}
              disabled={pending}
              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 disabled:opacity-50"
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <MoreVertical className="size-4" aria-hidden />
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[200px]">
              {permissions.changeRole && (
                <>
                  {/* Base UI exige que el label viva dentro de un Group: suelto,
                      tira MenuGroupRootContext y rompe el menú al abrirlo. */}
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Cambiar rol</DropdownMenuLabel>
                    <DropdownMenuRadioGroup value={member.role} onValueChange={handleRoleChange}>
                      {roles.map((role) => (
                        <DropdownMenuRadioItem key={role} value={role}>
                          {ROLE_LABEL[role]}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                </>
              )}
              {permissions.resetPassword && (
                <DropdownMenuItem onClick={handleResetPassword}>
                  <KeyRound />
                  Resetear contraseña
                </DropdownMenuItem>
              )}
              {permissions.remove && (
                <DropdownMenuItem
                  onClick={handleRemove}
                  className="text-destructive data-highlighted:bg-destructive/10 data-highlighted:text-destructive"
                >
                  <UserX />
                  Sacar de la familia
                </DropdownMenuItem>
              )}
              {permissions.deleteAccount && (
                <DropdownMenuItem
                  onClick={handleDeleteAccount}
                  className="text-destructive data-highlighted:bg-destructive/10 data-highlighted:text-destructive"
                >
                  <Trash2 />
                  Borrar cuenta
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </Card>
    </li>
  );
}

// ----------------------------------------------------------------------------
// PasswordRevealCard: muestra la contraseña temporal una sola vez.
// ----------------------------------------------------------------------------

function PasswordRevealCard({
  email,
  password,
  onClose,
}: {
  email: string;
  password: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      toast.success('Contraseña copiada.');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('No pudimos copiar al portapapeles.');
    }
  }

  return (
    <Card className="flex flex-col gap-3 border-primary/30 bg-primary/5 p-4">
      <div className="flex flex-col gap-1">
        <span className="font-medium text-[11px] text-primary uppercase tracking-[0.18em]">
          Contraseña temporal
        </span>
        <p className="text-foreground text-sm">
          Pasale esta contraseña a <span className="font-medium">{email}</span> por un canal seguro
          (WhatsApp, persona). Una vez que cierres esta tarjeta no la vas a poder ver de nuevo.
          Cuando entre, puede cambiarla desde su perfil.
        </p>
      </div>
      <code className="block rounded-lg bg-background px-3 py-2 font-mono text-foreground text-sm shadow-sm ring-1 ring-border/60 select-all">
        {password}
      </code>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={copy}>
          {copied ? '¡Copiada!' : 'Copiar contraseña'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          Ya la guardé
        </Button>
      </div>
    </Card>
  );
}
