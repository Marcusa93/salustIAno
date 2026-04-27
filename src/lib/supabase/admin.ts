import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

import { env } from '@/lib/env';
import type { Database } from '@/types/database';

/**
 * Cliente admin de Supabase con la secret key.
 *
 * ⚠️  ATENCIÓN — BYPASEA RLS POR COMPLETO.
 *
 * Solo usar en flujos donde es estrictamente necesario:
 *   - jobs / cron en background sin contexto de usuario
 *   - operaciones administrativas (seed, migraciones de datos puntuales)
 *   - flujos donde la identidad del usuario ya fue verificada y se
 *     necesita actuar fuera de su contexto de RLS
 *
 * Nunca importar desde un Client Component. El `import 'server-only'` lo
 * impide en build, pero la regla es igualmente clara: este cliente jamás
 * cruza el límite servidor → cliente.
 *
 * @throws {Error} si SUPABASE_SECRET_KEY no está configurada.
 */
export function createAdminClient() {
  if (!env.SUPABASE_SECRET_KEY) {
    throw new Error(
      'SUPABASE_SECRET_KEY no está configurada. Agregá la secret key en .env.local antes de usar el cliente admin.',
    );
  }

  return createSupabaseClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
