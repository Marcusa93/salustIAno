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
  // Web Push (VAPID). Si no están seteadas, las suscripciones rechazan
  // gracefully con un mensaje en lugar de crashear.
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  VAPID_EMAIL: z.string().email().default('marco.rossi@derecho.unt.edu.ar'),
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
