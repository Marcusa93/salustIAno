'use server';

import { createClient } from '@/lib/supabase/server';
import { type NoteInput, noteSchema } from '@/lib/validators/note';
import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

type ActionResult<TInput> =
  | { ok: true }
  | { ok: false; errors: Partial<Record<keyof TInput | 'root', string>> };

async function getActorContext() {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return { error: 'Sesión expirada.' as const };

  const { data: child, error: childError } = await supabase
    .from('child_profiles')
    .select('id')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (childError || !child) {
    return { error: 'Todavía no tenés un perfil de bebé creado.' as const };
  }

  return { supabase, userId: userData.user.id, childId: child.id };
}

function flatten(error: import('zod').ZodError): Partial<Record<keyof NoteInput | 'root', string>> {
  const fieldErrors = error.flatten().fieldErrors as Record<string, string[] | undefined>;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(fieldErrors)) {
    if (v?.[0]) out[k] = v[0];
  }
  return out as Partial<Record<keyof NoteInput | 'root', string>>;
}

/**
 * Crea una nota. RLS permite que cualquier miembro inserte (con
 * self-attribution). Update/delete los maneja el author o un admin.
 */
export async function createNoteAction(input: NoteInput): Promise<ActionResult<NoteInput>> {
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: flatten(parsed.error) };
  }

  const ctx = await getActorContext();
  if ('error' in ctx) return { ok: false, errors: { root: ctx.error } };

  const { data, error } = await ctx.supabase
    .from('notes')
    .insert({
      child_id: ctx.childId,
      occurred_at: parsed.data.occurred_at,
      category: parsed.data.category,
      content: parsed.data.content,
      created_by: ctx.userId,
    })
    .select('id')
    .single();

  if (error || !data) {
    return { ok: false, errors: { root: 'No pudimos guardar la nota.' } };
  }

  revalidatePath('/timeline');
  revalidatePath('/home');
  redirect(`/notas/${data.id}` as Route);
}

export async function updateNoteAction(
  id: string,
  input: NoteInput,
): Promise<ActionResult<NoteInput>> {
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: flatten(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('notes')
    .update({
      occurred_at: parsed.data.occurred_at,
      category: parsed.data.category,
      content: parsed.data.content,
    })
    .eq('id', id);

  if (error) {
    return { ok: false, errors: { root: 'No pudimos actualizar la nota.' } };
  }

  revalidatePath('/timeline');
  revalidatePath('/home');
  revalidatePath(`/notas/${id}`);
  redirect(`/notas/${id}` as Route);
}

export async function deleteNoteAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('notes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    return { ok: false, error: 'No pudimos borrar la nota.' };
  }

  revalidatePath('/timeline');
  revalidatePath('/home');
  redirect('/timeline?tipo=note' as Route);
}
