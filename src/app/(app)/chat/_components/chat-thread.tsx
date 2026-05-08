'use client';

import { SpeakButton } from '@/components/salu/speak-button';
import { SpeechToTextButton } from '@/components/salu/speech-to-text-button';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import type { Proposal } from '@/lib/ai/agents/salustia/proposals';
import { cn } from '@/lib/utils';
import { ImageIcon, Loader2, Send, Sparkles, Trash2 } from 'lucide-react';
import {
  type ChangeEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
  useTransition,
} from 'react';
import { toast } from 'sonner';
import {
  type ChatHistoryEntry,
  type ClientMessage,
  clearChatHistoryAction,
  sendMessageAction,
  sendPhotoToChatAction,
} from '../actions';
import { ProposalCard } from './proposal-card';

const SUGGESTIONS = [
  'Anotá una toma de pecho izquierdo, 15 minutos, hace una hora',
  'Anotá un pañal mojado hace 10 minutos',
  'Anotá una siesta que empezó hace 30 minutos',
  '¿Cómo va el día?',
  'Mostrame las últimas tomas',
  '¿Cuándo es el próximo control?',
];

/**
 * Estado local del chat — más rico que ClientMessage porque guarda
 * proposals adjuntas a los mensajes del assistant para renderizar las
 * cards de confirmación. Cuando mandamos al server convertimos a
 * ClientMessage[] (que solo tiene role + content).
 */
type ChatEntry =
  | { role: 'user'; content: string; photoUrl?: string }
  | { role: 'assistant'; content: string; proposals: Proposal[] };

interface ChatThreadProps {
  childName: string | null;
  /**
   * Mensajes persistidos del usuario, hidratados server-side. Sin
   * proposals (solo role + content) — las proposals son transitorias.
   */
  initialHistory?: ChatHistoryEntry[];
}

export function ChatThread({ childName, initialHistory = [] }: ChatThreadProps) {
  const [entries, setEntries] = useState<ChatEntry[]>(() =>
    initialHistory.map((m) =>
      m.role === 'assistant'
        ? { role: 'assistant', content: m.content, proposals: [] }
        : { role: 'user', content: m.content },
    ),
  );
  const [draft, setDraft] = useState('');
  const [pending, startTransition] = useTransition();
  const [clearing, startClearTransition] = useTransition();
  const [uploadingPhoto, startUploadPhoto] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  function clearHistory() {
    if (!window.confirm('¿Borrar la conversación con SalustIA? No se puede deshacer.')) return;
    startClearTransition(async () => {
      const result = await clearChatHistoryAction();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setEntries([]);
      toast.success('Conversación limpia.');
    });
  }

  function handlePickPhoto() {
    photoInputRef.current?.click();
  }

  function handlePhotoFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Resetear el input para que el onChange dispare aunque elijan la
    // misma foto dos veces.
    if (event.target) event.target.value = '';
    if (!file) return;

    // Optimistic: insertar burbuja del user con la preview localmente.
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
        // Quitar la burbuja optimista que dejó el rolling en estado raro.
        setEntries((prev) =>
          prev.filter((e) => !(e.role === 'user' && e.photoUrl === localPreview)),
        );
        URL.revokeObjectURL(localPreview);
        return;
      }
      // Reemplazar la burbuja optimista con la "real" (signed URL del
      // server) y agregar la respuesta del assistant.
      setEntries((prev) => {
        const next = prev.map((e) =>
          e.role === 'user' && e.photoUrl === localPreview
            ? {
                ...e,
                content: '📷 Foto subida',
                photoUrl: result.photoUrl,
              }
            : e,
        );
        return [...next, { role: 'assistant', content: result.assistantReply, proposals: [] }];
      });
      URL.revokeObjectURL(localPreview);
    });
  }

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
      // Typing animation: agregamos la reply gradualmente, palabra por
      // palabra, en lugar de poner todo el texto de golpe. Da sensación
      // de stream sin tocar el server.
      const reduced =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (reduced) {
        setEntries((prev) => [
          ...prev,
          { role: 'assistant', content: result.reply, proposals: result.proposals },
        ]);
        requestAnimationFrame(() => inputRef.current?.focus());
        return;
      }

      // Insertamos un mensaje vacío y vamos llenando.
      setEntries((prev) => [...prev, { role: 'assistant', content: '', proposals: [] }]);

      const words = result.reply.split(/(\s+)/); // mantiene espacios
      let acc = '';
      for (const w of words) {
        acc += w;
        setEntries((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === 'assistant') {
            next[next.length - 1] = {
              role: 'assistant',
              content: acc,
              proposals: [],
            };
          }
          return next;
        });
        // Pausa entre palabras: ~25ms para palabras cortas, +5ms por
        // cada char extra. Pausas mayores tras "." y "," (respiro).
        const base = 22 + Math.min(40, w.length * 4);
        const punctPause = /[.,;!?…]\s*$/.test(w) ? 110 : 0;
        await new Promise((r) => setTimeout(r, base + punctPause));
      }

      // Al final, sumamos las proposals (estaban ocultas durante el typing).
      setEntries((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === 'assistant') {
          next[next.length - 1] = {
            role: 'assistant',
            content: result.reply,
            proposals: result.proposals,
          };
        }
        return next;
      });

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
      {entries.length > 0 && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={clearHistory}
            disabled={clearing || pending}
          >
            {clearing ? (
              <Loader2 className="size-3 animate-spin" aria-hidden />
            ) : (
              <Trash2 className="size-3" aria-hidden />
            )}
            Limpiar conversación
          </Button>
        </div>
      )}

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
            {e.role === 'assistant' && e.content.length > 0 && (
              <div className="-mt-1 flex items-center justify-start pl-1">
                <SpeakButton text={e.content} />
              </div>
            )}
            {e.role === 'assistant' &&
              e.proposals.map((p, j) => <ProposalCard key={`${i}-${j}-${p.kind}`} proposal={p} />)}
          </div>
        ))}

        {pending && lastIsUser(entries) && (
          <Card className="flex w-fit max-w-[75%] items-center gap-2.5 self-start bg-muted/40 px-4 py-3">
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
            <span className="sr-only">SalustIA está pensando…</span>
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
          placeholder="Preguntale algo a SalustIA o tocá el micrófono…"
          rows={2}
          maxLength={2000}
          disabled={pending}
          className="flex-1 resize-none"
          aria-label="Mensaje para SalustIA"
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
            setDraft((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
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

function lastIsUser(entries: ChatEntry[]): boolean {
  const last = entries[entries.length - 1];
  return !!last && last.role === 'user';
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
          photoUrl ? 'p-1.5' : 'whitespace-pre-wrap px-4 py-2.5',
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
              photoUrl ? 'px-2.5 pb-1.5 text-xs leading-snug' : '',
            )}
          >
            {entry.content}
          </span>
        )}
      </Card>
    </div>
  );
}
