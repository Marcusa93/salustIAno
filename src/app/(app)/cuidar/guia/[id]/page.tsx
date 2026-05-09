import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';
import { CARE_GUIDE_CATEGORY_LABELS, type CareGuideCategory } from '@/lib/validators/care-guide';
import { ChevronLeft, Pencil } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DeleteCareGuideButton } from './_components/delete-button';

export const metadata: Metadata = {
  title: 'Entrada · Guía de cuidado',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}

export default async function CareGuideDetailPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: guide, error } = await supabase
    .from('care_guides')
    .select('id, title, content, category, source, created_by, created_at, updated_at')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !guide) notFound();

  const { data: userData } = await supabase.auth.getUser();
  const canEdit = !!userData.user && guide.created_by === userData.user.id;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-3">
        <Button
          render={<Link href="/cuidar/guia" />}
          variant="ghost"
          size="sm"
          className="self-start"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Volver
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 font-medium text-primary text-xs">
            {CARE_GUIDE_CATEGORY_LABELS[guide.category as CareGuideCategory]}
          </span>
          <span className="text-muted-foreground text-xs">{formatDate(guide.created_at)}</span>
        </div>
        <h1 className="font-display text-3xl text-foreground tracking-tight sm:text-4xl">
          {guide.title}
        </h1>
        {guide.source && <p className="text-muted-foreground italic">— {guide.source}</p>}
      </header>

      <Card className="p-6 sm:p-8">
        <div className="whitespace-pre-wrap font-serif text-base text-foreground leading-[1.7] sm:text-lg">
          {guide.content}
        </div>
      </Card>

      {canEdit && (
        <div className="flex flex-wrap gap-2 border-border border-t pt-4">
          <Button
            render={<Link href={`/cuidar/guia/${guide.id}/editar` as Route} />}
            variant="default"
            size="sm"
          >
            <Pencil className="size-4" aria-hidden />
            Editar
          </Button>
          <DeleteCareGuideButton id={guide.id} title={guide.title} />
        </div>
      )}
    </div>
  );
}
