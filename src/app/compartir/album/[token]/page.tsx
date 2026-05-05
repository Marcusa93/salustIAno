import { Card } from '@/components/ui/card';
import { env } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { ImageIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SharedAlbumPhoto } from './shared-album-photo';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Un álbum de Salu',
  robots: 'noindex, nofollow',
};

interface PageProps {
  params: Promise<{ token: string }>;
}

interface SharedPhoto {
  id: string;
  signedUrl: string | null;
  caption: string | null;
  takenAt: string | null;
}

export default async function CompartirAlbumPage({ params }: PageProps) {
  const { token } = await params;
  if (!token || token.length < 16) notFound();

  const requestClient = await createClient();
  const supabase = env.SUPABASE_SECRET_KEY ? createAdminClient() : requestClient;
  // biome-ignore lint/suspicious/noExplicitAny: types stale.
  const sb = supabase as any;
  const { data: album, error } = await sb
    .from('albums')
    .select('id, name, kind, month_key')
    .eq('share_token', token)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !album) notFound();

  const { data: photoRows } = await sb
    .from('media_items')
    .select('id, storage_path, caption, taken_at')
    .eq('album_id', album.id)
    .is('deleted_at', null)
    .order('taken_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(200);

  const photos: SharedPhoto[] = await Promise.all(
    ((photoRows as Array<Record<string, unknown>> | null) ?? []).map(async (p) => {
      const path = p.storage_path as string;
      const { data: signed } = await supabase.storage
        .from('photos')
        .createSignedUrl(path, 60 * 60 * 24);
      return {
        id: p.id as string,
        signedUrl: signed?.signedUrl ?? null,
        caption: (p.caption as string | null) ?? null,
        takenAt: (p.taken_at as string | null) ?? null,
      };
    }),
  );

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
      <header className="flex flex-col gap-2">
        <span className="font-medium text-[11px] text-muted-foreground/80 uppercase tracking-[0.22em]">
          Un álbum de la familia
        </span>
        <h1 className="font-display text-[clamp(2rem,5vw,3rem)] text-foreground leading-[1.05] tracking-tight">
          {album.name}
        </h1>
        <p className="text-muted-foreground text-sm">
          {photos.length} foto{photos.length === 1 ? '' : 's'}.{' '}
          <span className="text-muted-foreground/70">Compartido con cuidado desde Salu.</span>
        </p>
      </header>

      {photos.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <ImageIcon className="size-6" aria-hidden />
          </div>
          <p className="text-muted-foreground text-sm">Este álbum todavía no tiene fotos.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((p) => (
            <SharedAlbumPhoto key={p.id} photo={p} />
          ))}
        </div>
      )}
    </div>
  );
}
