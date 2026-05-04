'use client';

import { ProposalCard } from '@/app/(app)/chat/_components/proposal-card';
import { SaluBotAvatar } from '@/components/salu/salu-bot-avatar';
import { SpeechToTextButton } from '@/components/salu/speech-to-text-button';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import type { Proposal } from '@/lib/ai/agents/salustia/proposals';
import { cn } from '@/lib/utils';
import { Loader2, Send, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { type KeyboardEvent, useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { type ClientMessage, sendBabyMessageAction } from './actions';

type ChatEntry =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; proposals: Proposal[] };

const SUGGESTIONS = [
  'Anotá que tomé teta hace una hora',
  '¿Cómo viene mi día?',
  'Anotá un pañal',
  '¿Cuándo es mi próximo control?',
];

/**
 * Botón flotante esquina inferior derecha que abre un Sheet con un chat
 * en primera persona ("hablo yo, Salu"). Mismo motor que /chat pero con
 * `voice: 'baby'` y sin persistencia de historial — la conversación es
 * ephemeral, ideal para preguntas rápidas o anotar algo en 2 toques.
 *
 * Esconde automáticamente:
 *  - En /chat (no duplicar el chat principal).
 *  - En /bienvenida (onboarding bloqueante).
 *  - En las páginas /compartir/* (públicas, sin sesión).
 */
export function FloatingSalu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll al fondo cuando llega un mensaje nuevo.
  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [open, entries.length]);

  // Foco en el textarea cuando abrimos.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 200);
    return () => clearTimeout(t);
  }, [open]);

  // Hide en rutas donde no aporta o duplica.
  if (pathname === '/chat' || pathname === '/bienvenida' || pathname.startsWith('/compartir')) {
    return null;
  }

  function send(text: string) {
    const value = text.trim();
    if (!value) return;

    const nextEntries: ChatEntry[] = [...entries, { role: 'user', content: value }];
    setEntries(nextEntries);
    setDraft('');

    const wireMessages: ClientMessage[] = nextEntries.map((e) =>
      e.role === 'user'
        ? { role: 'user', content: e.content }
        : { role: 'assistant', content: e.content },
    );

    startTransition(async () => {
      const result = await sendBabyMessageAction(wireMessages);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setEntries((prev) => [
        ...prev,
        { role: 'assistant', content: result.reply, proposals: result.proposals },
      ]);
    });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!pending) send(draft);
    }
  }

  function clearChat() {
    setEntries([]);
    setDraft('');
  }

  return (
    <>
      {/* Botón flotante. md:bottom-4 = sin offset por bottom-nav en desktop;
          en mobile lo alzamos arriba del bottom-nav (76px) + safe-area. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir chat con SaluIA"
        className={cn(
          'fixed right-4 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-1 ring-primary/20 transition-all duration-200',
          'bottom-[calc(env(safe-area-inset-bottom)+76px)] md:bottom-4',
          'hover:-translate-y-0.5 hover:shadow-xl active:scale-95',
          'focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2',
          'animate-breathe print:hidden',
          open && 'opacity-0 pointer-events-none',
        )}
      >
        <SaluBotAvatar size={36} className="text-primary-foreground" monochrome />
        <span
          aria-hidden
          className="absolute size-14 animate-ping rounded-full bg-primary/20 opacity-30"
        />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="flex w-full max-w-md flex-col gap-0 overflow-hidden p-0"
        >
          <SheetHeader className="flex-row items-start gap-3 border-border/60 border-b p-4">
            <span
              aria-hidden
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20"
            >
              <SaluBotAvatar size={32} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <SheetTitle className="text-base">SaluIA</SheetTitle>
              <SheetDescription className="text-xs">
                Soy Salu, hablame en primera persona. Puedo contarte cómo viene mi día o anotar
                algo.
              </SheetDescription>
            </div>
            {entries.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={clearChat}
                disabled={pending}
                className="shrink-0 text-muted-foreground"
              >
                Limpiar
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
              className="shrink-0"
            >
              <X className="size-4" aria-hidden />
            </Button>
          </SheetHeader>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4" aria-live="polite">
            {entries.length === 0 ? (
              <div className="flex flex-col gap-3">
                <Card className="flex flex-col items-start gap-2 bg-primary/5 p-3">
                  <p className="font-medium text-foreground text-sm leading-snug">
                    Hola 👶 Estoy acá si me querés preguntar algo o anotar lo que estoy haciendo.
                  </p>
                  <p className="text-muted-foreground text-xs">Probá con una de estas:</p>
                </Card>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      disabled={pending}
                      className="rounded-full border border-border bg-card px-3 py-1.5 text-foreground text-xs transition-colors hover:bg-muted disabled:opacity-60"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {entries.map((e, i) => (
                  <div key={`${e.role}-${i}`} className="flex flex-col gap-2">
                    <MessageBubble entry={e} />
                    {e.role === 'assistant' &&
                      e.proposals.map((p, j) => (
                        <ProposalCard key={`${i}-${j}-${p.kind}`} proposal={p} />
                      ))}
                  </div>
                ))}
                {pending && (
                  <Card className="flex w-fit items-center gap-2.5 self-start bg-muted/40 px-4 py-3">
                    <span className="flex items-center gap-1">
                      <span
                        className="size-1.5 animate-typing-dot rounded-full bg-muted-foreground"
                        style={{ animationDelay: '0s' }}
                      />
                      <span
                        className="size-1.5 animate-typing-dot rounded-full bg-muted-foreground"
                        style={{ animationDelay: '0.15s' }}
                      />
                      <span
                        className="size-1.5 animate-typing-dot rounded-full bg-muted-foreground"
                        style={{ animationDelay: '0.3s' }}
                      />
                    </span>
                    <span className="sr-only">Salu está pensando…</span>
                  </Card>
                )}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!pending) send(draft);
            }}
            className="flex items-end gap-2 border-border/60 border-t p-3"
          >
            <Textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Hablame o tocá el micrófono…"
              rows={1}
              maxLength={1500}
              disabled={pending}
              className="max-h-32 flex-1 resize-none"
              aria-label="Mensaje para Salu"
            />
            <SpeechToTextButton
              disabled={pending}
              onTranscript={(text) => {
                // Append al draft con un espacio. Si el usuario ya tenía
                // texto, no lo pisa.
                setDraft((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
                // Foco al textarea para que pueda corregir o tocar Enter.
                requestAnimationFrame(() => inputRef.current?.focus());
              }}
            />
            <Button
              type="submit"
              size="icon"
              disabled={pending || draft.trim().length === 0}
              aria-label="Enviar"
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Send className="size-4" aria-hidden />
              )}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}

function MessageBubble({ entry }: { entry: ChatEntry }) {
  const isUser = entry.role === 'user';
  if (!entry.content) return null;
  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <Card
        className={cn(
          'max-w-[85%] whitespace-pre-wrap px-3.5 py-2 text-sm leading-relaxed',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground',
        )}
      >
        {entry.content}
      </Card>
    </div>
  );
}
