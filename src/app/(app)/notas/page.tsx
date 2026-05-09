import { EmptyState } from '@/components/salu/empty-state';
import { NoteEmptyIllustration } from '@/components/salu/illustrations/note-empty';
import { PageHeader } from '@/components/salu/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatDateAr } from '@/lib/format-ar';
import { createClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';
import { NOTE_CATEGORY_LABELS, type NoteCategory, noteCategoryEnum } from '@/lib/validators/note';
import { BookHeart, Plus } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Notas',
};

interface NoteRow {
  id: string;
  occurred_at: string;
  category: NoteCategory;
  content: string;
}

interface PageProps {
  searchParams: Promise<{ categoria?: string }>;
}

const CATEGORIES = noteCategoryEnum.options;

function snippet(content: string, max = 180): string {
  const trimmed = content.trim().replace(/\s+/g, ' ');
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

function formatDate(iso: string): string {
  return formatDateAr(iso, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default async function NotasListPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filter =
    params.categoria && CATEGORIES.includes(params.categoria as NoteCategory)
      ? (params.categoria as NoteCategory)
      : null;

  const supabase = await createClient();
  let query = supabase
    .from('notes')
    .select('id, occurred_at, category, content')
    .is('deleted_at', null)
    .order('occurred_at', { ascending: false })
    .limit(100);

  if (filter) {
    query = query.eq('category', filter);
  }

  const { data: notes, error } = await query;
  const rows = (notes ?? []) as NoteRow[];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-9 px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader
        eyebrow="Notas"
        title="Lo que querés guardar."
        description="Recuerdos, observaciones, hitos vividos. Cosas chicas que con el tiempo se vuelven preciadas."
        action={
          <Button render={<Link href="/notas/nuevo" />} size="sm">
            <Plus className="size-4" aria-hidden />
            Anotar momento
          </Button>
        }
      />

      <nav aria-label="Filtrar notas por categoría" className="flex flex-wrap gap-2">
        <FilterChip href="/notas" active={filter === null} label="Todas" />
        {CATEGORIES.map((cat) => (
          <FilterChip
            key={cat}
            href={`/notas?categoria=${cat}`}
            active={filter === cat}
            label={NOTE_CATEGORY_LABELS[cat]}
          />
        ))}
      </nav>

      {error ? (
        <Card className="border-destructive/30 bg-destructive/5 p-4 text-destructive text-sm">
          No pudimos cargar las notas. Probá refrescar la página.
        </Card>
      ) : rows.length === 0 ? (
        <EmptyState
          illustration={
            <div className="text-primary">
              <NoteEmptyIllustration size={140} />
            </div>
          }
          title={filter ? 'Nada por acá todavía.' : 'Empezá a guardar momentos.'}
          description="Una sonrisa, una primera vez, algo gracioso. Lo escribís en 30 segundos y queda guardado."
          action={{ label: 'Anotar el primer momento', href: '/notas/nuevo' as Route }}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((n) => (
            <li key={n.id}>
              <NoteCard row={n} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NoteCard({ row }: { row: NoteRow }) {
  return (
    <Link
      href={`/notas/${row.id}` as Route}
      className="block rounded-2xl outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <Card className="flex flex-col gap-2 border-border/60 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md hover:shadow-primary/5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-[10.5px] text-primary uppercase tracking-wider">
            <BookHeart className="size-2.5" aria-hidden />
            {NOTE_CATEGORY_LABELS[row.category]}
          </span>
          <span className="text-muted-foreground text-xs">{formatDate(row.occurred_at)}</span>
        </div>
        <p className="line-clamp-3 whitespace-pre-line text-foreground/90 text-sm leading-relaxed">
          {snippet(row.content)}
        </p>
      </Card>
    </Link>
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
