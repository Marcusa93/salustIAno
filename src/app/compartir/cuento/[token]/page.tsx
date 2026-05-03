import { Card } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Un cuento para Salu',
  robots: 'noindex, nofollow',
};

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function CompartirCuentoPage({ params }: PageProps) {
  const { token } = await params;
  if (!token || token.length < 16) notFound();

  const supabase = await createClient();
  // biome-ignore lint/suspicious/noExplicitAny: types stale.
  const sb = supabase as any;
  const { data, error } = await sb
    .from('stories')
    .select('id, title, story, moral_or_theme, characters_used')
    .eq('share_token', token)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !data) notFound();

  const characters = (data.characters_used as string[]) ?? [];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
      <header className="flex flex-col gap-2">
        <span className="font-medium text-muted-foreground/80 text-[11px] uppercase tracking-[0.22em]">
          Salu · Un cuento
        </span>
        <h1 className="font-display text-[clamp(2rem,5vw,3rem)] text-foreground leading-[1.05] tracking-tight">
          {data.title as string}
        </h1>
        {characters.length > 0 && (
          <p className="text-muted-foreground text-sm">
            Con {characters.slice(0, 4).join(', ')}
            {characters.length > 4 ? '…' : ''}
          </p>
        )}
      </header>

      <Card className="flex flex-col gap-5 border-primary/15 bg-gradient-to-br from-primary/[0.04] via-card to-accent/20 p-7 font-display text-foreground leading-[1.85] sm:p-10">
        <div className="whitespace-pre-line">{data.story as string}</div>
        {data.moral_or_theme && (
          <p className="border-primary/15 border-t pt-4 text-muted-foreground text-sm italic leading-relaxed">
            {data.moral_or_theme as string}
          </p>
        )}
      </Card>

      <p className="text-center text-muted-foreground text-xs">
        Hecho con cariño en Salu — sistema operativo familiar.
      </p>
    </main>
  );
}
