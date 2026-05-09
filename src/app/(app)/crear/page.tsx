import { PageHeader } from '@/components/salu/page-header';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { BookOpen, Music, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Crear',
};

interface CreateOption {
  href: Route;
  title: string;
  description: string;
  Icon: LucideIcon;
  badge?: string;
}

const OPTIONS: CreateOption[] = [
  {
    href: '/crear/cuento' as Route,
    title: 'Cuento personalizado',
    description:
      'Una historia hecha para Salu, con sus personajes y el momento del día. La IA arma el relato; vos lo guardás como recuerdo.',
    Icon: BookOpen,
    badge: 'IA',
  },
  {
    href: '/crear/cancion' as Route,
    title: 'Canción para Salu',
    description:
      'Una nana cantable, pensada para el momento que estés viviendo. Letra propia + audio generado.',
    Icon: Music,
    badge: 'IA',
  },
];

export default function CrearPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-9 px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader
        eyebrow="Crear"
        title="Cuentos y canciones para Salu."
        description="Pequeñas obras hechas para él. Se quedan guardadas para volver a leerlas o escucharlas."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {OPTIONS.map((opt, idx) => (
          <CreateCard key={opt.title} option={opt} index={idx} />
        ))}
      </div>
    </div>
  );
}

function CreateCard({ option, index }: { option: CreateOption; index: number }) {
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
          'group/crear relative flex h-full flex-col gap-3 overflow-hidden border-border/60 bg-gradient-to-br from-card via-card to-primary/[0.05] p-5 transition-all duration-300',
          'hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5',
        )}
      >
        {/* Sparkle decorativa para reforzar "esto lo hace IA". */}
        <span
          aria-hidden
          className="-right-4 -top-4 absolute size-24 rounded-full bg-primary/5 blur-2xl"
        />
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/10 transition-transform duration-300 group-hover/crear:scale-110 group-hover/crear:bg-primary/15">
            <Icon className="size-5" aria-hidden />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display font-medium text-base text-foreground leading-snug tracking-tight">
                {option.title}
              </h2>
              {option.badge && (
                <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/40 px-2 py-0.5 font-medium text-[10px] text-accent-foreground uppercase tracking-wider">
                  <Sparkles className="size-2.5" aria-hidden />
                  {option.badge}
                </span>
              )}
            </div>
            <p className="line-clamp-3 text-muted-foreground text-xs leading-relaxed">
              {option.description}
            </p>
          </div>
        </div>
      </Card>
    </Link>
  );
}
