import { PageHeader } from '@/components/salu/page-header';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import type { NoteCategory } from '@/lib/validators/note';
import { ChevronLeft } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { NoteForm } from '../../_components/note-form';
import { updateNoteAction } from '../../actions';

export const metadata: Metadata = {
  title: 'Editar nota',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

export default async function EditNotePage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: note, error } = await supabase
    .from('notes')
    .select('id, occurred_at, category, content')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !note) notFound();

  const onSubmit = updateNoteAction.bind(null, note.id);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-9 px-4 py-10 sm:px-6 sm:py-14">
      <Button
        render={<Link href={`/notas/${note.id}` as Route} />}
        variant="ghost"
        size="sm"
        className="-mb-2 self-start text-muted-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Volver a la nota
      </Button>

      <PageHeader eyebrow="Notas" title="Editar nota." />

      <NoteForm
        defaultValues={{
          occurred_at: isoToLocalInput(note.occurred_at),
          category: note.category as NoteCategory,
          content: note.content,
        }}
        onSubmitAction={onSubmit}
        submitLabel="Guardar cambios"
      />
    </div>
  );
}
