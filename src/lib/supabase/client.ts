import { createBrowserClient } from '@supabase/ssr';

import type { Database } from '@/types/database';

/**
 * Cliente Supabase para Client Components.
 *
 * No importa `@/lib/env` (que valida con Zod al cargar el módulo) porque
 * eso forzaría al bundle del cliente a hacer la misma validación de
 * variables server-only — y al ser undefined en el browser, crashea la
 * app entera al hidratar.
 *
 * En su lugar lee `process.env.NEXT_PUBLIC_*` directo. Next.js inlinea
 * esos valores en build time, así que cuando el bundle se ejecuta en el
 * browser ya son strings literales. Si Vercel los tiene mal configurados
 * el `createBrowserClient` lanza un error claro al instanciarse, no al
 * cargar el módulo — que es el comportamiento que queremos.
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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Faltan NEXT_PUBLIC_SUPABASE_URL y/o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en el build. Configurá las variables en Vercel y re-deployá.',
    );
  }
  return createBrowserClient<Database>(url, key);
}
