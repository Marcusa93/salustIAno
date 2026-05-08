import { PageHeader } from '@/components/salu/page-header';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';
import type { Metadata } from 'next';
import { PushToggle } from './_components/push-toggle';
import { PerfilForm } from './perfil-form';

export const metadata: Metadata = { title: 'Mi cuenta' };

const ROLE_LABEL: Record<'admin' | 'caregiver' | 'family' | 'viewer', string> = {
  admin: 'Admin',
  caregiver: 'Cuidador/a',
  family: 'Familia',
  viewer: 'Solo ver',
};

export default async function PerfilPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const email = userData.user?.email ?? '';

  type Role = 'admin' | 'caregiver' | 'family' | 'viewer';
  let displayName = '';
  let memberSince: string | null = null;
  let role: Role | null = null;
  if (userData.user) {
    const { data: membership } = await supabase
      .from('family_memberships')
      .select('display_name, created_at, role')
      .eq('user_id', userData.user.id)
      .is('deleted_at', null)
      .maybeSingle();
    displayName = membership?.display_name ?? '';
    memberSince = membership?.created_at ?? null;
    role = (membership?.role as Role | undefined) ?? null;
  }

  const initial = (displayName?.[0] ?? email?.[0] ?? '?').toUpperCase();
  const memberSinceLabel = memberSince
    ? `Miembro desde ${new Date(memberSince).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}`
    : null;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-9 px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader
        eyebrow="Mi cuenta"
        title="Tu espacio."
        description="Tu nombre, tu foto, los devices que reciben notificaciones."
      />

      <Card className="animate-stagger-up flex items-center gap-4 p-5">
        <Avatar size="lg" className="size-16 text-xl">
          <AvatarFallback tone="primary">{initial}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display font-medium text-foreground text-lg">
              {displayName || 'Sin nombre todavía'}
            </p>
            {role && (
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 font-medium text-primary text-xs">
                {ROLE_LABEL[role]}
              </span>
            )}
          </div>
          <p className="line-clamp-1 text-muted-foreground text-sm">{email}</p>
          {memberSinceLabel && (
            <p className="text-muted-foreground/70 text-xs">{memberSinceLabel}</p>
          )}
        </div>
      </Card>

      <div className="animate-stagger-up" style={{ animationDelay: '60ms' }}>
        <PerfilForm initialDisplayName={displayName} />
      </div>

      <div className="animate-stagger-up" style={{ animationDelay: '120ms' }}>
        <PushToggle />
      </div>
    </div>
  );
}
