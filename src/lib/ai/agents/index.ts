/**
 * Re-exports de los agentes implementados.
 *
 * `generateStory` es server-side (`import 'server-only'` en story.ts) y
 * solo se importa desde Server Actions o Server Components. Los schemas
 * Zod viven en `story-schema.ts` sin dependencias de Node — son safe
 * desde Client Components (formularios con react-hook-form) y desde
 * tests.
 *
 * Agentes futuros (orden tentativo según docs/04-agentes-llm.md):
 *   - daily-summary
 *   - pediatric-prep (con tratamiento médico especial)
 *   - song-generator
 */

export { generateStory } from './story';
export {
  storyInputSchema,
  storyOutputSchema,
  type StoryInput,
  type StoryOutput,
} from './story-schema';

export { chat as salustiaChat } from './salustia';
export type { SalustiaInput, SalustiaOutput } from './salustia';

export { analyzeDiaperPhoto } from './diaper-vision';
export {
  diaperAnalysisSchema,
  KNOWN_COLORS,
  KNOWN_CONSISTENCIES,
  type DiaperAnalysis,
} from './diaper-vision/schema';
export type { DiaperVisionInput, DiaperVisionOutput } from './diaper-vision';

export { generatePediatricPrep } from './pediatric-prep';
export {
  pediatricInputSchema,
  pediatricSummarySchema,
  type PediatricInput,
  type PediatricSummary,
} from './pediatric-prep/schema';
export type { PediatricPrepOutput } from './pediatric-prep';

export { generateLullaby } from './lullaby';
export {
  lullabyInputSchema,
  lullabyOutputSchema,
  type LullabyInput,
  type LullabyOutput,
  MOMENT_LABELS as LULLABY_MOMENT_LABELS,
  MOOD_LABELS as LULLABY_MOOD_LABELS,
  LENGTH_LABELS as LULLABY_LENGTH_LABELS,
} from './lullaby-schema';
