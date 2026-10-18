import { HeartbeatGate } from '@/app/carta/[slug]/_components/heartbeat-gate';
import { PhotoViewerProvider } from '@/app/carta/[slug]/_components/photo-viewer';
import { SoundtrackProvider } from '@/app/carta/[slug]/_components/soundtrack-provider';
import type { Letter } from '@/lib/carta/manifest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

const COPY: Letter['heartbeat'] = {
  prompt: 'Antes de verme, ya me escuchabas.',
  instruction: 'Apoyá el dedo acá y dejalo un ratito.',
  after: 'Ese era yo. Y desde ese día, sos mi mamá.',
};

function renderGate(copy: Letter['heartbeat']) {
  return render(
    <SoundtrackProvider songs={[]}>
      <PhotoViewerProvider photos={[]} birthAt="2026-05-04T14:32:00-03:00">
        <HeartbeatGate copy={copy} firstSongId={undefined} onDone={vi.fn()} />
      </PhotoViewerProvider>
    </SoundtrackProvider>,
  );
}

async function completeWithoutHolding() {
  const button = screen.getByRole('button', { name: /Mantené apretado/ });
  for (let i = 0; i < 2; i++) {
    fireEvent.pointerDown(button);
    fireEvent.pointerUp(button);
  }
  await userEvent.click(await screen.findByRole('button', { name: 'Seguir sin esperar' }));
}

describe('HeartbeatGate', () => {
  it('al terminar, la huella le deja lugar a la foto de ese día', async () => {
    renderGate({
      ...COPY,
      photo: {
        kind: 'photo',
        src: 'https://firmada/03.jpg',
        width: 1200,
        height: 1600,
        takenAt: '2026-05-04T18:36:20-03:00',
        alt: 'Salu recién nacido sobre el pecho de mamá.',
        caption: 'Hola, mamá.',
      },
    });
    expect(
      screen.queryByAltText('Salu recién nacido sobre el pecho de mamá.'),
    ).not.toBeInTheDocument();

    await completeWithoutHolding();

    expect(await screen.findByText(COPY.after, {}, { timeout: 4000 })).toBeInTheDocument();
    expect(
      await screen.findByAltText(
        'Salu recién nacido sobre el pecho de mamá.',
        {},
        { timeout: 4000 },
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Hola, mamá.')).toBeInTheDocument();
  });

  it('sin foto, termina como antes', async () => {
    renderGate(COPY);
    await completeWithoutHolding();
    expect(await screen.findByText(COPY.after, {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
