'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { CommentTarget } from '@/lib/validators/comment';
import { Loader2, MessageCircle, Send, Trash2 } from 'lucide-react';
import { type KeyboardEvent, useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  type CommentEntry,
  createCommentAction,
  deleteCommentAction,
} from '../../lib/comments/actions';

interface CommentsThreadProps {
  targetType: CommentTarget;
  targetId: string;
  initial: CommentEntry[];
  /** Si false, escondemos el input pero seguimos mostrando los comments. */
  canComment: boolean;
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const ms = Date.now() - d.getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h}h`;
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

/**
 * Hilo de comentarios genérico — sirve para notas, milestones, eventos en
 * el futuro. Recibe los comentarios iniciales server-rendered, expone form
 * para agregar, optimistic delete con confirmación.
 *
 * Si la familia tiene push activo, agregar un comment dispara push al resto
 * (excluyendo al autor). Eso lo maneja `createCommentAction` server-side.
 */
export function CommentsThread({ targetType, targetId, initial, canComment }: CommentsThreadProps) {
  const [comments, setComments] = useState(initial);
  const [draft, setDraft] = useState('');
  const [pending, startPending] = useTransition();

  function send() {
    const value = draft.trim();
    if (value.length === 0) return;

    startPending(async () => {
      const result = await createCommentAction({
        targetType,
        targetId,
        content: value,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setComments((prev) => [...prev, result.comment]);
      setDraft('');
    });
  }

  function handleDelete(id: string) {
    if (!window.confirm('¿Borrar este comentario?')) return;
    const previous = comments;
    setComments((prev) => prev.filter((c) => c.id !== id));
    void deleteCommentAction(id).then((r) => {
      if (!r.ok) {
        toast.error(r.error);
        setComments(previous);
      }
    });
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!pending) send();
    }
  }

  if (comments.length === 0 && !canComment) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs uppercase tracking-[0.18em]">
        <MessageCircle className="size-3" aria-hidden />
        Conversación
      </h2>

      {comments.length === 0 ? (
        canComment && (
          <p className="text-muted-foreground text-sm">
            Todavía no hay comentarios. Sé la primera persona en dejar uno.
          </p>
        )
      ) : (
        <ul className="flex flex-col gap-3">
          {comments.map((c) => (
            <li key={c.id}>
              <Card
                className={cn(
                  'flex items-start gap-3 p-3',
                  c.isOwn && 'border-primary/20 bg-primary/5',
                )}
              >
                <Avatar size="sm">
                  <AvatarFallback>{c.authorInitial}</AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium text-foreground text-sm">
                      {c.authorDisplayName ?? 'Alguien'}
                    </span>
                    <span className="text-muted-foreground/70 text-xs">
                      {formatRelative(c.createdAt)}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-foreground text-sm leading-relaxed">
                    {c.content}
                  </p>
                </div>
                {c.isOwn && (
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    onClick={() => handleDelete(c.id)}
                    aria-label="Borrar comentario"
                    className="opacity-60 hover:opacity-100"
                  >
                    <Trash2 className="size-3" aria-hidden />
                  </Button>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      {canComment && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!pending) send();
          }}
          className="flex items-end gap-2"
        >
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Escribí un comentario… (Enter para enviar, Shift+Enter línea nueva)"
            rows={2}
            maxLength={500}
            disabled={pending}
            className="flex-1 resize-none"
            aria-label="Nuevo comentario"
          />
          <Button
            type="submit"
            size="icon"
            disabled={pending || draft.trim().length === 0}
            aria-label="Enviar comentario"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Send className="size-4" aria-hidden />
            )}
          </Button>
        </form>
      )}
    </section>
  );
}
