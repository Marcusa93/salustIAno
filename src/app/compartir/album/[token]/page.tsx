import { SaluLogo } from '@/components/salu/salu-logo';
import { Card } from '@/components/ui/card';
import { env } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { ImageIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SharedAlbumGallery, type SharedPhoto } from './shared-album-gallery';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Un álbum de Salu',
  robots: 'noindex, nofollow',
};

interface PageProps {
  params: Promise<{ token: string }>;
}

function formatMonthYear(monthKey: string | null): string | null {
  if (!monthKey) return null;
  const d = new Date(`${monthKey}T12:00:00Z`);
  const raw = d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export default async function CompartirAlbumPage({ params }: PageProps) {
  const { token } = await params;
  if (!token || token.length < 16) notFound();

  const requestClient = await createClient();
  const supabase = env.SUPABASE_SECRET_KEY ? createAdminClient() : requestClient;
  const { data: album, error } = await supabase
    .from('albums')
    .select('id, name, kind, month_key, shared_at')
    .eq('share_token', token)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !album) notFound();

  const { data: photoRows } = await supabase
    .from('media_items')
    .select('id, storage_path, caption, taken_at')
    .eq('album_id', album.id)
    .is('deleted_at', null)
    .order('taken_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(200);

  const photos: SharedPhoto[] = await Promise.all(
    (photoRows ?? []).map(async (p) => {
      const path = p.storage_path;
      const { data: signed } = await supabase.storage
        .from('photos')
        .createSignedUrl(path, 60 * 60 * 24);
      return {
        id: p.id,
        signedUrl: signed?.signedUrl ?? null,
        caption: p.caption ?? null,
        takenAt: p.taken_at ?? null,
      };
    }),
  );

  const monthLabel = album.kind === 'monthly' ? formatMonthYear(album.month_key) : null;
  const photoCountLabel = `${photos.length} foto${photos.length === 1 ? '' : 's'}`;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
      <header className="flex flex-col items-start gap-5">
        <SaluLogo size="default" />
        <div className="flex flex-col gap-2">
          <span className="font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.22em]">
            Un álbum de la familia
          </span>
          <h1 className="font-display text-[clamp(2rem,5vw,3rem)] text-foreground leading-[1.05] tracking-tight">
            {album.name}
          </h1>
          <p className="text-muted-foreground text-sm">
            {photoCountLabel}
            {monthLabel ? ` · ${monthLabel}` : ''}.{' '}
            <span className="text-muted-foreground/70">Compartido con cuidado desde Salu.</span>
          </p>
        </div>
      </header>

      {photos.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/15">
            <ImageIcon className="size-6" aria-hidden />
          </div>
          <p className="max-w-sm text-muted-foreground text-sm leading-relaxed">
            Este álbum todavía no tiene fotos. Cuando la familia suba algo, va a aparecer acá.
          </p>
        </Card>
      ) : (
        <SharedAlbumGallery photos={photos} />
      )}

      <footer className="mt-4 border-border/40 border-t pt-5 text-center">
        <p className="text-muted-foreground/70 text-xs leading-relaxed">
          Salu es el sistema operativo familiar para acompañar la crianza de un bebé. Privado, sin
          publicidad, sin redes sociales.
        </p>
      </footer>
    </div>
  );
}
