'use client';

import { ProposalCard } from '@/app/(app)/chat/_components/proposal-card';
import {
  type ChatHistoryEntry,
  clearChatHistoryAction,
  loadChatHistoryAction,
  sendPhotoToChatAction,
} from '@/app/(app)/chat/actions';
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
import { ImageIcon, Loader2, Send, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import {
  type ChangeEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
  useTransition,
} from 'react';
import { toast } from 'sonner';
import { type ClientMessage, sendBabyMessageAction } from './actions';

type ChatEntry =
  | { role: 'user'; content: string; photoUrl?: string }
  | { role: 'assistant'; content: string; proposals: Proposal[] };

const SUGGESTIONS = [
  'Acabo de tomar teta del lado izquierdo, 15 minutos',
  'Hice pis hace 5 minutos',
  'Me dormí hace media hora — siesta',
  '¿Cómo viene mi día?',
  '¿Cuándo es mi próximo control?',
];

function historyToEntries(history: ChatHistoryEntry[]): ChatEntry[] {
  // Las proposals son transitorias y no se persisten — al rehidratar
  // queda la card de mensaje sin botones, igual que en /chat.
  return history.map((m) =>
    m.role === 'assistant'
      ? { role: 'assistant', content: m.content, proposals: [] }
      : { role: 'user', content: m.content },
  );
}

/**
 * Botón flotante esquina inferior derecha que abre un Sheet con un chat
 * en primera persona ("hablo yo, Salu"). Comparte la timeline con `/chat`:
 * los mensajes que mandás desde acá quedan en la misma conversación que
 * ves en la página completa, y al abrir el sheet se rehidrata el
 * historial reciente.
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
  const [hydrating, setHydrating] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [clearing, startClearTransition] = useTransition();
  const [uploadingPhoto, startUploadPhoto] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Hidratación: la primera vez que el user abre el sheet, traemos los
  // últimos N mensajes de chat_messages (mismos que ve /chat). Si vuelve
  // a abrir más tarde sin recargar la página, no rehidratamos para no
  // pisar mensajes nuevos que mandó desde acá.
  useEffect(() => {
    if (!open || hydrated || hydrating) return;
    setHydrating(true);
    void loadChatHistoryAction()
      .then((history) => {
        setEntries(historyToEntries(history));
      })
      .catch(() => {
        // Best effort: si falla la hidratación, arrancamos vacío. No es
        // un error bloqueante — el chat sigue andando.
      })
      .finally(() => {
        setHydrating(false);
        setHydrated(true);
      });
  }, [open, hydrated, hydrating]);

  // Auto-scroll al fondo cuando llega un mensaje nuevo o cuando termina
  // la hidratación (queremos arrancar viendo lo más reciente).
  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [open, entries.length, hydrating]);

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

  function handlePickPhoto() {
    photoInputRef.current?.click();
  }

  function handlePhotoFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (event.target) event.target.value = '';
    if (!file) return;

    const localPreview = URL.createObjectURL(file);
    setEntries((prev) => [
      ...prev,
      { role: 'user', content: '📷 Subiendo foto…', photoUrl: localPreview },
    ]);

    const formData = new FormData();
    formData.append('photo', file);

    startUploadPhoto(async () => {
      const result = await sendPhotoToChatAction(formData);
      if (!result.ok) {
        toast.error(result.error);
        setEntries((prev) =>
          prev.filter((e) => !(e.role === 'user' && e.photoUrl === localPreview)),
        );
        URL.revokeObjectURL(localPreview);
        return;
      }
      setEntries((prev) => {
        const next = prev.map((e) =>
          e.role === 'user' && e.photoUrl === localPreview
            ? { ...e, content: '📷 Foto subida', photoUrl: result.photoUrl }
            : e,
        );
        return [...next, { role: 'assistant', content: result.assistantReply, proposals: [] }];
      });
      URL.revokeObjectURL(localPreview);
    });
  }

  function clearChat() {
    if (!window.confirm('¿Borrar la conversación con SaluIA? Se borra también de /chat.')) return;
    startClearTransition(async () => {
      const result = await clearChatHistoryAction();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setEntries([]);
      setDraft('');
    });
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
          'fixed right-4 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-1 ring-primary/20 transition-all duration-300',
          'bottom-[calc(env(safe-area-inset-bottom)+76px)] md:bottom-4',
          'hover:-translate-y-0.5 hover:shadow-xl active:scale-95',
          'focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2',
          'animate-breathe print:hidden',
          // Cuando el sheet está abierto, escondemos el botón con scale
          // + opacity. Al cerrar, vuelve con un fade-in suave de 300ms en
          // lugar de aparecer instantáneo.
          open ? 'pointer-events-none scale-50 opacity-0' : 'scale-100 opacity-100',
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
          className={cn(
            // Mobile: full-screen para que SaluIA tenga el espacio que merece
            // y la conversación sea cómoda con el teclado abierto.
            'flex w-full flex-col gap-0 overflow-hidden p-0',
            'h-[100dvh] max-h-none',
            // Desktop: panel lateral derecho de tamaño cómodo.
            'sm:h-full sm:max-w-md',
          )}
        >
          <SheetHeader
            className={cn(
              'flex-row items-center gap-3 border-border/60 border-b p-3 sm:items-start sm:p-4',
              // Mobile: respetar safe-area-inset-top para iPhone notch.
              'pt-[max(0.75rem,env(safe-area-inset-top))]',
            )}
          >
            <span
              aria-hidden
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20"
            >
              <SaluBotAvatar size={32} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <SheetTitle className="text-base">SaluIA</SheetTitle>
              {/* Descripción solo en sm+ — en mobile el header se mantiene
                  compacto y la conversación tiene más altura visible. */}
              <SheetDescription className="hidden text-xs sm:block">
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
                disabled={pending || clearing}
                className="shrink-0 text-muted-foreground"
              >
                {clearing ? 'Limpiando…' : 'Limpiar'}
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
              className="shrink-0 sm:size-8"
            >
              <X className="size-5 sm:size-4" aria-hidden />
            </Button>
          </SheetHeader>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4" aria-live="polite">
            {hydrating && entries.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Loader2 className="size-5 animate-spin" aria-hidden />
                  <span className="text-xs">Levantando la conversación…</span>
                </div>
              </div>
            ) : entries.length === 0 ? (
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
            className={cn(
              'flex items-end gap-2 border-border/60 border-t p-3',
              // Safe-area en mobile para iPhone con home indicator.
              'pb-[max(0.75rem,env(safe-area-inset-bottom))]',
              'sm:pb-3',
            )}
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
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label="Subir foto al álbum"
              disabled={pending || uploadingPhoto}
              onClick={handlePickPhoto}
            >
              {uploadingPhoto ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <ImageIcon className="size-4" aria-hidden />
              )}
            </Button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              className="hidden"
              onChange={handlePhotoFile}
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
  const photoUrl = entry.role === 'user' ? entry.photoUrl : null;
  if (!entry.content && !photoUrl) return null;
  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <Card
        className={cn(
          'flex max-w-[85%] flex-col gap-2 overflow-hidden text-sm leading-relaxed',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground',
          photoUrl ? 'p-1.5' : 'whitespace-pre-wrap px-3.5 py-2',
        )}
      >
        {photoUrl && (
          <img
            src={photoUrl}
            alt="Foto subida al álbum"
            className="max-h-72 w-full rounded-md object-cover"
          />
        )}
        {entry.content && (
          <span
            className={cn(
              'whitespace-pre-wrap',
              photoUrl ? 'px-2 pb-1.5 text-xs leading-snug' : '',
            )}
          >
            {entry.content}
          </span>
        )}
      </Card>
    </div>
  );
}
