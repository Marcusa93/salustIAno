import { Card } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';
import { Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import { ChatThread } from './_components/chat-thread';

export const metadata: Metadata = {
  title: 'SalustIA',
};

export default async function ChatPage() {
  const supabase = await createClient();
  const { data: child } = await supabase
    .from('child_profiles')
    .select('name')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex items-start gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="size-6" aria-hidden />
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-3xl text-foreground tracking-tight sm:text-4xl">
            SalustIA
          </h1>
          <p className="text-muted-foreground">
            La asistente de la familia. Pregúntale lo que quieras saber del día a día.
          </p>
        </div>
      </header>

      <Card className="flex flex-col gap-3 border-dashed bg-muted/30 p-4">
        <p className="text-muted-foreground text-xs">
          Esta versión solo consulta lo que ya cargaron. No anota tomas, sueños ni notas todavía —
          eso llega en la próxima entrega. SalustIA tampoco da diagnósticos ni indica medicación: si
          algo te preocupa, hablalo con la pediatra.
        </p>
      </Card>

      <ChatThread childName={child?.name ?? null} />
    </div>
  );
}
