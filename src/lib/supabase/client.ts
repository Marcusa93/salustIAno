import { createBrowserClient } from '@supabase/ssr';

import { env } from '@/lib/env';
import type { Database } from '@/types/database';

/**
 * Cliente Supabase para Client Components.
 *
 * Toda mutación o lectura sensible se filtra por RLS — nunca duplicar la
 * lógica de filtrado en este lado.
 *
 * @example
 * ```tsx
 * 'use client';
 * import { createClient } from '@/lib/supabase/client';
 *
 * export function FooButton() {
 *   const supabase = createClient();
 *   const handle = async () => {
 *     const { data } = await supabase.from('foo').select('*');
 *     // ...
 *   };
 *   return <button onClick={handle}>Cargar</button>;
 * }
 * ```
 */
export function createClient() {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
