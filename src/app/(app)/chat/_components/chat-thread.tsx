'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import type { Proposal } from '@/lib/ai/agents/salustia/proposals';
import { cn } from '@/lib/utils';
import { Loader2, Send, Sparkles } from 'lucide-react';
import { type KeyboardEvent, useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { type ClientMessage, sendMessageAction } from '../actions';
import { ProposalCard } from './proposal-card';

const SUGGESTIONS = [
  '¿Cómo va el día?',
  '¿Cuándo es el próximo control?',
  'Anotá una toma de pecho hace 1 hora',
  'Mostrame las últimas tomas',
];

/**
 * Estado local del chat — más rico que ClientMessage porque guarda
 * proposals adjuntas a los mensajes del assistant para renderizar las
 * cards de confirmación. Cuando mandamos al server convertimos a
 * ClientMessage[] (que solo tiene role + content).
 */
type ChatEntry =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; proposals: Proposal[] };

interface ChatThreadProps {
  childName: string | null;
}

export function ChatThread({ childName }: ChatThreadProps) {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll al fondo cuando llega un mensaje nuevo.
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [entries.length]);

  function send(text: string) {
    const value = text.trim();
    if (!value) return;

    const nextEntries: ChatEntry[] = [...entries, { role: 'user', content: value }];
    setEntries(nextEntries);
    setDraft('');

    // Server solo necesita role + content — pelamos las proposals.
    const wireMessages: ClientMessage[] = nextEntries.map((e) =>
      e.role === 'user'
        ? { role: 'user', content: e.content }
        : { role: 'assistant', content: e.content },
    );

    startTransition(async () => {
      const result = await sendMessageAction(wireMessages);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setEntries((prev) => [
        ...prev,
        { role: 'assistant', content: result.reply, proposals: result.proposals },
      ]);
      requestAnimationFrame(() => inputRef.current?.focus());
    });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!pending) send(draft);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Thread */}
      <div
        ref={scrollRef}
        className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto pb-4"
        aria-live="polite"
      >
        {entries.length === 0 && (
          <Card className="flex flex-col items-start gap-3 p-5">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="size-5" aria-hidden />
            </div>
            <div className="flex flex-col gap-1">
              <p className="font-medium text-foreground">
                Hola
                {childName
                  ? `, soy SalustIA. Estoy con la info de ${childName}.`
                  : ', soy SalustIA.'}
              </p>
              <p className="text-muted-foreground text-sm">
                Te cuento cómo va el día, qué controles vienen, o anotás una
                toma/sueño/pañal/momento hablándome — siempre con tu confirmación antes de guardar.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-foreground text-xs transition-colors hover:bg-muted"
                >
                  {s}
                </button>
              ))}
            </div>
          </Card>
        )}

        {entries.map((e, i) => (
          <div key={`${e.role}-${i}`} className="flex flex-col gap-2">
            <MessageBubble entry={e} />
            {e.role === 'assistant' &&
              e.proposals.map((p, j) => <ProposalCard key={`${i}-${j}-${p.kind}`} proposal={p} />)}
          </div>
        ))}

        {pending && (
          <Card className="flex w-fit max-w-[75%] items-center gap-2 self-start bg-muted/40 px-4 py-2">
            <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
            <span className="text-muted-foreground text-sm">Pensando…</span>
          </Card>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!pending) send(draft);
        }}
        className="flex items-end gap-2"
      >
        <Textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Preguntale algo a SalustIA…"
          rows={2}
          maxLength={2000}
          disabled={pending}
          className="flex-1 resize-none"
          aria-label="Mensaje para SalustIA"
        />
        <Button type="submit" disabled={pending || draft.trim().length === 0} size="icon">
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Send className="size-4" aria-hidden />
          )}
          <span className="sr-only">Enviar</span>
        </Button>
      </form>
    </div>
  );
}

function MessageBubble({ entry }: { entry: ChatEntry }) {
  const isUser = entry.role === 'user';
  if (!entry.content) return null;
  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <Card
        className={cn(
          'max-w-[85%] whitespace-pre-wrap px-4 py-2.5 text-sm leading-relaxed',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground',
        )}
      >
        {entry.content}
      </Card>
    </div>
  );
}
