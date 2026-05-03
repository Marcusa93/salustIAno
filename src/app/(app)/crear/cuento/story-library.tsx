'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { BookOpen, ChevronDown, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { type StoryLibraryEntry, deleteStoryAction } from './actions';

export function StoryLibrary({ entries }: { entries: StoryLibraryEntry[] }) {
  const [items, setItems] = useState(entries);
  const [openId, setOpenId] = useState<string | null>(null);

  function handleDelete(id: string) {
    if (!window.confirm('¿Borrar este cuento de la biblioteca?')) return;
    setItems((prev) => prev.filter((e) => e.id !== id));
    if (openId === id) setOpenId(null);
    void deleteStoryAction(id).then((r) => {
      if (!r.ok) toast.error(r.error);
    });
  }

  if (entries.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 p-10 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/10">
          <BookOpen className="size-7" aria-hidden />
        </div>
        <p className="max-w-sm text-muted-foreground leading-relaxed">
          Todavía no hay cuentos guardados. Generá el primero acá arriba — queda guardado en la
          biblioteca para volver a leerlo.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((entry) => {
        const isOpen = openId === entry.id;
        return (
          <Card
            key={entry.id}
            className={cn(
              'flex flex-col border-border/60 p-4 transition-colors',
              isOpen && 'border-primary/30 bg-primary/[0.03]',
            )}
          >
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : entry.id)}
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/10 transition-all hover:bg-primary/15"
                aria-label={isOpen ? 'Cerrar' : 'Abrir'}
              >
                <ChevronDown
                  className={cn('size-5 transition-transform', isOpen && 'rotate-180')}
                  aria-hidden
                />
              </button>
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : entry.id)}
                className="flex min-w-0 flex-1 flex-col gap-0.5 text-left"
              >
                <span className="font-display font-medium text-foreground tracking-tight">
                  {entry.title}
                </span>
                <span className="text-muted-foreground text-xs">
                  {formatRelative(entry.createdAt)}
                  {entry.charactersUsed.length > 0
                    ? ` · ${entry.charactersUsed.slice(0, 3).join(', ')}${entry.charactersUsed.length > 3 ? '…' : ''}`
                    : ''}
                </span>
              </button>
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                onClick={() => handleDelete(entry.id)}
                aria-label="Borrar cuento"
              >
                <Trash2 className="size-3" aria-hidden />
              </Button>
            </div>

            {isOpen && (
              <div className="mt-4 flex flex-col gap-3 border-border/40 border-t pt-4">
                <div className="whitespace-pre-line font-display text-foreground leading-[1.85]">
                  {entry.story}
                </div>
                {entry.moralOrTheme && (
                  <p className="border-primary/15 border-t pt-3 text-muted-foreground text-sm italic leading-relaxed">
                    {entry.moralOrTheme}
                  </p>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function formatRelative(iso: string): string {
  const days = Math.round((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
  if (days === 0) return 'hoy';
  if (days === 1) return 'ayer';
  if (days < 7) return `hace ${days} días`;
  if (days < 30) return `hace ${Math.round(days / 7)} sem`;
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}
