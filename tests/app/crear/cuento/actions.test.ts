import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AIConfigError,
  AIGuardrailError,
  AINetworkError,
  AIParseError,
  AIProviderError,
  AIValidationError,
} from '@/lib/ai/errors';

const mocks = vi.hoisted(() => ({
  generateStoryMock: vi.fn(),
}));

vi.mock('@/lib/ai/agents', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ai/agents')>('@/lib/ai/agents');
  return {
    ...actual,
    generateStory: mocks.generateStoryMock,
  };
});

import { createStoryAction } from '@/app/(app)/crear/cuento/actions';

const validInput = {
  childName: 'Salu',
  ageDescription: '3 meses',
  moment: 'dormir',
  characters: ['mamá', 'osito'],
  duration: 'corto',
};

const validOutput = {
  title: 'La luna y el osito',
  story: 'Habia una vez un osito que esperaba que llegue la noche con su mamá. La luna asomó.',
  moralOrTheme: 'La presencia trae calma.',
  charactersUsed: ['mamá', 'osito'],
};

describe('createStoryAction', () => {
  afterEach(() => {
    mocks.generateStoryMock.mockReset();
  });

  it('happy path: devuelve status success con story y meta', async () => {
    mocks.generateStoryMock.mockResolvedValueOnce({
      output: validOutput,
      meta: {
        model: 'anthropic/claude-opus-4-7',
        tokens: 300,
        latencyMs: 1234,
        promptVersion: 'story-v1',
      },
    });

    const result = await createStoryAction(validInput);

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.story).toEqual(validOutput);
      expect(result.meta.promptVersion).toBe('story-v1');
    }
  });

  it('input inválido (sin pasar por LLM) → status error tipo validation', async () => {
    const result = await createStoryAction({ ...validInput, characters: [] });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error.type).toBe('validation');
      expect(result.error.message).toMatch(/datos del formulario/i);
    }
    expect(mocks.generateStoryMock).not.toHaveBeenCalled();
  });

  it('AINetworkError → mensaje rioplatense de network', async () => {
    mocks.generateStoryMock.mockRejectedValueOnce(new AINetworkError('socket', null));

    const result = await createStoryAction(validInput);

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error.type).toBe('network');
      expect(result.error.message).toMatch(/conectar/i);
    }
  });

  it('AIProviderError → mensaje provider', async () => {
    mocks.generateStoryMock.mockRejectedValueOnce(new AIProviderError(500, 'oops'));

    const result = await createStoryAction(validInput);

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error.type).toBe('provider');
    }
  });

  it('AIParseError → mensaje parse', async () => {
    mocks.generateStoryMock.mockRejectedValueOnce(new AIParseError('bad json'));

    const result = await createStoryAction(validInput);

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error.type).toBe('parse');
    }
  });

  it('AIGuardrailError → mensaje guardrail', async () => {
    mocks.generateStoryMock.mockRejectedValueOnce(new AIGuardrailError('pattern'));

    const result = await createStoryAction(validInput);

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error.type).toBe('guardrail');
    }
  });

  it('AIConfigError → mensaje config', async () => {
    mocks.generateStoryMock.mockRejectedValueOnce(new AIConfigError('no key'));

    const result = await createStoryAction(validInput);

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error.type).toBe('config');
      expect(result.error.message).toMatch(/admin/i);
    }
  });

  it('AIValidationError tirado por agente → mensaje validation', async () => {
    mocks.generateStoryMock.mockRejectedValueOnce(new AIValidationError('schema'));

    const result = await createStoryAction(validInput);

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error.type).toBe('validation');
    }
  });

  it('error genérico → mensaje fallback de provider', async () => {
    mocks.generateStoryMock.mockRejectedValueOnce(new Error('something else'));

    const result = await createStoryAction(validInput);

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error.type).toBe('provider');
      expect(result.error.message).toMatch(/algo salió mal/i);
    }
  });
});
