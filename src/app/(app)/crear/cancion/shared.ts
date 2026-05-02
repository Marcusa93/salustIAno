import type { LullabyInput, LullabyOutput } from '@/lib/ai/agents/lullaby-schema';
import type { AIErrorType } from '@/lib/ai/errors';

export type { LullabyInput, LullabyOutput };

export interface LullabyMeta {
  model: string;
  tokens: number;
  latencyMs: number;
  promptVersion: string;
}

export type LullabyFormState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'success'; lullaby: LullabyOutput; meta: LullabyMeta }
  | { status: 'error'; error: { type: AIErrorType; message: string } };
