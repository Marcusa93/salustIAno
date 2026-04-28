/**
 * Tipos compartidos entre el Client Component y el Server Action de
 * /crear/cuento.
 *
 * Importable desde ambos lados (no tiene runtime, sólo tipos).
 */

import type { StoryInput, StoryOutput } from '@/lib/ai/agents/story-schema';
import type { AIErrorType } from '@/lib/ai/errors';

export type { StoryInput, StoryOutput };

export interface StoryMeta {
  model: string;
  tokens: number;
  latencyMs: number;
  promptVersion: string;
}

export type StoryFormState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'success'; story: StoryOutput; meta: StoryMeta }
  | { status: 'error'; error: { type: AIErrorType; message: string } };
