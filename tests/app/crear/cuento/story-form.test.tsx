import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createStoryActionMock: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('@/app/(app)/crear/cuento/actions', () => ({
  createStoryAction: mocks.createStoryActionMock,
}));

vi.mock('sonner', () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
  },
}));

import { StoryForm } from '@/app/(app)/crear/cuento/story-form';

describe('StoryForm', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  async function fillMinimumValid(user: ReturnType<typeof userEvent.setup>) {
    // childName ya tiene default 'Salustiano'.
    await user.type(screen.getByLabelText('Edad'), '3 meses');
    // moment y duration tienen default 'dormir' / 'corto'.
    await user.type(screen.getByLabelText('Quiénes aparecen'), 'mamá{Enter}');
  }

  it('renderiza los fields principales', () => {
    render(<StoryForm />);

    expect(screen.getByLabelText('Nombre')).toBeInTheDocument();
    expect(screen.getByLabelText('Edad')).toBeInTheDocument();
    expect(screen.getByLabelText('¿Para qué momento?')).toBeInTheDocument();
    expect(screen.getByLabelText('Duración')).toBeInTheDocument();
    expect(screen.getByLabelText('Quiénes aparecen')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generar cuento/i })).toBeInTheDocument();
  });

  it('submit con personajes vacíos muestra error de validación', async () => {
    const user = userEvent.setup();
    render(<StoryForm />);

    await user.type(screen.getByLabelText('Edad'), '3 meses');
    await user.click(screen.getByRole('button', { name: /generar cuento/i }));

    await waitFor(() => {
      expect(screen.getByText(/al menos un personaje|too small/i)).toBeInTheDocument();
    });
    expect(mocks.createStoryActionMock).not.toHaveBeenCalled();
  });

  it('submit con datos válidos llama createStoryAction', async () => {
    mocks.createStoryActionMock.mockResolvedValueOnce({
      status: 'success',
      story: {
        title: 'X',
        story: 'Texto largo de cuento que cumple con la longitud mínima del schema, fácil.',
        moralOrTheme: 'Tema',
        charactersUsed: ['mamá'],
      },
      meta: {
        model: 'anthropic/claude-opus-4-7',
        tokens: 100,
        latencyMs: 500,
        promptVersion: 'story-v1',
      },
    });

    const user = userEvent.setup();
    render(<StoryForm />);

    await fillMinimumValid(user);
    await user.click(screen.getByRole('button', { name: /generar cuento/i }));

    await waitFor(() => {
      expect(mocks.createStoryActionMock).toHaveBeenCalledTimes(1);
    });
    const call = mocks.createStoryActionMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(call.childName).toBe('Salustiano');
    expect(call.ageDescription).toBe('3 meses');
    expect(call.characters).toEqual(['mamá']);
  });

  it('estado success renderiza StoryResult', async () => {
    mocks.createStoryActionMock.mockResolvedValueOnce({
      status: 'success',
      story: {
        title: 'La luna y el osito',
        story: 'Había una vez un osito que esperaba que llegue la noche con su mamá.',
        moralOrTheme: 'Tema',
        charactersUsed: ['mamá', 'osito'],
      },
      meta: {
        model: 'anthropic/claude-opus-4-7',
        tokens: 100,
        latencyMs: 500,
        promptVersion: 'story-v1',
      },
    });

    const user = userEvent.setup();
    render(<StoryForm />);

    await fillMinimumValid(user);
    await user.click(screen.getByRole('button', { name: /generar cuento/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'La luna y el osito' })).toBeInTheDocument();
    });
  });

  it('estado error muestra toast', async () => {
    mocks.createStoryActionMock.mockResolvedValueOnce({
      status: 'error',
      error: { type: 'network', message: 'No pudimos conectar con la IA. Probá de nuevo.' },
    });

    const user = userEvent.setup();
    render(<StoryForm />);

    await fillMinimumValid(user);
    await user.click(screen.getByRole('button', { name: /generar cuento/i }));

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(
        'No pudimos conectar con la IA. Probá de nuevo.',
      );
    });
  });
});
