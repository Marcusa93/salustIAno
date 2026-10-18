import { Finale } from '@/app/carta/[slug]/_components/finale';
import { PhotoViewerProvider } from '@/app/carta/[slug]/_components/photo-viewer';
import { SoundtrackProvider } from '@/app/carta/[slug]/_components/soundtrack-provider';
import type { Letter } from '@/lib/carta/manifest';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';

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
