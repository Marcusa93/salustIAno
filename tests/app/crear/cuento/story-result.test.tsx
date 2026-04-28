import { StoryResult } from '@/app/(app)/crear/cuento/story-result';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const story = {
  title: 'La luna y el osito',
  story: 'Había una vez un osito.\n\nQue se durmió mirando la luna.',
  moralOrTheme: 'La presencia trae calma.',
  charactersUsed: ['mamá', 'osito'],
};

const meta = {
  model: 'anthropic/claude-opus-4-7',
  tokens: 300,
  latencyMs: 1234,
  promptVersion: 'story-v1',
};

describe('StoryResult', () => {
  // biome-ignore lint/suspicious/noExplicitAny: el tipo exacto del spy varía con la versión de vitest; un any es razonable acá.
  let writeTextSpy: any;

  beforeEach(() => {
    // happy-dom ya provee navigator.clipboard.writeText; la spyeamos.
    writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(async () => {});
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:fake'),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renderiza title, story, moralOrTheme y characters', () => {
    render(<StoryResult story={story} meta={meta} onRegenerate={() => {}} onNew={() => {}} />);

    expect(screen.getByRole('heading', { name: story.title })).toBeInTheDocument();
    expect(screen.getByText(/había una vez/i)).toBeInTheDocument();
    expect(screen.getByText(story.moralOrTheme)).toBeInTheDocument();
    expect(screen.getByText('mamá')).toBeInTheDocument();
    expect(screen.getByText('osito')).toBeInTheDocument();
  });

  it('muestra meta con palabras y latencia formateada', () => {
    render(<StoryResult story={story} meta={meta} onRegenerate={() => {}} onNew={() => {}} />);

    expect(screen.getByText(/anthropic\/claude-opus-4-7/)).toBeInTheDocument();
    expect(screen.getByText(/1\.2 s/)).toBeInTheDocument();
  });

  it('Copiar invoca clipboard.writeText con title + story', async () => {
    render(<StoryResult story={story} meta={meta} onRegenerate={() => {}} onNew={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /copiar/i }));

    await waitFor(() => {
      expect(writeTextSpy).toHaveBeenCalledWith(`${story.title}\n\n${story.story}`);
    });
  });

  it('Descargar crea Blob y usa URL.createObjectURL', async () => {
    const user = userEvent.setup();
    render(<StoryResult story={story} meta={meta} onRegenerate={() => {}} onNew={() => {}} />);

    await user.click(screen.getByRole('button', { name: /descargar/i }));

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('Regenerar dispara onRegenerate', async () => {
    const onRegenerate = vi.fn();
    const user = userEvent.setup();
    render(<StoryResult story={story} meta={meta} onRegenerate={onRegenerate} onNew={() => {}} />);

    await user.click(screen.getByRole('button', { name: /regenerar/i }));
    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });

  it('Empezar de nuevo dispara onNew', async () => {
    const onNew = vi.fn();
    const user = userEvent.setup();
    render(<StoryResult story={story} meta={meta} onRegenerate={() => {}} onNew={onNew} />);

    await user.click(screen.getByRole('button', { name: /empezar de nuevo/i }));
    expect(onNew).toHaveBeenCalledTimes(1);
  });
});
