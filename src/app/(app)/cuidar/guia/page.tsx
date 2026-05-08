import { EmptyState } from '@/components/salu/empty-state';
import { PageHeader } from '@/components/salu/page-header';
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
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-9 px-4 py-10 sm:px-6 sm:py-14">
      <Button
        render={<Link href={'/cuidar' as Route} />}
        variant="ghost"
        size="sm"
        className="-mb-2 self-start text-muted-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Cuidar
      </Button>

      <PageHeader
        eyebrow="Cuidar"
        title="Guía de cuidado."
        description="Lo que aprendieron, lo que les dijeron, lo que vale la pena tener cerca."
        action={
          <Button render={<Link href="/cuidar/guia/nuevo" />} size="sm">
            <Plus className="size-4" aria-hidden />
            Agregar
          </Button>
        }
      />

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
        <Card className="border-destructive/30 bg-destructive/5 p-4 text-destructive text-sm">
          No pudimos cargar la guía. Probá refrescar la página.
        </Card>
      ) : !guides || guides.length === 0 ? (
        <EmptyState
          icon={BookHeart}
          title={selectedCategory ? 'Nada por acá todavía.' : 'Empezá a llenar la guía.'}
          description="Cargá lo que te dijeron en el último control, o lo que aprendiste en familia. Después, cuando necesites, lo tenés a mano."
          action={{ label: 'Agregar la primera entrada', href: '/cuidar/guia/nuevo' as Route }}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {guides.map((g) => (
            <li key={g.id}>
              <Link
                href={`/cuidar/guia/${g.id}` as Route}
                className="block rounded-2xl outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <Card className="flex flex-col gap-2 border-border/60 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md hover:shadow-primary/5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 font-medium text-[10.5px] text-primary uppercase tracking-wider">
                      {CARE_GUIDE_CATEGORY_LABELS[g.category as CareGuideCategory]}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {formatDate(g.created_at)}
                    </span>
                  </div>
                  <h3 className="font-medium text-base text-foreground leading-tight">{g.title}</h3>
                  <p className="line-clamp-2 text-muted-foreground text-xs leading-relaxed">
                    {snippet(g.content)}
                  </p>
                  {g.source && (
                    <p className="text-muted-foreground/80 text-xs italic">— {g.source}</p>
                  )}
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
        'inline-flex items-center rounded-full border px-3.5 py-1.5 font-medium text-xs transition-all duration-200',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        active
          ? 'border-primary/30 bg-primary text-primary-foreground shadow-sm'
          : 'border-border/60 bg-card text-muted-foreground hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card hover:text-foreground',
      )}
    >
      {label}
    </Link>
  );
}
