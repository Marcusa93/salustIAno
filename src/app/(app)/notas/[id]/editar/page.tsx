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
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-3">
        <Button
          render={<Link href={`/notas/${note.id}` as Route} />}
          variant="ghost"
          size="sm"
          className="self-start"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Volver
        </Button>
        <h1 className="font-display text-3xl text-foreground tracking-tight sm:text-4xl">
          Editar nota
        </h1>
      </header>

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
