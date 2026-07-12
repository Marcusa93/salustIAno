import { Card } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';
import { Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import { ChatThread } from './_components/chat-thread';
import { loadChatHistoryAction, loadChatHistoryMetaAction } from './actions';

export const metadata: Metadata = {
  title: 'SalustIA',
};

export default async function ChatPage() {
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
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6 sm:py-14">
      <header className="animate-stagger-up flex items-start gap-4">
        <div className="relative flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/10">
          <Sparkles className="size-6 animate-breathe" aria-hidden />
          {/* Chispitas orbitando */}
          <span
            aria-hidden
            className="absolute inset-0 origin-center"
            style={{ animation: 'salu-orbit 9s linear infinite' }}
          >
            <span className="absolute top-0 left-1/2 size-1 -translate-x-1/2 -translate-y-1 rounded-full bg-primary/60" />
          </span>
          <span
            aria-hidden
            className="absolute inset-0 origin-center"
            style={{ animation: 'salu-orbit 7s linear infinite reverse', animationDelay: '-2s' }}
          >
            <span className="absolute top-1/2 left-0 size-1 -translate-x-1 -translate-y-1/2 rounded-full bg-accent-foreground/40" />
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-medium text-muted-foreground/80 text-[11px] uppercase tracking-[0.22em]">
            Asistente
          </span>
          <h1 className="font-display text-[clamp(2rem,5vw,3rem)] text-foreground leading-[1.05] tracking-tight">
            SalustIA
          </h1>
          <p className="text-muted-foreground">
            La asistente de la familia. Pregúntale lo que quieras saber del día a día.
          </p>
        </div>
      </header>

      <Card className="flex flex-col gap-3 border-dashed bg-muted/30 p-4">
        <p className="text-muted-foreground text-xs">
          SalustIA recuerda la conversación entre visitas. No da diagnósticos ni indica medicación:
          si algo te preocupa, hablalo con la pediatra.
        </p>
      </Card>

      {historyMeta &&
        historyMeta.count > 0 &&
        (() => {
          const diffDays = Math.floor(
            (Date.now() - new Date(historyMeta.oldestAt).getTime()) / (1000 * 60 * 60 * 24),
          );
          const exchanges = Math.floor(historyMeta.count / 2);
          const timeLabel =
            diffDays === 0 ? 'hoy' : diffDays === 1 ? 'ayer' : `hace ${diffDays} días`;
          return (
            <p className="text-muted-foreground/60 text-xs">
              {timeLabel} ·{' '}
              {exchanges > 0
                ? `${exchanges} intercambio${exchanges !== 1 ? 's' : ''} anterior${exchanges !== 1 ? 'es' : ''}`
                : 'conversación retomada'}
            </p>
          );
        })()}

      <ChatThread childName={child?.name ?? null} initialHistory={history} />
    </div>
  );
}
