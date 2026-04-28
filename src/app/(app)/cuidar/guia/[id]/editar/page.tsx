import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import type { CareGuideCategory } from '@/lib/validators/care-guide';
import { ChevronLeft } from 'lucide-react';
import type { Metadata } from 'next';
import type { Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CareGuideForm } from '../../_components/care-guide-form';
import { updateCareGuideAction } from '../../actions';

export const metadata: Metadata = {
  title: 'Editar entrada · Guía de cuidado',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCareGuidePage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: guide, error } = await supabase
    .from('care_guides')
    .select('id, title, category, content, source')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !guide) notFound();

  const onSubmit = updateCareGuideAction.bind(null, guide.id);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-3">
        <Button
          render={<Link href={`/cuidar/guia/${guide.id}` as Route} />}
          variant="ghost"
          size="sm"
          className="self-start"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Volver
        </Button>
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-3xl text-foreground tracking-tight sm:text-4xl">
            Editar entrada
          </h1>
        </div>
      </header>

      <CareGuideForm
        defaultValues={{
          title: guide.title,
          category: guide.category as CareGuideCategory,
          content: guide.content,
          source: guide.source ?? '',
        }}
        onSubmitAction={onSubmit}
        submitLabel="Guardar cambios"
      />
    </div>
  );
}
