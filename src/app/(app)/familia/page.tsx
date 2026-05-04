import { EmptyState } from '@/components/salu/empty-state';
import { PageHeader } from '@/components/salu/page-header';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';
import { Baby, Plus } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { MembersSection } from './_components/members-section';
import { listMembersAction } from './miembros/actions';

export const metadata: Metadata = {
  title: 'Familia',
};

interface ChildSummary {
  id: string;
  name: string;
  birth_date: string | null;
  is_preterm: boolean | null;
}

function formatBirth(birthDate: string | null): string {
  if (!birthDate) return 'Sin fecha de nacimiento todavía';
  return `Nació el ${new Date(birthDate).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })}`;
}

export default async function FamiliaPage() {
  const supabase = await createClient();

  const [{ data: userData }, { data: children }, members] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('child_profiles')
      .select('id, name, birth_date, is_preterm')
      .is('deleted_at', null)
      .order('created_at', { ascending: true }),
    listMembersAction(),
  ]);

  let isAdmin = false;
  let displayName: string | null = null;
  if (userData.user) {
    const { data: membership } = await supabase
      .from('family_memberships')
      .select('role, display_name')
      .eq('user_id', userData.user.id)
      .is('deleted_at', null)
      .maybeSingle();
    isAdmin = membership?.role === 'admin';
    displayName = membership?.display_name ?? null;
  }

  const initial = (displayName?.[0] ?? userData.user?.email?.[0] ?? 'M').toUpperCase();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader eyebrow="Familia" title="Quiénes somos, quién está en camino." />

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-foreground text-sm">Vos</h2>
        <Card className="flex items-center gap-4 p-5">
          <Avatar size="lg">
            <AvatarFallback tone="primary">{initial}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-foreground">{displayName ?? 'Tu cuenta'}</span>
            <span className="text-muted-foreground text-xs">{userData.user?.email}</span>
          </div>
          {isAdmin && (
            <span className="ml-auto inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 font-medium text-primary text-xs">
              Admin
            </span>
          )}
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-semibold text-foreground text-sm">El bebé</h2>
          {isAdmin && (children?.length ?? 0) === 0 && (
            <Button render={<Link href="/familia/bebe/nuevo" />} size="sm">
              <Plus className="size-4" aria-hidden />
              Crear perfil
            </Button>
          )}
        </div>

        {!children || children.length === 0 ? (
          <EmptyState
            icon={Baby}
            title="Cuando llegue, su perfil va acá."
            description="Podés crear el perfil hoy con lo que ya sabés (nombre, pediatra, fecha esperada) y completar lo final cuando nazca."
            action={
              isAdmin
                ? { label: 'Crear el perfil', href: '/familia/bebe/nuevo' as Route }
                : undefined
            }
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {(children as ChildSummary[]).map((child) => (
              <li key={child.id}>
                <Link
                  href={`/familia/bebe/${child.id}` as Route}
                  className="block rounded-lg outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
                >
                  <Card className="flex items-center gap-4 p-5 transition-all hover:-translate-y-0.5 hover:shadow-md">
                    <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Baby className="size-6" aria-hidden />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-display text-foreground text-xl">{child.name}</span>
                      <span className="text-muted-foreground text-sm">
                        {formatBirth(child.birth_date)}
                      </span>
                    </div>
                    {child.is_preterm && (
                      <span className="ml-auto inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 font-medium text-secondary-foreground text-xs">
                        Prematuro
                      </span>
                    )}
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <MembersSection initialMembers={members} isAdmin={isAdmin} />
    </div>
  );
}
