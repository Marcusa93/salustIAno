import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { NoteForm } from '../_components/note-form';
import { createNoteAction } from '../actions';

export const metadata: Metadata = {
  title: 'Nuevo momento',
};

export default function NewNotePage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-3">
        <Button
          render={<Link href="/timeline?tipo=note" />}
          variant="ghost"
          size="sm"
          className="self-start"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Volver
        </Button>
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-3xl text-foreground tracking-tight sm:text-4xl">
            Anotar un momento
          </h1>
          <p className="text-muted-foreground">
            Un recuerdo, una observación, una primera vez. Para volver a leerlo después.
          </p>
        </div>
      </header>

      <NoteForm onSubmitAction={createNoteAction} submitLabel="Guardar" />
    </div>
  );
}
