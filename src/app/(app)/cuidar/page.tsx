import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { BookHeart, CalendarClock, Camera, ClipboardCheck, Ruler } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Cuidar',
};

interface CuidarOption {
  href?: string;
  title: string;
  description: string;
  Icon: typeof BookHeart;
  badge?: string;
  disabled?: boolean;
}

const OPTIONS: CuidarOption[] = [
  {
    href: '/cuidar/guia',
    title: 'Guía de cuidado',
    description:
      'Lo que la pediatra te dijo, lo que aprendieron en familia, lo que conviene tener a mano.',
    Icon: BookHeart,
  },
  {
    href: '/cuidar/calendario',
    title: 'Calendario de controles',
    description: 'Pesquisa neonatal, ecografías, vacunas. Lo que viene y lo que ya hicieron.',
    Icon: CalendarClock,
  },
  {
    href: '/cuidar/mediciones',
    title: 'Mediciones',
    description: 'Peso, talla, perímetro cefálico. Cómo va creciendo control a control.',
    Icon: Ruler,
  },
  {
    href: '/cuidar/panal-foto',
    title: 'Aquitapp',
    description: 'Foto del pañal y SalustIA te dice color, consistencia y si conviene mostrarlo.',
    Icon: Camera,
    badge: 'Beta',
  },
  {
    href: '/cuidar/control',
    title: 'Borrador para el control',
    description:
      'Resumen del último período (tomas, sueños, pañales, dudas) para llevar al pediatra.',
    Icon: ClipboardCheck,
    badge: 'Beta',
  },
];

export default function CuidarPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14">
      <header className="animate-stagger-up flex flex-col gap-2" style={{ animationDelay: '0ms' }}>
        <span className="font-medium text-muted-foreground/80 text-[11px] uppercase tracking-[0.22em]">
          Cuidar
        </span>
        <h1 className="font-display text-[clamp(2.25rem,5vw,3.5rem)] text-foreground leading-[1.05] tracking-tight">
          El día a día de Salu, ordenado.
        </h1>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {OPTIONS.map((opt, idx) => (
          <CuidarCard key={opt.title} option={opt} index={idx} />
        ))}
      </div>
    </div>
  );
}

function CuidarCard({ option, index }: { option: CuidarOption; index: number }) {
  const { Icon } = option;
  const delay = `${60 + index * 50}ms`;
  const cardContent = (
    <Card
      className={cn(
        'group/cuidar relative flex flex-col gap-4 overflow-hidden border-border/60 bg-gradient-to-br from-card to-card/40 p-6 transition-all duration-300',
        option.disabled
          ? 'pointer-events-none opacity-60'
          : 'hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5',
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/10 transition-all duration-300 group-hover/cuidar:scale-110 group-hover/cuidar:bg-primary/15">
        <Icon className="size-6" aria-hidden />
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <h2 className="font-display font-medium text-foreground text-lg leading-snug tracking-tight">
            {option.title}
          </h2>
          {option.badge && (
            <span className="inline-flex items-center rounded-full border border-accent/40 bg-accent/40 px-2 py-0.5 font-medium text-[10px] text-accent-foreground uppercase tracking-wider">
              {option.badge}
            </span>
          )}
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed">{option.description}</p>
      </div>
    </Card>
  );

  if (option.href && !option.disabled) {
    return (
      <Link
        href={option.href as never}
        className="animate-stagger-up rounded-2xl outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
        style={{ animationDelay: delay }}
      >
        {cardContent}
      </Link>
    );
  }
  return (
    <div className="animate-stagger-up" style={{ animationDelay: delay }}>
      {cardContent}
    </div>
  );
}
