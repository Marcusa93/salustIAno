'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  type CreateInvitationInput,
  INVITATION_EXPIRES_IN_DAYS_OPTIONS,
} from '@/lib/validators/invitation';
import { Copy, KeyRound, Loader2, Plus, Share2, Ticket, Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  type InvitationEntry,
  createInvitationAction,
  revokeInvitationAction,
} from '../miembros/invitations-actions';

const ROLE_LABEL: Record<InvitationEntry['role'], string> = {
  admin: 'Admin',
  caregiver: 'Cuidador/a',
  family: 'Familia',
  viewer: 'Solo ver',
};

interface InvitationsSectionProps {
  initialInvitations: InvitationEntry[];
  isAdmin: boolean;
}

/**
 * Sección de "Códigos de invitación" en /familia. Solo se muestra a
 * admins (la idea es que cualquier admin — Marco o Abril — pueda
 * invitar). Los no-admins ni siquiera ven la sección, así nadie se
 * confunde sobre quién puede invitar.
 *
 * Flow:
 *   1. Admin elige rol + caducidad → genera código (single-use).
 *   2. Card con el código aparece arriba: botón "Compartir" usa Web
 *      Share API en mobile (mandar por WhatsApp / lo que sea), botón
 *      "Copiar" como fallback en desktop. Incluye un deep link
 *      `/signup?code=XXXX-XXXX` por si querés mandar el link directo.
 *   3. Si el admin se equivocó (lo mandó a quien no era), botón
 *      "Revocar" lo invalida.
 */
export function InvitationsSection({ initialInvitations, isAdmin }: InvitationsSectionProps) {
  const [invitations, setInvitations] = useState(initialInvitations);
  const [creatorOpen, setCreatorOpen] = useState(false);

  if (!isAdmin) return null;

  function handleCreated(invitation: InvitationEntry) {
    setInvitations((prev) => [invitation, ...prev]);
    setCreatorOpen(false);
  }

  function handleRevoked(id: string) {
    setInvitations((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.22em]">
          Códigos de invitación
        </h2>
        {!creatorOpen && (
          <Button type="button" size="sm" variant="outline" onClick={() => setCreatorOpen(true)}>
            <Plus className="size-4" aria-hidden />
            Generar código
          </Button>
        )}
      </div>

      <p className="text-muted-foreground text-xs leading-relaxed">
        Generá un código y mandáselo a la persona que querés sumar (WhatsApp, mail, etc). Lo pega en
        /signup y cae directo en esta familia con el rol que vos elijas. Cada código es de un solo
        uso.
      </p>

      {creatorOpen && (
        <InvitationCreator onCancel={() => setCreatorOpen(false)} onCreated={handleCreated} />
      )}

      {invitations.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-8 text-center opacity-80">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Ticket className="size-5" aria-hidden />
          </div>
          <p className="max-w-xs text-muted-foreground text-xs">
            Todavía no generaste ningún código. Cuando creés uno, va a aparecer acá hasta que
            alguien lo use o vos lo revoques.
          </p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {invitations.map((inv) => (
            <li key={inv.id}>
              <InvitationCard invitation={inv} onRevoked={() => handleRevoked(inv.id)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function InvitationCreator({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (invitation: InvitationEntry) => void;
}) {
  const [role, setRole] = useState<CreateInvitationInput['role']>('caregiver');
  const [expiresInDays, setExpiresInDays] = useState<CreateInvitationInput['expiresInDays']>(7);
  const [pending, startPending] = useTransition();

  function handleSubmit() {
    startPending(async () => {
      const result = await createInvitationAction({ role, expiresInDays });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Código generado. Compartilo antes de cerrar.');
      onCreated(result.invitation);
    });
  }

  return (
    <Card className="flex flex-col gap-4 border-primary/30 bg-primary/5 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invite-role">Rol del invitado</Label>
          <Select
            value={role}
            onValueChange={(v) => {
              if (v === 'caregiver' || v === 'family' || v === 'viewer') setRole(v);
            }}
          >
            <SelectTrigger id="invite-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="caregiver">Cuidador/a — anota y edita</SelectItem>
              <SelectItem value="family">Familia — anota notas y ve todo</SelectItem>
              <SelectItem value="viewer">Solo ver — sin tocar nada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invite-expires">Caducidad</Label>
          <Select
            value={String(expiresInDays)}
            onValueChange={(v) => {
              if (typeof v !== 'string') return;
              const n = Number.parseInt(v, 10);
              const ok = INVITATION_EXPIRES_IN_DAYS_OPTIONS.find((d) => d === n);
              if (ok) setExpiresInDays(ok);
            }}
          >
            <SelectTrigger id="invite-expires">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INVITATION_EXPIRES_IN_DAYS_OPTIONS.map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {d === 1 ? '1 día' : `${d} días`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={handleSubmit} disabled={pending}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <KeyRound className="size-4" aria-hidden />
          )}
          {pending ? 'Generando…' : 'Generar código'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
      </div>
    </Card>
  );
}

function InvitationCard({
  invitation,
  onRevoked,
}: {
  invitation: InvitationEntry;
  onRevoked: () => void;
}) {
  const [pending, startPending] = useTransition();

  const expiresAt = new Date(invitation.expiresAt);
  const daysLeft = Math.max(
    0,
    Math.ceil((expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
  );
  const expiresLabel = invitation.isExpired
    ? 'Vencido'
    : daysLeft <= 1
      ? 'Vence hoy'
      : `Vence en ${daysLeft} días`;

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/signup?code=${encodeURIComponent(invitation.code)}`
      : `/signup?code=${encodeURIComponent(invitation.code)}`;

  const shareText = `Sumate a la familia en Salu con este código: ${invitation.code}\n${shareUrl}`;

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Sumate a Salu', text: shareText });
        return;
      } catch {
        // Cancelled by user — silenciar.
        return;
      }
    }
    // Fallback desktop: copy del texto completo.
    await handleCopy(shareText, 'Texto copiado al portapapeles.');
  }

  async function handleCopy(text: string, msg: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(msg);
    } catch {
      toast.error('No pudimos copiar al portapapeles.');
    }
  }

  function handleRevoke() {
    if (
      !window.confirm(`¿Revocar el código ${invitation.code}? La persona ya no va a poder usarlo.`)
    ) {
      return;
    }
    startPending(async () => {
      const result = await revokeInvitationAction(invitation.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Código revocado.');
      onRevoked();
    });
  }

  return (
    <Card
      className={cn(
        'flex flex-col gap-3 border-border/60 p-4 sm:flex-row sm:items-center',
        invitation.isExpired && 'opacity-60',
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded-md bg-muted px-2.5 py-1 font-mono text-foreground text-sm tracking-[0.12em] ring-1 ring-border/60 select-all">
            {invitation.code}
          </code>
          <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 font-medium text-secondary-foreground text-xs">
            {ROLE_LABEL[invitation.role]}
          </span>
        </div>
        <span
          className={cn(
            'text-muted-foreground text-xs',
            invitation.isExpired && 'text-destructive',
          )}
        >
          {expiresLabel}
          {invitation.createdByDisplayName && ` · creado por ${invitation.createdByDisplayName}`}
        </span>
      </div>

      <div className="flex shrink-0 flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleShare}
          disabled={pending || invitation.isExpired}
        >
          <Share2 className="size-3.5" aria-hidden />
          Compartir
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          onClick={() => handleCopy(invitation.code, 'Código copiado.')}
          disabled={pending}
          aria-label="Copiar código"
          title="Copiar código"
        >
          <Copy className="size-4" aria-hidden />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          onClick={handleRevoke}
          disabled={pending}
          aria-label="Revocar código"
          title="Revocar código"
          className="text-destructive hover:text-destructive"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Trash2 className="size-4" aria-hidden />
          )}
        </Button>
      </div>
    </Card>
  );
}
