import { PageHeader } from '@/components/salu/page-header';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { NoteForm } from '../_components/note-form';
import { createNoteAction } from '../actions';

export const metadata: Metadata = {
  title: 'Nuevo momento',
};

export default function NewNotePage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-9 px-4 py-10 sm:px-6 sm:py-14">
      <Button
        render={<Link href={'/notas' as Route} />}
        variant="ghost"
        size="sm"
        className="-mb-2 self-start text-muted-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Notas
      </Button>

      <PageHeader
        eyebrow="Notas"
        title="Anotar un momento."
        description="Un recuerdo, una observación, una primera vez. Para volver a leerlo después."
      />

      <NoteForm onSubmitAction={createNoteAction} submitLabel="Guardar" />
    </div>
  );
}
