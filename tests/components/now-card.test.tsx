import { NowCard } from '@/app/(app)/home/_components/now-card';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const actions = vi.hoisted(() => ({
  closeSleepAction: vi.fn(),
  deleteEventAction: vi.fn(async () => ({ ok: true as const })),
  quickCloseSleepAction: vi.fn(),
  quickStartSleepAction: vi.fn(),
  reopenSleepAction: vi.fn(),
  restoreEventAction: vi.fn(),
}));

vi.mock('@/app/(app)/cuidar/eventos/actions', () => actions);
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const RENDERED_AT = '2026-10-17T22:30:00-03:00';

function renderCard(startedAt: string) {
  return render(
    <NowCard
      activeSleep={{ id: 'sleep-1', started_at: startedAt, is_nap: false }}
      lastWokeUpAt={null}
      lastFeeding={null}
      nextFeedingLabel={null}
      wakeWindow={null}
      renderedAt={RENDERED_AT}
    />,
  );
}

describe('NowCard con un sueño en curso', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('un sueño normal se cierra con un toque', () => {
    renderCard('2026-10-17T20:30:00-03:00');
    expect(screen.getByText('Durmiendo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Se despertó' })).toBeInTheDocument();
  });

  it('un sueño abierto hace más de 24 h pide la hora real en vez de cerrarlo "ahora"', () => {
    renderCard('2026-10-16T18:59:00-03:00');
    expect(screen.getByText('Quedó un sueño abierto')).toBeInTheDocument();
    expect(screen.getByText('¿A qué hora se despertó?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anotar cuándo se despertó' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Se despertó' })).not.toBeInTheDocument();
  });

  it('el formulario de un sueño olvidado explica que hay que poner la hora real', async () => {
    renderCard('2026-10-16T18:59:00-03:00');
    await userEvent.click(screen.getByRole('button', { name: 'Anotar cuándo se despertó' }));
    expect(
      await screen.findByText(/quedó abierto de más\. Poné la hora en que se despertó de verdad/),
    ).toBeInTheDocument();
  });

  it('se puede descartar un sueño que no existió', async () => {
    renderCard('2026-10-16T18:59:00-03:00');
    await userEvent.click(screen.getByRole('button', { name: 'No durmió: descartarlo' }));
    await waitFor(() =>
      expect(actions.deleteEventAction).toHaveBeenCalledWith('sleep_sessions', 'sleep-1'),
    );
    expect(actions.quickCloseSleepAction).not.toHaveBeenCalled();
  });
});
