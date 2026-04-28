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
