import { LetterSelfie } from '@/app/carta/[slug]/_components/letter-selfie';
import { PhotoViewerProvider } from '@/app/carta/[slug]/_components/photo-viewer';
import type { LetterPhoto } from '@/lib/carta/manifest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const saveLetterPhotoAction = vi.hoisted(() => vi.fn());
vi.mock('@/app/carta/[slug]/actions', () => ({ saveLetterPhotoAction }));
vi.mock('@/lib/carta/shrink-photo', () => ({
  shrinkPhoto: async (file: Blob) => ({ blob: file, width: 1200, height: 1600 }),
}));

const COPY = {
  prompt: 'Faltaba una foto: la de hoy.',
  button: 'Sacarnos una foto',
  caption: 'Mamá y yo, el día de esta carta.',
  saved: 'La guardé en el álbum, para siempre.',
};

beforeAll(() => {
  globalThis.IntersectionObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
  URL.createObjectURL = vi.fn(() => 'blob:foto-de-hoy');
  URL.revokeObjectURL = vi.fn();
});

function renderSelfie(memories: LetterPhoto[] = []) {
  return render(
    <PhotoViewerProvider photos={memories} birthAt="2026-05-04T14:32:00-03:00">
      <LetterSelfie slug="mama-2026" copy={COPY} memories={memories} />
    </PhotoViewerProvider>,
  );
}

const photoFile = () => new File(['jpg'], 'IMG_0001.jpg', { type: 'image/jpeg' });

describe('LetterSelfie', () => {
  beforeEach(() => {
    saveLetterPhotoAction.mockReset();
  });

  it('abre la cámara frontal y, al sacar la foto, la muestra y la guarda en el álbum', async () => {
    saveLetterPhotoAction.mockResolvedValue({ ok: true, photo: {} });
    renderSelfie();

    const input = screen.getByLabelText('Sacarnos una foto');
    expect(input).toHaveAttribute('capture', 'user');
    await userEvent.upload(input, photoFile());

    expect(await screen.findByText(COPY.saved)).toBeInTheDocument();
    expect(screen.getByText(COPY.caption)).toBeInTheDocument();
    expect(saveLetterPhotoAction).toHaveBeenCalledWith('mama-2026', expect.any(FormData));
    const formData = saveLetterPhotoAction.mock.calls[0]?.[1] as FormData;
    expect(formData.get('caption')).toBe(COPY.caption);
    expect(formData.get('width')).toBe('1200');
    expect(screen.getByLabelText('Sacar otra')).toBeInTheDocument();
  });

  it('si no se pudo guardar, avisa y deja reintentar sin volver a sacarla', async () => {
    saveLetterPhotoAction
      .mockResolvedValueOnce({ ok: false, error: 'No pudimos guardar la foto. Probá de nuevo.' })
      .mockResolvedValueOnce({ ok: true, photo: {} });
    renderSelfie();

    await userEvent.upload(screen.getByLabelText('Sacarnos una foto'), photoFile());
    expect(await screen.findByText(/No pudimos guardar la foto/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText(COPY.saved)).toBeInTheDocument();
    expect(saveLetterPhotoAction).toHaveBeenCalledTimes(2);
  });

  it('muestra las fotos que ya se sacaron antes, sin estado de guardado', () => {
    renderSelfie([
      {
        kind: 'photo',
        src: 'https://firmada/hoy.jpg',
        width: 1200,
        height: 1600,
        takenAt: '2026-10-18T12:00:00-03:00',
        alt: 'Mamá y Salu, el día de la carta.',
        caption: COPY.caption,
      },
    ]);
    expect(screen.getByAltText('Mamá y Salu, el día de la carta.')).toBeInTheDocument();
    expect(screen.queryByText(COPY.saved)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Sacar otra')).toBeInTheDocument();
  });
});
