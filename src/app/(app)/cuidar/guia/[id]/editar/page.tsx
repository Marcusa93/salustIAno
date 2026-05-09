import { PageHeader } from '@/components/salu/page-header';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import type { CareGuideCategory } from '@/lib/validators/care-guide';
import { ChevronLeft } from 'lucide-react';
import type { Metadata, Route } from 'next';
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
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-9 px-4 py-10 sm:px-6 sm:py-14">
      <Button
        render={<Link href={`/cuidar/guia/${guide.id}` as Route} />}
        variant="ghost"
        size="sm"
        className="-mb-2 self-start text-muted-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Volver a la entrada
      </Button>

      <PageHeader eyebrow="Cuidar · Guía" title="Editar entrada." />

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
