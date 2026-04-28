import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';
import {
  CARE_GUIDE_CATEGORY_LABELS,
  type CareGuideCategory,
  careGuideCategoryEnum,
} from '@/lib/validators/care-guide';
import { BookHeart, ChevronLeft, Plus } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Guía de cuidado',
};

interface PageProps {
  searchParams: Promise<{ categoria?: string }>;
}

const CATEGORIES = careGuideCategoryEnum.options;

function snippet(content: string, max = 140): string {
  const trimmed = content.trim().replace(/\s+/g, ' ');
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default async function CareGuidesListPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const selectedCategory =
    params.categoria && CATEGORIES.includes(params.categoria as CareGuideCategory)
      ? (params.categoria as CareGuideCategory)
      : null;

  const supabase = await createClient();
  let query = supabase
    .from('care_guides')
    .select('id, title, content, category, source, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (selectedCategory) {
    query = query.eq('category', selectedCategory);
  }

  const { data: guides, error } = await query;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-3">
        <Button render={<Link href="/cuidar" />} variant="ghost" size="sm" className="self-start">
          <ChevronLeft className="size-4" aria-hidden />
          Volver
        </Button>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-3xl text-foreground tracking-tight sm:text-4xl">
              Guía de cuidado
            </h1>
            <p className="max-w-prose text-muted-foreground">
              Lo que aprendieron, lo que les dijeron, lo que vale la pena tener cerca.
            </p>
          </div>
          <Button render={<Link href="/cuidar/guia/nuevo" />} size="sm">
            <Plus className="size-4" aria-hidden />
            Agregar
          </Button>
        </div>
      </header>

      <nav aria-label="Filtrar por categoría" className="flex flex-wrap gap-2">
        <FilterChip href="/cuidar/guia" active={selectedCategory === null} label="Todas" />
        {CATEGORIES.map((cat) => (
          <FilterChip
            key={cat}
            href={`/cuidar/guia?categoria=${cat}`}
            active={selectedCategory === cat}
            label={CARE_GUIDE_CATEGORY_LABELS[cat]}
          />
        ))}
      </nav>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-destructive text-sm">
          No pudimos cargar la guía. Probá refrescar la página.
        </div>
      ) : !guides || guides.length === 0 ? (
        <Card className="flex flex-col items-center gap-4 p-10 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <BookHeart className="size-6" aria-hidden />
          </div>
          <div className="flex flex-col gap-1.5">
            <h2 className="font-medium text-foreground text-lg">
              {selectedCategory ? 'Nada por acá todavía.' : 'Empezá a llenar la guía.'}
            </h2>
            <p className="max-w-md text-muted-foreground text-sm">
              Cargá lo que te dijeron en el último control, o lo que aprendiste en familia. Después,
              cuando necesites, lo tenés a mano.
            </p>
          </div>
          <Button render={<Link href="/cuidar/guia/nuevo" />}>
            <Plus className="size-4" aria-hidden />
            Agregar la primera entrada
          </Button>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {guides.map((g) => (
            <li key={g.id}>
              <Link
                href={`/cuidar/guia/${g.id}` as Route}
                className="block rounded-lg outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
              >
                <Card className="flex flex-col gap-3 p-5 transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 font-medium text-primary text-xs">
                      {CARE_GUIDE_CATEGORY_LABELS[g.category as CareGuideCategory]}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {formatDate(g.created_at)}
                    </span>
                  </div>
                  <h3 className="font-medium text-foreground text-lg">{g.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {snippet(g.content)}
                  </p>
                  {g.source && <p className="text-muted-foreground text-xs italic">— {g.source}</p>}
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href as Route}
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1.5 font-medium text-sm transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground',
      )}
    >
      {label}
    </Link>
  );
}
