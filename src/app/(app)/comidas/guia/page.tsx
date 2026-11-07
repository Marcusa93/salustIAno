import { AVOID_UNDER_12 } from '@/lib/solids/catalog';
import { GUIDE, GUIDE_SOURCES, type GuideBlock } from '@/lib/solids/guide';
import { cn } from '@/lib/utils';
import { AlertTriangle, ArrowLeft, Info, Phone } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Guía de alimentación',
};

export default function GuiaComidasPage() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-8 px-4 sm:px-6">
      <header className="flex flex-col gap-3">
        <Link
          href={'/comidas' as Route}
          className="inline-flex items-center gap-1 self-start text-muted-foreground text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Comidas
        </Link>
        <span className="font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.22em]">
          Alimentación complementaria
        </span>
        <h1 className="font-display text-[2.2rem] text-foreground leading-[1.05] tracking-tight">
          La guía de la mesa.
        </h1>
        <p className="text-muted-foreground">
          Lo esencial para los primeros meses de comida, sin vueltas.
        </p>
      </header>

      <a
        href="tel:107"
        className="flex items-center gap-3 rounded-2xl bg-health-soft px-4 py-3 text-health-foreground ring-1 ring-health/30"
      >
        <Phone className="size-5 shrink-0" aria-hidden />
        <span className="text-sm">
          <strong className="font-medium">Emergencias: 107 o 911.</strong> Si no puede respirar,
          toser ni llorar, o se le hincha la cara.
        </span>
      </a>

      <nav aria-label="Temas" className="flex flex-wrap gap-2">
        {GUIDE.map((g) => (
          <a
            key={g.id}
            href={`#${g.id}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-foreground text-sm ring-1 ring-foreground/[0.08]"
          >
            <span aria-hidden>{g.emoji}</span>
            {g.title}
          </a>
        ))}
        <a
          href="#evitar"
          className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-foreground text-sm ring-1 ring-foreground/[0.08]"
        >
          <span aria-hidden>🚫</span>
          Antes del año, no
        </a>
      </nav>

      {GUIDE.map((section) => (
        <section key={section.id} id={section.id} className="flex scroll-mt-20 flex-col gap-4">
          <h2 className="flex items-center gap-2 font-display text-2xl text-foreground">
            <span aria-hidden>{section.emoji}</span>
            {section.title}
          </h2>
          {section.blocks.map((block, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: contenido estático, el orden no cambia.
            <Block key={i} block={block} />
          ))}
        </section>
      ))}

      <section id="evitar" className="flex scroll-mt-20 flex-col gap-4">
        <h2 className="flex items-center gap-2 font-display text-2xl text-foreground">
          <span aria-hidden>🚫</span>
          Antes del año, no
        </h2>
        <ul className="flex flex-col gap-2">
          {AVOID_UNDER_12.map((item) => (
            <li
              key={item.name}
              className="rounded-2xl bg-card px-4 py-3 ring-1 ring-foreground/[0.06]"
            >
              <span className="font-medium text-foreground">{item.name}</span>
              <span className="block text-muted-foreground text-sm">{item.why}</span>
            </li>
          ))}
        </ul>
      </section>

      <footer className="flex flex-col gap-2 border-t pt-6 text-muted-foreground text-xs">
        <span className="font-medium">Fuentes</span>
        <ul className="flex list-disc flex-col gap-1 pl-4">
          {GUIDE_SOURCES.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        <p>Es orientación general. Ante cualquier duda, la pediatra tiene la última palabra.</p>
      </footer>
    </div>
  );
}

function Block({ block }: { block: GuideBlock }) {
  switch (block.kind) {
    case 'p':
      return <p className="text-foreground leading-relaxed">{block.text}</p>;
    case 'list':
      return (
        <div className="flex flex-col gap-2">
          {block.title && <h3 className="font-medium text-foreground">{block.title}</h3>}
          <ul className="flex flex-col gap-1.5">
            {block.items.map((item) => (
              <li key={item} className="flex gap-2 text-foreground leading-relaxed">
                <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-solid" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>
      );
    case 'alert':
      return (
        <div
          className={cn(
            'flex gap-3 rounded-2xl px-4 py-3 ring-1',
            block.tone === 'danger'
              ? 'bg-health-soft text-health-foreground ring-health/30'
              : 'bg-solid-soft text-solid-foreground ring-solid/25',
          )}
        >
          {block.tone === 'danger' ? (
            <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
          ) : (
            <Info className="mt-0.5 size-5 shrink-0" aria-hidden />
          )}
          <div className="flex flex-col gap-1">
            <strong className="font-medium">{block.title}</strong>
            <p className="text-sm leading-relaxed">{block.text}</p>
          </div>
        </div>
      );
    case 'compare':
      return (
        <div className="flex flex-col gap-3">
          {block.items.map((item) => (
            <div
              key={item.title}
              className="flex flex-col gap-2 rounded-3xl bg-card p-4 ring-1 ring-foreground/[0.06]"
            >
              <h3 className="font-display text-foreground text-xl">{item.title}</h3>
              <p className="text-sm leading-relaxed">
                <span className="font-medium text-solid-foreground">A favor: </span>
                <span className="text-foreground">{item.pros}</span>
              </p>
              <p className="text-sm leading-relaxed">
                <span className="font-medium text-feed-foreground">Ojo: </span>
                <span className="text-foreground">{item.cons}</span>
              </p>
            </div>
          ))}
        </div>
      );
  }
}
