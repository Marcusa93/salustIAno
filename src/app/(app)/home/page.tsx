import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';
import { chronologicalAgeDays } from '@/lib/validators/child-profile';
import {
  BREAST_SIDE_LABELS,
  DIAPER_TYPE_LABELS,
  type DiaperType,
  FEEDING_TYPE_LABELS,
  type FeedingType,
  SLEEP_QUALITY_LABELS,
} from '@/lib/validators/events';
import { Baby, BookHeart, Milk, Moon, Plus } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { DiaperQuickAdd } from './_components/diaper-quick-add';
import { FeedingQuickAdd } from './_components/feeding-quick-add';
import { SleepQuickAdd } from './_components/sleep-quick-add';

export const metadata: Metadata = {
  title: 'Casa',
};

interface TimelineRow {
  event_type: 'feeding' | 'sleep' | 'diaper' | 'measurement' | 'note' | 'media';
  id: string;
  child_id: string;
  occurred_at: string;
  payload: Record<string, unknown>;
  created_at: string;
}

function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  const diffMs = now.getTime() - then;
  const minutes = Math.round(diffMs / 60000);
  if (Math.abs(minutes) < 1) return 'Recién';
  if (Math.abs(minutes) < 60)
    return minutes >= 0 ? `Hace ${minutes} min` : `En ${Math.abs(minutes)} min`;
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return hours >= 0 ? `Hace ${hours} h` : `En ${Math.abs(hours)} h`;
  const days = Math.round(hours / 24);
  return days >= 0 ? `Hace ${days} día${days === 1 ? '' : 's'}` : 'Mañana';
}

function formatAge(days: number | null): string {
  if (days === null) return '—';
  if (days < 0)
    return `Falta${days < -1 ? 'n' : ''} ${Math.abs(days)} día${Math.abs(days) === 1 ? '' : 's'}`;
  if (days < 7) return `${days} día${days === 1 ? '' : 's'}`;
  const weeks = Math.floor(days / 7);
  if (weeks < 8) return `${weeks} semana${weeks === 1 ? '' : 's'}`;
  const months = Math.floor(days / 30);
  if (months < 24) return `${months} mes${months === 1 ? '' : 'es'}`;
  return `${Math.floor(days / 365)} años`;
}

const QUICK_BUTTON_CLS =
  'flex h-auto flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-foreground transition-all hover:-translate-y-0.5 hover:bg-muted/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

function quickButtonContent(Icon: typeof Milk, label: string) {
  return (
    <span className={QUICK_BUTTON_CLS}>
      <Icon className="size-6 text-primary" aria-hidden />
      <span className="font-medium text-sm">{label}</span>
    </span>
  );
}

export default async function HomePage() {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  const { data: child } = await supabase
    .from('child_profiles')
    .select('id, name, birth_date')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  let displayName: string | null = null;
  if (userData.user) {
    const { data: membership } = await supabase
      .from('family_memberships')
      .select('display_name')
      .eq('user_id', userData.user.id)
      .is('deleted_at', null)
      .maybeSingle();
    displayName = membership?.display_name ?? null;
  }

  // Si no hay perfil del bebé, mostramos un onboarding suave.
  if (!child) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-3xl text-foreground tracking-tight sm:text-4xl">
            Hola{displayName ? `, ${displayName}` : ''}.
          </h1>
          <p className="text-muted-foreground">Acá te esperamos cuando creemos el perfil.</p>
        </header>
        <Card className="flex flex-col items-center gap-4 p-10 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Baby className="size-6" aria-hidden />
          </div>
          <div className="flex flex-col gap-1.5">
            <h2 className="font-medium text-foreground text-lg">Empezá por el perfil del bebé.</h2>
            <p className="max-w-md text-muted-foreground text-sm">
              Cargalo con lo que ya sabés (nombre, pediatra, fecha esperada). Después, cuando lo
              tengas en brazos, anotás tomas, sueños y pañales en dos toques.
            </p>
          </div>
          <Button render={<Link href="/familia/bebe/nuevo" />}>
            <Plus className="size-4" aria-hidden />
            Crear perfil
          </Button>
        </Card>
      </div>
    );
  }

  // Eventos de hoy + recientes.
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [{ data: recentEvents }, { data: todayEvents }] = await Promise.all([
    supabase.rpc('get_timeline', {
      p_child_id: child.id,
      p_event_types: ['feeding', 'sleep', 'diaper'],
      p_limit: 8,
      p_offset: 0,
    }),
    supabase.rpc('get_timeline', {
      p_child_id: child.id,
      p_event_types: ['feeding', 'sleep', 'diaper'],
      p_from: todayStart.toISOString(),
      p_limit: 200,
      p_offset: 0,
    }),
  ]);

  const recents = (recentEvents ?? []) as TimelineRow[];
  const today = (todayEvents ?? []) as TimelineRow[];

  const todaySummary = {
    feeding: today.filter((e) => e.event_type === 'feeding').length,
    sleep: today.filter((e) => e.event_type === 'sleep').length,
    diaper: today.filter((e) => e.event_type === 'diaper').length,
  };

  const ageDays = chronologicalAgeDays(child.birth_date);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl text-foreground tracking-tight sm:text-4xl">
          Hola{displayName ? `, ${displayName}` : ''}.
        </h1>
        <p className="text-muted-foreground">
          {child.birth_date
            ? `${child.name}, ${formatAge(ageDays)}.`
            : `Esperando a ${child.name}.`}
        </p>
      </header>

      {/* Quick add */}
      <section className="flex flex-col gap-3">
        <h2 className="font-medium text-muted-foreground text-sm uppercase tracking-wider">
          Anotar
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <FeedingQuickAdd
            trigger={<button type="button">{quickButtonContent(Milk, 'Tomó')}</button>}
          />
          <SleepQuickAdd
            trigger={<button type="button">{quickButtonContent(Moon, 'Durmió')}</button>}
          />
          <DiaperQuickAdd
            trigger={<button type="button">{quickButtonContent(Baby, 'Pañal')}</button>}
          />
          <Link href="/notas/nuevo" className="contents">
            {quickButtonContent(BookHeart, 'Momento')}
          </Link>
        </div>
      </section>

      {/* Hoy */}
      <section className="flex flex-col gap-3">
        <h2 className="font-medium text-muted-foreground text-sm uppercase tracking-wider">Hoy</h2>
        <div className="grid grid-cols-3 gap-3">
          <SummaryCard label="Tomas" count={todaySummary.feeding} Icon={Milk} />
          <SummaryCard label="Sueños" count={todaySummary.sleep} Icon={Moon} />
          <SummaryCard label="Pañales" count={todaySummary.diaper} Icon={Baby} />
        </div>
      </section>

      {/* Recientes */}
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-medium text-muted-foreground text-sm uppercase tracking-wider">
            Recientes
          </h2>
          <Link href={'/timeline' as Route} className="text-primary text-sm hover:underline">
            Ver todo
          </Link>
        </div>
        {recents.length === 0 ? (
          <Card className="p-6 text-center text-muted-foreground text-sm">
            Todavía no hay registros. Anotá la primera toma cuando ocurra.
          </Card>
        ) : (
          <ul className="flex flex-col gap-2">
            {recents.map((e) => (
              <li key={`${e.event_type}-${e.id}`}>
                <EventRow row={e} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  count,
  Icon,
}: {
  label: string;
  count: number;
  Icon: typeof Milk;
}) {
  return (
    <Card className="flex flex-col items-center gap-1 p-4">
      <Icon className="size-5 text-primary" aria-hidden />
      <span className="font-display text-2xl text-foreground">{count}</span>
      <span className="text-muted-foreground text-xs">{label}</span>
    </Card>
  );
}

function EventRow({ row }: { row: TimelineRow }) {
  const summary = describeEvent(row);
  return (
    <Card className="flex items-center gap-3 p-3">
      <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
        {summary.Icon ? <summary.Icon className="size-4" aria-hidden /> : null}
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="font-medium text-foreground text-sm">{summary.title}</span>
        {summary.detail && <span className="text-muted-foreground text-xs">{summary.detail}</span>}
      </div>
      <span className="ml-auto text-muted-foreground text-xs">
        {formatRelativeTime(row.occurred_at)}
      </span>
    </Card>
  );
}

function describeEvent(row: TimelineRow): {
  Icon: typeof Milk;
  title: string;
  detail: string | null;
} {
  if (row.event_type === 'feeding') {
    const type = row.payload.type as FeedingType | undefined;
    const side = row.payload.side as keyof typeof BREAST_SIDE_LABELS | undefined;
    const duration = row.payload.duration_minutes as number | null | undefined;
    const amount = row.payload.amount_ml as number | null | undefined;
    const parts: string[] = [];
    if (type === 'breastfeeding' && side) parts.push(BREAST_SIDE_LABELS[side]);
    if (duration) parts.push(`${duration} min`);
    if (amount) parts.push(`${amount} ml`);
    return {
      Icon: Milk,
      title: type ? FEEDING_TYPE_LABELS[type] : 'Toma',
      detail: parts.length > 0 ? parts.join(' · ') : null,
    };
  }
  if (row.event_type === 'sleep') {
    const quality = row.payload.quality as keyof typeof SLEEP_QUALITY_LABELS | undefined;
    const isNap = row.payload.is_nap as boolean | undefined;
    return {
      Icon: Moon,
      title: isNap ? 'Siesta' : 'Sueño',
      detail: quality ? SLEEP_QUALITY_LABELS[quality] : null,
    };
  }
  if (row.event_type === 'diaper') {
    const type = row.payload.type as DiaperType | undefined;
    return {
      Icon: Baby,
      title: 'Pañal',
      detail: type ? DIAPER_TYPE_LABELS[type] : null,
    };
  }
  return { Icon: Baby, title: row.event_type, detail: null };
}
