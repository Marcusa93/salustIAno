import { createClient } from '@/lib/supabase/server';
import type { Metadata } from 'next';
import { ChatThread } from './_components/chat-thread';
import { loadChatHistoryAction, loadChatHistoryMetaAction } from './actions';

export const metadata: Metadata = {
  title: 'SalustIA',
};

interface Props {
  /** `?q=` precarga una pregunta en el campo (ej. desde Comidas), sin mandarla. */
  searchParams: Promise<{ q?: string }>;
}

export default async function ChatPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const supabase = await createClient();
  const [{ data: child }, history, historyMeta] = await Promise.all([
    supabase
      .from('child_profiles')
      .select('name')
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    loadChatHistoryAction(),
    loadChatHistoryMetaAction(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col px-4 sm:px-6">
      <ChatThread
        childName={child?.name ?? null}
        initialHistory={history}
        historyLabel={historyLabelFor(historyMeta)}
        initialDraft={typeof q === 'string' ? q.slice(0, 500) : undefined}
      />
    </div>
  );
}

/** "Retomada de hace 3 días · 12 intercambios", o null si es una charla nueva. */
function historyLabelFor(meta: { count: number; oldestAt: string } | null): string | null {
  if (!meta || meta.count === 0) return null;
  const days = Math.floor((Date.now() - new Date(meta.oldestAt).getTime()) / 86_400_000);
  const since = days === 0 ? 'de hoy' : days === 1 ? 'de ayer' : `de hace ${days} días`;
  const exchanges = Math.floor(meta.count / 2);
  return exchanges > 0
    ? `Retomada ${since} · ${exchanges} ${exchanges === 1 ? 'intercambio' : 'intercambios'}`
    : `Retomada ${since}`;
}
