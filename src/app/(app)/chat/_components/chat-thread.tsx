'use client';

import { SaluBotAvatar } from '@/components/salu/salu-bot-avatar';
import { SpeakButton } from '@/components/salu/speak-button';
import { SpeechToTextButton } from '@/components/salu/speech-to-text-button';
import type { Proposal } from '@/lib/ai/agents/salustia/proposals';
import { cn } from '@/lib/utils';
import { ArrowUp, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import {
  type ChangeEvent,
  type KeyboardEvent,
  useEffect,
  useLayoutEffect,
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
import { ProposalGroup } from './proposal-group';

/** Atajos: el chip muestra algo corto y manda la frase completa. */
const SUGGESTIONS: { group: string; items: { label: string; message: string }[] }[] = [
  {
    group: 'Anotar',
    items: [
      { label: 'Tomó 120 ml recién', message: 'Anotá una mamadera de 120 ml recién' },
      { label: 'Pañal con pis', message: 'Anotá un pañal con pis recién' },
      { label: 'Se durmió hace 10 min', message: 'Anotá que se durmió hace 10 minutos' },
    ],
  },
  {
    group: 'Preguntar',
    items: [
      { label: '¿Cómo va el día?', message: '¿Cómo va el día?' },
      { label: '¿Cuánto tomó hoy?', message: '¿Cuánto tomó hoy?' },
      { label: '¿Próximo control?', message: '¿Cuándo es el próximo control?' },
    ],
  },
];

const COMPOSER_MAX_HEIGHT_PX = 160;

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
  /** "Retomada de hace 3 días · 12 intercambios", o null si no hay historia. */
  historyLabel?: string | null;
  /** Pregunta precargada en el campo (llega como `?q=`); no se manda sola. */
  initialDraft?: string;
}

/**
 * Chat con SalustIA, con forma de app de mensajes: la conversación usa el
 * scroll de la página y el compositor queda pegado abajo, arriba de la
 * barra de navegación. El micrófono es el botón principal hasta que hay
 * texto; ahí aparece "Enviar".
 */
export function ChatThread({
  childName,
  initialHistory = [],
  historyLabel,
  initialDraft,
}: ChatThreadProps) {
  const [entries, setEntries] = useState<ChatEntry[]>(() =>
    initialHistory.map((m) =>
      m.role === 'assistant'
        ? { role: 'assistant', content: m.content, proposals: [] }
        : { role: 'user', content: m.content },
    ),
  );
  const [draft, setDraft] = useState(initialDraft ?? '');
  const [pending, startTransition] = useTransition();
  const [clearing, startClearTransition] = useTransition();
  const [uploadingPhoto, startUploadPhoto] = useTransition();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const firstScroll = useRef(true);

  // Al abrir, saltamos al último mensaje; después, scroll suave a cada nuevo.
  // biome-ignore lint/correctness/useExhaustiveDependencies: dispara al llegar mensajes o el "escribiendo".
  useEffect(() => {
    endRef.current?.scrollIntoView({
      behavior: firstScroll.current ? 'auto' : 'smooth',
      block: 'end',
    });
    firstScroll.current = false;
  }, [entries.length, pending]);

  // El textarea crece con el texto hasta un tope (y vuelve a una línea al enviar).
  // biome-ignore lint/correctness/useExhaustiveDependencies: reacciona a cada cambio de draft.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, COMPOSER_MAX_HEIGHT_PX)}px`;
  }, [draft]);

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
      { role: 'user', content: 'Subiendo foto…', photoUrl: localPreview },
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
            ? { ...e, content: 'Foto subida al álbum', photoUrl: result.photoUrl }
            : e,
        );
        return [...next, { role: 'assistant', content: result.assistantReply, proposals: [] }];
      });
      URL.revokeObjectURL(localPreview);
    });
  }

  function send(text: string) {
    const value = text.trim();
    if (!value || pending) return;

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
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (reduced) {
        setEntries((prev) => [
          ...prev,
          { role: 'assistant', content: result.reply, proposals: result.proposals },
        ]);
        return;
      }

      // Tipeo progresivo: la respuesta aparece palabra por palabra.
      setEntries((prev) => [...prev, { role: 'assistant', content: '', proposals: [] }]);
      const words = result.reply.split(/(\s+)/);
      let acc = '';
      for (const w of words) {
        acc += w;
        const content = acc;
        setEntries((prev) => replaceLastAssistant(prev, content, []));
        const base = 18 + Math.min(32, w.length * 3);
        const punctPause = /[.,;!?…]\s*$/.test(w) ? 90 : 0;
        await new Promise((r) => setTimeout(r, base + punctPause));
      }
      // Al final, sumamos las proposals (estaban ocultas durante el tipeo).
      setEntries((prev) => replaceLastAssistant(prev, result.reply, result.proposals));
    });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // En el celular, Enter hace salto de línea; en compu con teclado, envía.
    if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(pointer: fine)').matches) {
      e.preventDefault();
      send(draft);
    }
  }

  const hasText = draft.trim().length > 0;

  return (
    <div className="flex min-h-[calc(100dvh-9.5rem)] flex-col md:min-h-[calc(100dvh-6rem)]">
      <header className="flex items-center gap-3 pb-4">
        <SaluBotAvatar size={44} className="shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="font-display text-2xl text-foreground leading-tight tracking-tight">
            SalustIA
          </h1>
          <p className="truncate text-muted-foreground text-xs">
            {historyLabel ??
              (childName
                ? `Conoce el día de ${childName.split(' ')[0]}`
                : 'La asistente de la familia')}
          </p>
        </div>
        {entries.length > 0 && (
          <button
            type="button"
            onClick={clearHistory}
            disabled={clearing || pending}
            aria-label="Borrar la conversación"
            className="grid size-10 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            {clearing ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Trash2 className="size-4" aria-hidden />
            )}
          </button>
        )}
      </header>

      <div className="flex flex-1 flex-col gap-4 pb-6" aria-live="polite">
        {entries.length === 0 && (
          <EmptyState childName={childName} onPick={(message) => send(message)} />
        )}

        {entries.map((entry, i) => {
          const previous = entries[i - 1];
          const startsRun = !previous || previous.role !== entry.role;
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: los mensajes solo se agregan al final; el índice es estable.
            <div key={i} className="flex flex-col gap-2">
              {entry.role === 'user' ? (
                <UserBubble entry={entry} />
              ) : (
                <AssistantBubble content={entry.content} showAvatar={startsRun} />
              )}
              {entry.role === 'assistant' && entry.proposals.length > 0 && (
                <div className="pl-10">
                  <ProposalGroup proposals={entry.proposals} />
                </div>
              )}
            </div>
          );
        })}

        {pending && lastIsUser(entries) && <TypingBubble />}
        <div ref={endRef} />
      </div>

      <p className="pb-2 text-center text-[11px] text-muted-foreground/70">
        SalustIA no da diagnósticos ni indica medicación. Si algo te preocupa, consultá a la
        pediatra.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
        className="sticky bottom-[calc(env(safe-area-inset-bottom)+4rem)] z-30 flex items-end gap-1.5 rounded-[1.75rem] bg-card/95 p-1.5 shadow-[0_18px_40px_-20px_var(--elevation)] ring-1 ring-foreground/[0.08] backdrop-blur-xl md:bottom-6"
      >
        <button
          type="button"
          aria-label="Subir una foto al álbum"
          disabled={pending || uploadingPhoto}
          onClick={() => photoInputRef.current?.click()}
          className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          {uploadingPhoto ? (
            <Loader2 className="size-5 animate-spin" aria-hidden />
          ) : (
            <ImagePlus className="size-5" aria-hidden />
          )}
        </button>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          className="hidden"
          onChange={handlePhotoFile}
        />
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribile o hablale a SalustIA…"
          rows={1}
          maxLength={2000}
          disabled={pending}
          aria-label="Mensaje para SalustIA"
          className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-1 py-2.5 text-[15px] text-foreground leading-6 outline-none placeholder:text-muted-foreground/70"
        />
        {hasText ? (
          <button
            type="submit"
            disabled={pending}
            aria-label="Enviar"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform active:scale-90 disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : (
              <ArrowUp className="size-5" aria-hidden />
            )}
          </button>
        ) : (
          <SpeechToTextButton
            disabled={pending}
            className="size-11 shrink-0 rounded-full"
            onTranscript={(text) => {
              setDraft((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
              requestAnimationFrame(() => inputRef.current?.focus());
            }}
          />
        )}
      </form>
    </div>
  );
}

function replaceLastAssistant(
  entries: ChatEntry[],
  content: string,
  proposals: Proposal[],
): ChatEntry[] {
  const next = [...entries];
  const last = next[next.length - 1];
  if (last && last.role === 'assistant') {
    next[next.length - 1] = { role: 'assistant', content, proposals };
  }
  return next;
}

function lastIsUser(entries: ChatEntry[]): boolean {
  const last = entries[entries.length - 1];
  return !!last && last.role === 'user';
}

function EmptyState({
  childName,
  onPick,
}: {
  childName: string | null;
  onPick: (message: string) => void;
}) {
  const name = childName?.split(' ')[0];
  return (
    <motion.div
      className="flex flex-col gap-5"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <AssistantBubble
        showAvatar
        content={`¡Hola! Soy SalustIA${name ? ` y estoy con todo lo de ${name}` : ''}. Contame qué pasó y lo anoto (siempre te pido confirmación antes de guardar), o preguntame cómo viene el día.`}
      />
      <div className="flex flex-col gap-4 pl-10">
        {SUGGESTIONS.map(({ group, items }) => (
          <div key={group} className="flex flex-col gap-2">
            <span className="font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.22em]">
              {group}
            </span>
            <div className="flex flex-wrap gap-2">
              {items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => onPick(item.message)}
                  className="rounded-full bg-card px-3.5 py-2 text-foreground text-sm ring-1 ring-foreground/[0.08] transition-colors hover:bg-muted active:scale-95"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function AssistantBubble({ content, showAvatar }: { content: string; showAvatar: boolean }) {
  if (!content) return null;
  return (
    <motion.div
      className="flex items-end gap-2"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <span className="w-8 shrink-0">{showAvatar && <SaluBotAvatar size={32} />}</span>
      <div className="flex max-w-[85%] flex-col items-start gap-1">
        <div className="whitespace-pre-wrap rounded-3xl rounded-bl-md bg-card px-4 py-3 text-[15px] text-foreground leading-relaxed shadow-[0_6px_18px_-14px_var(--elevation)] ring-1 ring-foreground/[0.06]">
          {content}
        </div>
        <SpeakButton text={content} className="ml-1" />
      </div>
    </motion.div>
  );
}

function UserBubble({ entry }: { entry: Extract<ChatEntry, { role: 'user' }> }) {
  return (
    <motion.div
      className="flex justify-end"
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2 }}
    >
      <div
        className={cn(
          'flex max-w-[85%] flex-col gap-1.5 overflow-hidden rounded-3xl rounded-br-md bg-primary text-[15px] text-primary-foreground leading-relaxed',
          entry.photoUrl ? 'p-1.5' : 'px-4 py-3',
        )}
      >
        {entry.photoUrl && (
          <img
            src={entry.photoUrl}
            alt="Foto subida al álbum"
            className="max-h-72 w-full rounded-[1.25rem] object-cover"
          />
        )}
        <span className={cn('whitespace-pre-wrap', entry.photoUrl && 'px-2.5 pb-1 text-xs')}>
          {entry.content}
        </span>
      </div>
    </motion.div>
  );
}

function TypingBubble() {
  return (
    <div className="flex items-end gap-2">
      <span className="w-8 shrink-0">
        <SaluBotAvatar size={32} />
      </span>
      <div className="flex items-center gap-1 rounded-3xl rounded-bl-md bg-card px-4 py-3.5 ring-1 ring-foreground/[0.06]">
        {[0, 0.15, 0.3].map((delay) => (
          <span
            key={delay}
            className="size-1.5 animate-typing-dot rounded-full bg-muted-foreground"
            style={{ animationDelay: `${delay}s` }}
          />
        ))}
        <span className="sr-only">SalustIA está pensando…</span>
      </div>
    </div>
  );
}
