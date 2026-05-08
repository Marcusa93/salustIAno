import { EmptyState } from '@/components/salu/empty-state';
import { PageHeader } from '@/components/salu/page-header';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { babyAgeFromBirth } from '@/lib/baby-age';
import { createClient } from '@/lib/supabase/server';
import { Baby, BookHeart, Milk, Moon, Plus } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { getTodayActivityByMemberAction } from '../home/family-activity-actions';
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

const ROLE_LABEL: Record<'admin' | 'caregiver' | 'family' | 'viewer', string> = {
  admin: 'Admin',
  caregiver: 'Cuidador/a',
  family: 'Familia',
  viewer: 'Solo ver',
};

export default async function FamiliaPage() {
  const supabase = await createClient();

  const [{ data: userData }, { data: children }, members, todayActivity] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('child_profiles')
      .select('id, name, birth_date, is_preterm')
      .is('deleted_at', null)
      .order('created_at', { ascending: true }),
    listMembersAction(),
    getTodayActivityByMemberAction(),
  ]);

  type Role = 'admin' | 'caregiver' | 'family' | 'viewer';
  let myRole: Role | null = null;
  let displayName: string | null = null;
  if (userData.user) {
    const { data: membership } = await supabase
      .from('family_memberships')
      .select('role, display_name')
      .eq('user_id', userData.user.id)
      .is('deleted_at', null)
      .maybeSingle();
    myRole = (membership?.role as Role | undefined) ?? null;
    displayName = membership?.display_name ?? null;
  }
  const isAdmin = myRole === 'admin';

  const initial = (displayName?.[0] ?? userData.user?.email?.[0] ?? 'M').toUpperCase();

  // Stats de hoy del propio user (filtrando MemberActivity por isSelf).
  const myToday = todayActivity.find((m) => m.isSelf)?.counts ?? null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-9 px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader eyebrow="Familia" title="Quiénes somos, quién está en camino." />

      {/* "Vos" — perfil propio + stats del día. */}
      <section
        className="animate-stagger-up flex flex-col gap-3"
        style={{ animationDelay: '60ms' }}
      >
        <h2 className="font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.22em]">
          Tu cuenta
        </h2>
        <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-5">
          <Avatar size="lg">
            <AvatarFallback tone="primary">{initial}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-foreground">{displayName ?? 'Tu cuenta'}</span>
              {myRole && (
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 font-medium text-primary text-xs">
                  {ROLE_LABEL[myRole]}
                </span>
              )}
            </div>
            <span className="line-clamp-1 text-muted-foreground text-xs">
              {userData.user?.email}
            </span>
          </div>
        </Card>
        {myToday && (myToday.total ?? 0) > 0 && (
          <Card className="flex items-center gap-3 border-border/60 bg-gradient-to-b from-card to-muted/15 p-3.5">
            <span className="font-medium text-[10.5px] text-muted-foreground uppercase tracking-[0.18em]">
              Hoy cargaste
            </span>
            <div className="ml-auto flex items-center gap-3 text-muted-foreground/90 text-xs">
              {myToday.feeding > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Milk className="size-3.5" aria-hidden />
                  {myToday.feeding}
                </span>
              )}
              {myToday.sleep > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Moon className="size-3.5" aria-hidden />
                  {myToday.sleep}
                </span>
              )}
              {myToday.diaper > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Baby className="size-3.5" aria-hidden />
                  {myToday.diaper}
                </span>
              )}
              {myToday.note > 0 && (
                <span className="inline-flex items-center gap-1">
                  <BookHeart className="size-3.5" aria-hidden />
                  {myToday.note}
                </span>
              )}
            </div>
          </Card>
        )}
      </section>

      {/* "El bebé" — link a detalle, edad calculada bonita. */}
      <section
        className="animate-stagger-up flex flex-col gap-3"
        style={{ animationDelay: '120ms' }}
      >
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.22em]">
            El bebé
          </h2>
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
                <ChildCard child={child} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="animate-stagger-up" style={{ animationDelay: '180ms' }}>
        <MembersSection initialMembers={members} isAdmin={isAdmin} />
      </div>
    </div>
  );
}

function ChildCard({ child }: { child: ChildSummary }) {
  const age = babyAgeFromBirth(child.birth_date);
  const subtitle = age
    ? age.unborn
      ? age.label
      : `${age.label} · nació el ${new Date(child.birth_date as string).toLocaleDateString(
          'es-AR',
          {
            day: 'numeric',
            month: 'long',
          },
        )}`
    : 'Sin fecha de nacimiento todavía';

  return (
    <Link
      href={`/familia/bebe/${child.id}` as Route}
      className="block rounded-2xl outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <Card className="group/child relative flex items-center gap-4 overflow-hidden border-border/60 bg-gradient-to-br from-card via-card to-primary/[0.04] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/10 transition-transform duration-300 group-hover/child:scale-110 group-hover/child:bg-primary/15">
          <Baby className="size-7" aria-hidden />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-display text-foreground text-xl leading-tight tracking-tight">
            {child.name}
          </span>
          <span className="text-muted-foreground text-sm">{subtitle}</span>
        </div>
        {child.is_preterm && (
          <span className="ml-auto inline-flex shrink-0 items-center rounded-full bg-secondary px-2.5 py-0.5 font-medium text-secondary-foreground text-xs">
            Prematuro
          </span>
        )}
      </Card>
    </Link>
  );
}
