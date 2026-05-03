import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';
import { NOTE_CATEGORY_LABELS, type NoteCategory } from '@/lib/validators/note';
import { BookHeart, ChevronLeft, Pencil } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { listNotePhotosAction } from '../actions';
import { DeleteNoteButton } from './_components/delete-note-button';
import { NotePhotos } from './_components/note-photos';

export const metadata: Metadata = {
  title: 'Nota',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function NoteDetailPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: note, error } = await supabase
    .from('notes')
    .select('id, child_id, occurred_at, category, content, created_by, created_at, updated_at')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !note) notFound();

  const { data: userData } = await supabase.auth.getUser();
  const photos = await listNotePhotosAction(note.id);

  // Edit/delete: el autor o un admin (RLS lo impone; la UI lo refleja).
  let canEdit = false;
  if (userData.user) {
    if (note.created_by === userData.user.id) {
      canEdit = true;
    } else {
      const { data: child } = await supabase
        .from('child_profiles')
        .select('family_group_id')
        .eq('id', note.child_id)
        .maybeSingle();
      if (child) {
        const { data: membership } = await supabase
          .from('family_memberships')
          .select('role')
          .eq('user_id', userData.user.id)
          .eq('family_group_id', child.family_group_id)
          .is('deleted_at', null)
          .maybeSingle();
        canEdit = membership?.role === 'admin';
      }
    }
  }

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
        <div className="flex items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <BookHeart className="size-7" aria-hidden />
          </div>
          <div className="flex flex-col gap-1">
            <span className="inline-flex w-fit items-center rounded-full bg-primary/10 px-2.5 py-0.5 font-medium text-primary text-xs">
              {NOTE_CATEGORY_LABELS[note.category as NoteCategory]}
            </span>
            <h1 className="font-display text-2xl text-foreground tracking-tight sm:text-3xl">
              {formatDateTime(note.occurred_at)}
            </h1>
          </div>
        </div>
      </header>

      <Card className="p-6 sm:p-8">
        <div className="whitespace-pre-wrap font-serif text-base text-foreground leading-[1.75] sm:text-lg">
          {note.content}
        </div>
      </Card>

      <NotePhotos noteId={note.id} initial={photos} canEdit={canEdit} />

      {canEdit && (
        <div className="flex flex-wrap gap-2 border-border border-t pt-4">
          <Button
            render={<Link href={`/notas/${note.id}/editar` as Route} />}
            variant="default"
            size="sm"
          >
            <Pencil className="size-4" aria-hidden />
            Editar
          </Button>
          <DeleteNoteButton id={note.id} />
        </div>
      )}
    </div>
  );
}
