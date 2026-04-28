import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { BookHeart, CalendarClock } from 'lucide-react';
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
];

export default function CuidarPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl text-foreground tracking-tight sm:text-4xl">Cuidar</h1>
        <p className="text-muted-foreground">El día a día de Salu, ordenado.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {OPTIONS.map((opt) => (
          <CuidarCard key={opt.title} option={opt} />
        ))}
      </div>
    </div>
  );
}

function CuidarCard({ option }: { option: CuidarOption }) {
  const { Icon } = option;
  const cardContent = (
    <Card
      className={cn(
        'flex flex-col gap-4 p-6 transition-all',
        option.disabled
          ? 'pointer-events-none opacity-60'
          : 'hover:-translate-y-0.5 focus-within:shadow-md hover:shadow-md',
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-6" aria-hidden />
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <h2 className="font-medium text-foreground text-lg">{option.title}</h2>
          {option.badge && (
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
              {option.badge}
            </span>
          )}
        </div>
        <p className="text-muted-foreground text-sm">{option.description}</p>
      </div>
    </Card>
  );

  if (option.href && !option.disabled) {
    return (
      <Link
        href={option.href as never}
        className="rounded-lg outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
      >
        {cardContent}
      </Link>
    );
  }
  return cardContent;
}
