import { PageHeader } from '@/components/salu/page-header';
import { Card } from '@/components/ui/card';
import { durationLabel } from '@/lib/baby-age';
import { createClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';
import {
  BookHeart,
  CalendarClock,
  Camera,
  ClipboardCheck,
  Moon,
  Ruler,
  Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Cuidar',
};

type SectionId = 'salud' | 'patrones' | 'aprender';

interface CuidarOption {
  href: Route;
  title: string;
  description: string;
  Icon: LucideIcon;
  badge?: string;
  microInfo?: string;
  section: SectionId;
}

interface SectionMeta {
  id: SectionId;
  eyebrow: string;
  description: string;
}

/**
 * Las 7 herramientas se agrupan en 3 secciones para no abrumar:
 *   - Salud:    cosas clínicas, peso, controles, alarmas.
 *   - Patrones: cómo viene la rutina (sueño, observaciones de IA).
 *   - Aprender: referencia de la pediatra.
 *
 * Sin tabs interactivas: 3 bloques con headers claros bastan para
 * que la familia ubique rápido la herramienta que busca, sin romper
 * URLs ni flow.
 */
const SECTIONS: ReadonlyArray<SectionMeta> = [
  {
    id: 'salud',
    eyebrow: 'Salud',
    description:
      'Lo clínico: peso, controles del pediatra, análisis de pañal, borrador de consulta.',
  },
  {
    id: 'patrones',
    eyebrow: 'Patrones',
    description: 'Cómo viene la rutina diaria — sueño, alimentación, observaciones con IA.',
  },
  {
    id: 'aprender',
    eyebrow: 'Aprender',
    description: 'La biblioteca de la familia: lo que dijo la pediatra, lo que aprendieron juntos.',
  },
];

function relativeDays(iso: string, now: Date = new Date()): string {
  const ms = now.getTime() - new Date(iso).getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days < 1) return 'hoy';
  if (days === 1) return 'ayer';
  if (days < 7) return `hace ${days} días`;
  if (days < 14) return 'hace 1 semana';
  if (days < 30) return `hace ${Math.floor(days / 7)} semanas`;
  if (days < 60) return 'hace 1 mes';
  return `hace ${Math.floor(days / 30)} meses`;
}

function relativeUntil(iso: string, now: Date = new Date()): string {
  const ms = new Date(iso).getTime() - now.getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days < 0) {
    const past = Math.abs(days);
    return past === 0 ? 'vencido hoy' : `vencido hace ${past} día${past === 1 ? '' : 's'}`;
  }
  if (days === 0) return 'hoy';
  if (days === 1) return 'mañana';
  if (days < 7) return `en ${days} días`;
  if (days < 14) return 'en 1 semana';
  if (days < 30) return `en ${Math.floor(days / 7)} semanas`;
  return `en ${Math.floor(days / 30)} meses`;
}

function shortWeekday(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    weekday: 'long',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}

function minutesBetween(start: string, end: string): number {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000);
}

function hoursLabel(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export default async function CuidarPage() {
  const supabase = await createClient();
  const { data: child } = await supabase
    .from('child_profiles')
    .select('id, family_group_id')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const since30d = new Date();
  since30d.setDate(since30d.getDate() - 30);

  // Fan-out de queries en paralelo. Cada una alimenta la micro-info de
  // su card; si una falla, esa card cae en el copy default y las demás
  // se renderizan igual.
  const [
    todaySleeps,
    lastMeasurement,
    nextMilestone,
    lastDiaperPhoto,
    lastSummary,
    careGuidesCount,
  ] = await Promise.all([
    child
      ? supabase
          .from('sleep_sessions')
          .select('started_at, ended_at, is_nap')
          .eq('child_id', child.id)
          .is('deleted_at', null)
          .gte('started_at', todayStart.toISOString())
          .order('started_at', { ascending: false })
      : Promise.resolve({ data: null }),
    child
      ? supabase
          .from('child_measurements')
          .select('measured_at, weight_grams')
          .eq('child_id', child.id)
          .is('deleted_at', null)
          .order('measured_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('medical_milestones')
      .select('title, due_at, category')
      .is('deleted_at', null)
      .is('completed_at', null)
      .order('due_at', { ascending: true, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    child
      ? supabase
          .from('diaper_events')
          .select('occurred_at, photo_path, photo_analysis')
          .eq('child_id', child.id)
          .is('deleted_at', null)
          .not('photo_path', 'is', null)
          .order('occurred_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    child?.family_group_id
      ? // biome-ignore lint/suspicious/noExplicitAny: pediatric_summaries falta en types/database.ts (regenerar Supabase types resolvería).
        (supabase as any)
          .from('pediatric_summaries')
          .select('created_at, period_label')
          .eq('family_group_id', child.family_group_id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('care_guides')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null),
  ]);

  // Sueño — total minutos y siestas hoy.
  const sleeps = (todaySleeps.data ?? []) as Array<{
    started_at: string;
    ended_at: string | null;
    is_nap: boolean;
  }>;
  let totalSleepMin = 0;
  let napsCount = 0;
  for (const s of sleeps) {
    if (s.ended_at) totalSleepMin += minutesBetween(s.started_at, s.ended_at);
    if (s.is_nap) napsCount += 1;
  }
  const sleepMicro =
    sleeps.length === 0
      ? 'Sin sueños hoy'
      : totalSleepMin === 0
        ? `${sleeps.length} sueño${sleeps.length === 1 ? '' : 's'} en curso`
        : `Hoy: ${hoursLabel(totalSleepMin)}${napsCount > 0 ? ` · ${napsCount} siesta${napsCount === 1 ? '' : 's'}` : ''}`;

  // Mediciones — última peso + cuándo.
  const measurement = lastMeasurement.data as {
    measured_at: string;
    weight_grams: number | null;
  } | null;
  const measurementMicro = measurement
    ? `${measurement.weight_grams ? `${(measurement.weight_grams / 1000).toFixed(2)} kg` : 'Sin peso'} · ${relativeDays(measurement.measured_at)}`
    : 'Sin mediciones todavía';

  // Calendario — próximo turno.
  const milestone = nextMilestone.data as {
    title: string;
    due_at: string | null;
    category: string;
  } | null;
  let calendarMicro = 'Sin turnos próximos';
  if (milestone?.due_at) {
    const when = relativeUntil(milestone.due_at);
    const dayName = shortWeekday(milestone.due_at);
    const isCloseFuture = when.startsWith('en ') || when === 'hoy' || when === 'mañana';
    calendarMicro = `${milestone.title} · ${isCloseFuture && when !== 'hoy' && when !== 'mañana' ? `${dayName} (${when})` : when}`;
  }

  // Aquitapp — última foto analizada.
  const photo = lastDiaperPhoto.data as {
    occurred_at: string;
    photo_path: string;
    photo_analysis: { alarm?: boolean } | null;
  } | null;
  const aquitappMicro = photo
    ? `Última foto: hace ${durationLabel(photo.occurred_at)}${photo.photo_analysis?.alarm ? ' · alarma' : ''}`
    : 'Todavía no analizaste un pañal';

  // Borrador para el control.
  const summary = lastSummary.data as { created_at: string; period_label: string } | null;
  const controlMicro = summary
    ? `Último borrador: ${relativeDays(summary.created_at)}`
    : 'Todavía no hay borrador';

  // Guía de cuidado — count.
  const guidesCount = careGuidesCount.count ?? 0;
  const guideMicro =
    guidesCount === 0
      ? 'Sin entradas todavía'
      : `${guidesCount} entrada${guidesCount === 1 ? '' : 's'}`;

  // Cards con su sección asignada — el orden de OPTIONS no importa
  // visualmente porque el render las agrupa por sección abajo.
  const OPTIONS: CuidarOption[] = [
    // Salud — lo clínico, lo que llevarías al pediatra.
    {
      href: '/cuidar/calendario' as Route,
      title: 'Calendario de controles',
      description: 'Pesquisa neonatal, ecografías, vacunas — lo que viene.',
      Icon: CalendarClock,
      microInfo: calendarMicro,
      section: 'salud',
    },
    {
      href: '/cuidar/mediciones' as Route,
      title: 'Mediciones',
      description: 'Peso, talla, perímetro cefálico — cómo va creciendo.',
      Icon: Ruler,
      microInfo: measurementMicro,
      section: 'salud',
    },
    {
      href: '/cuidar/panal-foto' as Route,
      title: 'Aquitapp',
      description: 'Foto del pañal y SalustIA te dice si conviene mostrarlo.',
      Icon: Camera,
      badge: 'Beta',
      microInfo: aquitappMicro,
      section: 'salud',
    },
    {
      href: '/cuidar/control' as Route,
      title: 'Borrador para el control',
      description: 'Resumen del último período para llevar al pediatra.',
      Icon: ClipboardCheck,
      badge: 'Beta',
      microInfo: controlMicro,
      section: 'salud',
    },
    // Patrones — cómo viene la rutina diaria.
    {
      href: '/cuidar/sueno' as Route,
      title: 'Sueño',
      description: 'Cómo viene el descanso, ventana de vigilia y guía de sueño seguro.',
      Icon: Moon,
      microInfo: sleepMicro,
      section: 'patrones',
    },
    {
      href: '/cuidar/patrones' as Route,
      title: 'Patrones del bebé',
      description: 'IA observa tu rutina de los últimos 14 días — sin diagnósticos.',
      Icon: Sparkles,
      badge: 'IA',
      microInfo: 'Se genera on demand',
      section: 'patrones',
    },
    // Aprender — referencia.
    {
      href: '/cuidar/guia' as Route,
      title: 'Guía de cuidado',
      description: 'Lo que la pediatra te dijo, lo que aprendieron en familia.',
      Icon: BookHeart,
      microInfo: guideMicro,
      section: 'aprender',
    },
  ];

  // Agrupamos para el render. Mantenemos el orden de SECTIONS.
  const grouped = SECTIONS.map((section) => ({
    section,
    options: OPTIONS.filter((o) => o.section === section.id),
  })).filter((g) => g.options.length > 0);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader
        eyebrow="Cuidar"
        title="El día a día de Salu, ordenado."
        description="Tres áreas: Salud, Patrones y Aprender. Tocá una herramienta para entrar."
      />

      {grouped.map(({ section, options }, sectionIdx) => (
        <section
          key={section.id}
          className="animate-stagger-up flex flex-col gap-4"
          style={{ animationDelay: `${60 + sectionIdx * 80}ms` }}
        >
          <header className="flex flex-col gap-1">
            <span className="font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.22em]">
              {section.eyebrow}
            </span>
            <p className="text-muted-foreground text-sm leading-relaxed">{section.description}</p>
          </header>
          <div className="grid gap-3 sm:grid-cols-2">
            {options.map((opt, idx) => (
              <CuidarCard key={opt.title} option={opt} index={idx} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function CuidarCard({ option, index }: { option: CuidarOption; index: number }) {
  const { Icon } = option;
  const delay = `${60 + index * 40}ms`;
  return (
    <Link
      href={option.href}
      className="animate-stagger-up rounded-2xl outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      style={{ animationDelay: delay }}
    >
      <Card
        className={cn(
          'group/cuidar relative flex h-full flex-col gap-3 overflow-hidden border-border/60 bg-gradient-to-br from-card to-card/40 p-4 transition-all duration-300',
          'hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5',
        )}
      >
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/10 transition-all duration-300 group-hover/cuidar:scale-110 group-hover/cuidar:bg-primary/15">
            <Icon className="size-5" aria-hidden />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display font-medium text-base text-foreground leading-snug tracking-tight">
                {option.title}
              </h2>
              {option.badge && (
                <span className="inline-flex items-center rounded-full border border-accent/40 bg-accent/40 px-2 py-0.5 font-medium text-[10px] text-accent-foreground uppercase tracking-wider">
                  {option.badge}
                </span>
              )}
            </div>
            <p className="line-clamp-2 text-muted-foreground text-xs leading-relaxed">
              {option.description}
            </p>
          </div>
        </div>
        {option.microInfo && (
          <div className="mt-auto flex items-center gap-2 border-border/40 border-t pt-2.5">
            <span className="size-1.5 shrink-0 rounded-full bg-primary/60" aria-hidden />
            <span className="line-clamp-1 font-medium text-foreground/90 text-xs">
              {option.microInfo}
            </span>
          </div>
        )}
      </Card>
    </Link>
  );
}
