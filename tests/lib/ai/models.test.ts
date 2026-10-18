import { describe, expect, it } from 'vitest';

import {
  AGENT_MODEL_PROFILES,
  CLAUDE_MODELS,
  type ProfiledAgent,
  acceptsTemperature,
  canDisableReasoning,
  modelProfileFor,
} from '@/lib/ai/models';

const profiles = Object.entries(AGENT_MODEL_PROFILES) as Array<
  [ProfiledAgent, (typeof AGENT_MODEL_PROFILES)[ProfiledAgent]]
>;

describe('AGENT_MODEL_PROFILES', () => {
  it('todos los agentes usan un modelo de la familia Claude 5.5', () => {
    const current = new Set<string>(Object.values(CLAUDE_MODELS));
    for (const [agent, profile] of profiles) {
      expect(current.has(profile.model), agent).toBe(true);
    }
  });

  it('Haiku para tareas cortas o frecuentes', () => {
    expect(modelProfileFor('photo-tagger').model).toBe(CLAUDE_MODELS.haiku);
    expect(modelProfileFor('daily-summary').model).toBe(CLAUDE_MODELS.haiku);
    expect(modelProfileFor('salustia-fast').model).toBe(CLAUDE_MODELS.haiku);
  });

  it('Sonnet para los agentes que razonan o escriben', () => {
    const sonnetAgents: ProfiledAgent[] = [
      'salustia',
      'pediatric-sleep-coach',
      'pattern-finder',
      'pediatric-prep',
      'story-generator',
      'lullaby',
      'diaper-vision',
    ];
    for (const agent of sonnetAgents) {
      expect(modelProfileFor(agent).model, agent).toBe(CLAUDE_MODELS.sonnet);
    }
  });

  it("ningún perfil pide effort 'none' en un modelo con razonamiento obligatorio", () => {
    for (const [agent, profile] of profiles) {
      if (profile.effort === 'none') {
        expect(canDisableReasoning(profile.model), agent).toBe(true);
      }
    }
  });

  it('deja margen para el razonamiento cuando está prendido', () => {
    for (const [agent, profile] of profiles) {
      const floor = profile.effort === 'none' ? 500 : 2_000;
      expect(profile.maxTokens, agent).toBeGreaterThanOrEqual(floor);
    }
  });
});

describe('canDisableReasoning', () => {
  it('Haiku 5.5 se puede apagar, Sonnet 5.5 no', () => {
    expect(canDisableReasoning(CLAUDE_MODELS.haiku)).toBe(true);
    expect(canDisableReasoning(CLAUDE_MODELS.sonnet)).toBe(false);
  });
});

describe('acceptsTemperature', () => {
  it('rechaza temperature en Claude 5.x y Opus 4.7/4.8', () => {
    expect(acceptsTemperature('anthropic/claude-haiku-5.5')).toBe(false);
    expect(acceptsTemperature('anthropic/claude-sonnet-5.5')).toBe(false);
    expect(acceptsTemperature('anthropic/claude-opus-5.5')).toBe(false);
    expect(acceptsTemperature('anthropic/claude-sonnet-5')).toBe(false);
    expect(acceptsTemperature('anthropic/claude-opus-4.7')).toBe(false);
    expect(acceptsTemperature('anthropic/claude-opus-4-7')).toBe(false);
  });

  it('la acepta en modelos anteriores y en otros proveedores', () => {
    expect(acceptsTemperature('anthropic/claude-haiku-4.5')).toBe(true);
    expect(acceptsTemperature('anthropic/claude-sonnet-4.6')).toBe(true);
    expect(acceptsTemperature('minimax/music-1.5')).toBe(true);
  });
});
