import { Card } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SharedLullabyPlayer } from './player';

export const metadata: Metadata = {
  title: 'Una canción para Salu',
  robots: 'noindex, nofollow',
};

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function CompartirCancionPage({ params }: PageProps) {
  const { token } = await params;
  if (!token || token.length < 16) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('lullabies')
    .select('id, title, intro, verses, chorus, closing, mood, audio_path')
    .eq('share_token', token)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !data) notFound();

  let audioUrl: string | null = null;
  if (data.audio_path) {
    const { data: signed } = await supabase.storage
      .from('lullabies')
      .createSignedUrl(data.audio_path as string, 3600);
    audioUrl = signed?.signedUrl ?? null;
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10 sm:px-6 sm:py-14">
      <header className="flex flex-col gap-2">
        <span className="font-medium text-muted-foreground/80 text-[11px] uppercase tracking-[0.22em]">
          Salu · Una canción
        </span>
        <h1 className="font-display text-[clamp(2rem,5vw,3rem)] text-foreground leading-[1.05] tracking-tight">
          {data.title}
        </h1>
        <p className="text-muted-foreground italic">{data.intro}</p>
      </header>

      <SharedLullabyPlayer audioUrl={audioUrl} />

      <Card className="flex flex-col gap-5 border-primary/15 bg-gradient-to-br from-primary/[0.04] via-card to-accent/20 p-6 font-display text-foreground text-lg leading-[1.85] sm:p-8">
        {(data.verses as string[]).map((v, i) => (
          <div key={`v-${i}-${v.slice(0, 10)}`} className="whitespace-pre-line">
            {v}
          </div>
        ))}
        {data.chorus && (
          <div className="border-primary/20 border-l-2 pl-4">
            <span className="mb-1 block font-medium font-sans text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
              Estribillo
            </span>
            <div className="whitespace-pre-line text-primary/90">{data.chorus as string}</div>
          </div>
        )}
        {data.closing && (
          <div className="whitespace-pre-line text-muted-foreground">{data.closing as string}</div>
        )}
      </Card>

      <p className="text-center text-muted-foreground text-xs">
        Hecha con cariño en Salu — sistema operativo familiar.
      </p>
    </main>
  );
}
