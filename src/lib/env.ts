import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({
    error: 'NEXT_PUBLIC_SUPABASE_URL debe ser una URL válida.',
  }),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(1, 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY no puede estar vacía.'),
  SUPABASE_SECRET_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_APP_URL: z.url().default('http://localhost:3000'),
  OPENROUTER_API_KEY: z.string().min(1).optional(),
  OPENROUTER_DEFAULT_MODEL: z.string().min(1).default('anthropic/claude-haiku-4-5'),
  AIMLAPI_API_KEY: z.string().min(1).optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const detail = z.prettifyError(parsed.error);
  throw new Error(
    [
      'Variables de entorno inválidas o faltantes.',
      'Revisá tu archivo .env.local contra .env.example y completá las variables requeridas.',
      '',
      detail,
    ].join('\n'),
  );
}

export const env = parsed.data;
