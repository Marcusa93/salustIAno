import type { Metadata } from 'next';
import { listPhotosAction } from './actions';
import { AlbumGrid } from './album-grid';

export const metadata: Metadata = {
  title: 'Álbum',
};

export default async function AlbumPage() {
  const photos = await listPhotosAction();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14">
      <header className="flex animate-stagger-up flex-col gap-2">
        <span className="font-medium text-[11px] text-muted-foreground/80 uppercase tracking-[0.22em]">
          Álbum
        </span>
        <h1 className="font-display text-[clamp(2.25rem,5vw,3.5rem)] text-foreground leading-[1.05] tracking-tight">
          Las fotos de Salu, mes a mes.
        </h1>
        <p className="max-w-prose text-muted-foreground">
          Subí varias a la vez. Se agrupan automáticamente por el mes en que las tomaste. Tocá una
          para describir, etiquetar o borrar.
        </p>
      </header>

      <AlbumGrid initialPhotos={photos} />
    </div>
  );
}
