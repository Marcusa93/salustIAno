import { Finale } from '@/app/carta/[slug]/_components/finale';
import { PhotoViewerProvider } from '@/app/carta/[slug]/_components/photo-viewer';
import { SoundtrackProvider } from '@/app/carta/[slug]/_components/soundtrack-provider';
import type { Letter } from '@/lib/carta/manifest';
import { Soundtrack } from '@/lib/carta/soundtrack';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const FINALE: Letter['finale'] = {
  lines: ['Nunca vas a estar sola.'],
  touchPrompt: 'Apoyá el dedo sobre mi corazón.',
  closing: ['Gracias por tu magia, mamá.'],
  signature: 'Salu',
  wish: 'Feliz primer Día de la Madre.',
  postscript: {
    label: 'P.D. de papá',
    lines: ['Nadie nunca me hizo tan feliz.'],
    signature: 'Marco',
  },
};

beforeAll(() => {
  // happy-dom no trae IntersectionObserver; motion lo usa para onViewportEnter.
  globalThis.IntersectionObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
});

function renderFinale(finale: Letter['finale']) {
  return render(
    <SoundtrackProvider songs={[]}>
      <PhotoViewerProvider photos={[]} birthAt="2026-05-04T14:32:00-03:00">
        <Finale
          slug="mama-2026"
          finale={finale}
          birthAt="2026-05-04T14:32:00-03:00"
          memories={[]}
          onEnter={() => {}}
        />
      </PhotoViewerProvider>
    </SoundtrackProvider>,
  );
}

describe('Finale de la carta', () => {
  it('la foto final se ríe al tocarla y aparece la dedicatoria', async () => {
    const playEffect = vi.spyOn(Soundtrack.prototype, 'playEffect').mockResolvedValue();
    renderFinale({
      ...FINALE,
      moment: {
        photo: {
          kind: 'photo',
          src: 'https://firmada/46.jpg',
          width: 960,
          height: 1280,
          takenAt: '2026-10-17T20:30:00-03:00',
          alt: 'Abril levanta a Salu y los dos se ríen.',
          caption: 'Vos y yo.',
          sound: 'risa',
        },
        hint: 'Tocame',
        after: 'Esta risa es tuya, mamá.',
      },
    });

    fireEvent.pointerDown(screen.getByRole('button', { name: /Mantené apretado/ }));
    const photo = await screen.findByRole(
      'button',
      { name: 'Tocame: Abril levanta a Salu y los dos se ríen.' },
      { timeout: 6000 },
    );
    expect(screen.queryByText('Esta risa es tuya, mamá.')).not.toBeInTheDocument();

    fireEvent.click(photo);
    expect(playEffect).toHaveBeenCalledWith('risa');
    expect(await screen.findByText('Esta risa es tuya, mamá.')).toBeInTheDocument();
    playEffect.mockRestore();
  }, 10_000);

  it('después de sostener el corazón muestra la firma y la P.D. de papá', async () => {
    renderFinale(FINALE);
    expect(screen.queryByText('P.D. de papá')).not.toBeInTheDocument();

    fireEvent.pointerDown(screen.getByRole('button', { name: /Mantené apretado/ }));

    expect(await screen.findByText('P.D. de papá', {}, { timeout: 6000 })).toBeInTheDocument();
    expect(screen.getByText('Salu')).toBeInTheDocument();
    expect(screen.getByText('Marco')).toBeInTheDocument();
  }, 10_000);

  it('sin P.D. el final queda como estaba', async () => {
    const { postscript: _postscript, ...withoutPostscript } = FINALE;
    renderFinale(withoutPostscript);
    fireEvent.pointerDown(screen.getByRole('button', { name: /Mantené apretado/ }));
    expect(await screen.findByText('Salu', {}, { timeout: 6000 })).toBeInTheDocument();
    expect(screen.queryByText('P.D. de papá')).not.toBeInTheDocument();
  }, 10_000);
});
