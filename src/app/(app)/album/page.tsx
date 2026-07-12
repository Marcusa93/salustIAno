import { PageHeader } from '@/components/salu/page-header';
import type { Metadata } from 'next';
import { ensureMilestoneAlbumsAction, listAlbumsAction, listPhotosAction } from './actions';
import { AlbumGrid } from './album-grid';

export const metadata: Metadata = {
  title: 'Álbum',
};

export default async function AlbumPage() {
  await ensureMilestoneAlbumsAction();
  const [photos, albums] = await Promise.all([listPhotosAction(), listAlbumsAction()]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader
        eyebrow="Álbum"
        title="Las fotos de Salu, mes a mes."
        description="Subí varias a la vez. Se agrupan automáticamente por el mes en que las tomaste. Tocá una para describir, etiquetar o borrar."
      />

      <AlbumGrid initialPhotos={photos} initialAlbums={albums} />
    </div>
  );
}
