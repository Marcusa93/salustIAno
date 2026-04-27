import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { env } from '@/lib/env';
import type { Database } from '@/types/database';

/**
 * Cliente Supabase para Server Components, Server Actions y Route Handlers.
 *
 * Cada llamada crea un cliente nuevo asociado a las cookies del request
 * actual — no cachear la instancia entre requests.
 *
 * @example
 * ```ts
 * import { createClient } from '@/lib/supabase/server';
 *
 * export default async function HomePage() {
 *   const supabase = await createClient();
 *   const { data: { user } } = await supabase.auth.getUser();
 *   // ...
 * }
 * ```
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components no pueden escribir cookies — el middleware
            // se encarga de refrescar la sesión.
          }
        },
      },
    },
  );
}
