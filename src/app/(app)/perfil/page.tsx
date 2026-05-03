import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';
import type { Metadata } from 'next';
import { PushToggle } from './_components/push-toggle';
import { PerfilForm } from './perfil-form';

export const metadata: Metadata = { title: 'Mi cuenta' };

export default async function PerfilPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const email = userData.user?.email ?? '';

  let displayName = '';
  let memberSince: string | null = null;
  if (userData.user) {
    const { data: membership } = await supabase
      .from('family_memberships')
      .select('display_name, created_at')
      .eq('user_id', userData.user.id)
      .is('deleted_at', null)
      .maybeSingle();
    displayName = membership?.display_name ?? '';
    memberSince = membership?.created_at ?? null;
  }

  const initial = (displayName?.[0] ?? email?.[0] ?? '?').toUpperCase();
  const memberSinceLabel = memberSince
    ? `Miembro desde ${new Date(memberSince).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}`
    : null;

  return (
    <div className="flex max-w-xl flex-col gap-10 py-10 sm:py-14">
      <header className="animate-stagger-up flex flex-col gap-2">
        <span className="font-medium text-muted-foreground/80 text-[11px] uppercase tracking-[0.22em]">
          Mi cuenta
        </span>
        <h1 className="font-display text-[clamp(2rem,5vw,3rem)] text-foreground leading-[1.05] tracking-tight">
          Tu espacio.
        </h1>
      </header>

      <Card className="flex items-center gap-4 p-5">
        <Avatar size="lg" className="size-16 text-xl">
          <AvatarFallback>{initial}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-0.5">
          <p className="font-display font-medium text-foreground text-lg">
            {displayName || 'Sin nombre todavía'}
          </p>
          <p className="text-muted-foreground text-sm">{email}</p>
          {memberSinceLabel && (
            <p className="text-muted-foreground/70 text-xs">{memberSinceLabel}</p>
          )}
        </div>
      </Card>

      <PerfilForm initialDisplayName={displayName} />

      <PushToggle />
    </div>
  );
}
