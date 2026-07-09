'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

function generateToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

export async function getShareTokenAction(): Promise<
  { ok: true; token: string; createdAt: string } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, error: 'Sesión expirada.' };

  // biome-ignore lint/suspicious/noExplicitAny: share_token es columna nueva, types stale
  const sb = supabase as any;
  const { data: child } = await sb
    .from('child_profiles')
    .select('id, share_token, share_token_created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!child) return { ok: false, error: 'No encontramos el perfil del bebé.' };

  if (child.share_token) {
    return {
      ok: true,
      token: child.share_token as string,
      createdAt: child.share_token_created_at as string,
    };
  }

  const token = generateToken();
  const now = new Date().toISOString();
  const { error } = await sb
    .from('child_profiles')
    .update({ share_token: token, share_token_created_at: now })
    .eq('id', child.id);

  if (error) return { ok: false, error: 'No pudimos generar el link.' };

  revalidatePath('/familia');
  return { ok: true, token, createdAt: now };
}

export async function revokeAndRegenerateShareTokenAction(): Promise<
  { ok: true; token: string; createdAt: string } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, error: 'Sesión expirada.' };

  // biome-ignore lint/suspicious/noExplicitAny: share_token es columna nueva, types stale
  const sb = supabase as any;
  const { data: child } = await sb
    .from('child_profiles')
    .select('id')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!child) return { ok: false, error: 'No encontramos el perfil del bebé.' };

  const token = generateToken();
  const now = new Date().toISOString();
  const { error } = await sb
    .from('child_profiles')
    .update({ share_token: token, share_token_created_at: now })
    .eq('id', child.id);

  if (error) return { ok: false, error: 'No pudimos regenerar el link.' };

  revalidatePath('/familia');
  return { ok: true, token, createdAt: now };
}
