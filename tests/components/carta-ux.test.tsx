import { Envelope } from '@/app/carta/[slug]/_components/envelope';
import { Finale } from '@/app/carta/[slug]/_components/finale';
import { ChapterRail, ExitLetterLink } from '@/app/carta/[slug]/_components/letter-chrome';
import { PhotoViewerProvider } from '@/app/carta/[slug]/_components/photo-viewer';
import { SoundtrackProvider } from '@/app/carta/[slug]/_components/soundtrack-provider';
import type { LetterChapter } from '@/lib/carta/manifest';
import { Soundtrack } from '@/lib/carta/soundtrack';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

beforeAll(() => {
  globalThis.IntersectionObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
});

function withProviders(children: ReactNode) {
  return (
    <SoundtrackProvider songs={[]}>
      <PhotoViewerProvider photos={[]} birthAt="2026-05-04T14:32:00-03:00">
        {children}
      </PhotoViewerProvider>
    </SoundtrackProvider>
  );
}

const ENVELOPE = {
  to: 'Para mamá',
  from: 'De: Salu',
  stamp: '18 · 10 · 26',
  hint: 'Subí el volumen.',
};

describe('Salir de la carta', () => {
  it('siempre hay un camino de vuelta a la app', () => {
    render(<ExitLetterLink />);
    expect(screen.getByRole('link', { name: /volver a Salu/ })).toHaveAttribute('href', '/home');
  });
});

describe('Sobre: seguir donde estabas', () => {
  it('sin progreso, invita a abrir el sobre', () => {
    render(
      withProviders(
        <Envelope envelope={ENVELOPE} resumeLabel={null} onOpened={vi.fn()} onResume={vi.fn()} />,
      ),
    );
    expect(screen.getByText('Tocá para abrir')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Seguir donde estabas/ })).not.toBeInTheDocument();
  });

  it('con progreso, ofrece seguir y ese toque también desbloquea el audio', async () => {
    const unlock = vi.spyOn(Soundtrack.prototype, 'unlock').mockImplementation(() => {});
    const onResume = vi.fn();
    render(
      withProviders(
        <Envelope
          envelope={ENVELOPE}
          resumeLabel="Agosto"
          onOpened={vi.fn()}
          onResume={onResume}
        />,
      ),
    );
    expect(screen.getByText(/Ibas por Agosto/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Seguir donde estabas/ }));
    expect(unlock).toHaveBeenCalled();
    expect(onResume).toHaveBeenCalled();
    unlock.mockRestore();
  });
});

describe('Barra de arriba: índice de meses y canción', () => {
  const chapters = [
    { id: 'mayo', label: 'Mayo', title: 'Mis primeras semanas' },
    { id: 'agosto', label: 'Agosto', title: 'Tres meses' },
  ];
  const current = { ...chapters[0], text: ['Hola'], media: [] } as LetterChapter;

  it('tocando el mes se abre el índice y se puede saltar a un mes o al final', async () => {
    const onJump = vi.fn();
    render(<ChapterRail chapters={chapters} current={current} nowPlaying={null} onJump={onJump} />);
    await userEvent.click(screen.getByRole('button', { name: /Mayo, Mis primeras semanas/ }));
    const index = screen.getByRole('navigation', { name: 'Meses de la carta' });
    expect(index).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Agosto/ }));
    expect(onJump).toHaveBeenCalledWith('agosto');
    await waitFor(() =>
      expect(
        screen.queryByRole('navigation', { name: 'Meses de la carta' }),
      ).not.toBeInTheDocument(),
    );

    await userEvent.click(screen.getByRole('button', { name: /Mayo, Mis primeras semanas/ }));
    await userEvent.click(screen.getByRole('button', { name: /El final/ }));
    expect(onJump).toHaveBeenLastCalledWith('final');
  });

  it('muestra qué canción empezó a sonar', () => {
    render(
      <ChapterRail
        chapters={chapters}
        current={current}
        nowPlaying={{ id: 'volare', title: 'Por ti volaré', artist: 'Andrea Bocelli', src: '' }}
        onJump={vi.fn()}
      />,
    );
    expect(screen.getByText('Por ti volaré')).toBeInTheDocument();
    expect(screen.getByText('· Andrea Bocelli')).toBeInTheDocument();
  });
});

describe('Final: si no le sale mantener apretado', () => {
  it('explica que hay que sostener y, a la segunda, deja seguir igual', async () => {
    render(
      withProviders(
        <Finale
          slug="mama-2026"
          finale={{
            lines: ['Nunca vas a estar sola.'],
            touchPrompt: 'Apoyá el dedo sobre mi corazón.',
            closing: ['Gracias por tu magia, mamá.'],
            signature: 'Salu',
            wish: 'Feliz primer Día de la Madre.',
          }}
          birthAt="2026-05-04T14:32:00-03:00"
          memories={[]}
          onEnter={() => {}}
        />,
      ),
    );
    const heart = screen.getByRole('button', { name: /Mantené apretado/ });

    fireEvent.pointerDown(heart);
    fireEvent.pointerUp(heart);
    expect(await screen.findByText('Dejá el dedo apoyado, un ratito más.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Seguir sin esperar' })).not.toBeInTheDocument();

    fireEvent.pointerDown(heart);
    fireEvent.pointerUp(heart);
    await userEvent.click(await screen.findByRole('button', { name: 'Seguir sin esperar' }));
    expect(await screen.findByText('Salu')).toBeInTheDocument();
  });
});
