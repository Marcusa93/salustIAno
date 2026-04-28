/**
 * Re-exports de los agentes implementados.
 *
 * Agentes futuros (orden tentativo según docs/04-agentes-llm.md):
 *   - daily-summary
 *   - pediatric-prep (con tratamiento médico especial)
 *   - song-generator
 */

export {
  generateStory,
  storyInputSchema,
  storyOutputSchema,
} from './story';

export type { StoryInput, StoryOutput } from './story';
