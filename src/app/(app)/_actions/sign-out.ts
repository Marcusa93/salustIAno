'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

/**
 * Cierra la sesión actual y redirige al landing.
 *
 * `redirect()` se lanza fuera del flow normal (Next lo implementa con una
 * excepción especial); por eso no envolvemos en try/catch ni devolvemos
 * un return path para success.
 */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
