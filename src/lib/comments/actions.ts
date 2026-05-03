'use server';

import { createClient } from '@/lib/supabase/server';
import {
  type CommentTarget,
  type CreateCommentInput,
  createCommentSchema,
} from '@/lib/validators/comment';
import { revalidatePath } from 'next/cache';
import { sendPushToFamily } from '../../app/(app)/perfil/push-actions';

export interface CommentEntry {
  id: string;
  targetType: CommentTarget;
  targetId: string;
  content: string;
  authorUserId: string | null;
  authorDisplayName: string | null;
  authorInitial: string;
  isOwn: boolean;
  createdAt: string;
}

/**
 * Devuelve los comentarios activos de un evento. El caller pasa
 * (targetType, targetId) — la tabla los discrimina.
 *
 * Resuelve display_name de cada autor desde family_memberships.
 */
export async function listCommentsAction(
  targetType: CommentTarget,
  targetId: string,
): Promise<CommentEntry[]> {
  if (typeof targetId !== 'string' || targetId.length === 0) return [];

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const meId = userData.user?.id ?? null;

  // biome-ignore lint/suspicious/noExplicitAny: types stale (migration 021).
  const sb = supabase as any;
  const { data } = await sb
    .from('event_comments')
    .select('id, family_group_id, target_type, target_id, content, created_by, created_at')
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (!data) return [];

  const rows = data as Array<Record<string, unknown>>;
  const userIds = Array.from(
    new Set(
      rows
        .map((r) => r.created_by as string | null)
        .filter((u): u is string => typeof u === 'string'),
    ),
  );

  const nameByUserId = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: members } = await supabase
      .from('family_memberships')
      .select('user_id, display_name')
      .in('user_id', userIds)
      .is('deleted_at', null);
    for (const m of (members ?? []) as Array<{
      user_id: string;
      display_name: string | null;
    }>) {
      if (m.display_name) nameByUserId.set(m.user_id, m.display_name);
    }
  }

  return rows.map((r) => {
    const authorUserId = (r.created_by as string | null) ?? null;
    const displayName = authorUserId ? (nameByUserId.get(authorUserId) ?? null) : null;
    const initial = (displayName?.[0] ?? '?').toUpperCase();
    return {
      id: r.id as string,
      targetType: r.target_type as CommentTarget,
      targetId: r.target_id as string,
      content: r.content as string,
      authorUserId,
      authorDisplayName: displayName,
      authorInitial: initial,
      isOwn: authorUserId !== null && authorUserId === meId,
      createdAt: r.created_at as string,
    };
  });
}

/**
 * Crea un comentario sobre un evento. Resuelve family_group_id desde el
 * target (note → child_profiles.family_group_id, milestone directo, etc.).
 * Si no podemos resolverlo, el insert falla por RLS.
 */
export async function createCommentAction(
  input: CreateCommentInput,
): Promise<
  | { ok: true; comment: CommentEntry }
  | { ok: false; error: string; field?: keyof CreateCommentInput }
> {
  const parsed = createCommentSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: issue?.message ?? 'Datos inválidos.',
      ...(issue?.path[0] && typeof issue.path[0] === 'string'
        ? { field: issue.path[0] as keyof CreateCommentInput }
        : {}),
    };
  }
  const data = parsed.data;

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, error: 'Sesión expirada.' };

  const familyGroupId = await resolveFamilyGroupForTarget(supabase, data.targetType, data.targetId);
  if (!familyGroupId) {
    return { ok: false, error: 'No pudimos vincular el comentario a tu familia.' };
  }

  // biome-ignore lint/suspicious/noExplicitAny: types stale (migration 021).
  const sb = supabase as any;
  const { data: created, error } = await sb
    .from('event_comments')
    .insert({
      family_group_id: familyGroupId,
      target_type: data.targetType,
      target_id: data.targetId,
      content: data.content,
      created_by: userData.user.id,
    })
    .select('id, content, created_at')
    .single();

  if (error || !created) {
    return { ok: false, error: 'No pudimos guardar el comentario.' };
  }

  // Resolvemos display_name del autor para devolverlo al cliente +
  // armar push.
  const { data: membership } = await supabase
    .from('family_memberships')
    .select('display_name')
    .eq('user_id', userData.user.id)
    .is('deleted_at', null)
    .maybeSingle();
  const author = (membership?.display_name as string | null) ?? 'Alguien';

  // Push a la familia (excluyendo al autor).
  const targetUrl = buildTargetUrl(data.targetType, data.targetId);
  try {
    await sendPushToFamily(
      familyGroupId,
      {
        title: `${author} comentó`,
        body: data.content.slice(0, 120),
        url: targetUrl,
        tag: `comment-${data.targetType}-${data.targetId}`,
      },
      userData.user.id,
    );
  } catch {
    /* push best-effort */
  }

  // Revalidar el path del target para que los próximos renders SSR
  // muestren el comentario nuevo.
  revalidatePath(targetUrl);

  return {
    ok: true,
    comment: {
      id: created.id as string,
      targetType: data.targetType,
      targetId: data.targetId,
      content: created.content as string,
      authorUserId: userData.user.id,
      authorDisplayName: author,
      authorInitial: (author?.[0] ?? '?').toUpperCase(),
      isOwn: true,
      createdAt: created.created_at as string,
    },
  };
}

export async function deleteCommentAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof id !== 'string' || id.length === 0) {
    return { ok: false, error: 'ID inválido.' };
  }
  const supabase = await createClient();
  // biome-ignore lint/suspicious/noExplicitAny: types stale (migration 021).
  const sb = supabase as any;
  const { error } = await sb
    .from('event_comments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { ok: false, error: 'No pudimos borrar el comentario.' };
  return { ok: true };
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

/**
 * Resolvemos el family_group_id del target. Si el target no existe o no
 * pertenece a una familia visible para el caller, devolvemos null.
 *
 * v1 implementa solo 'note'. Cuando agreguemos UI para feeding/sleep/diaper/
 * milestone/media, basta con sumar los lookups.
 */
async function resolveFamilyGroupForTarget(
  supabase: Awaited<ReturnType<typeof createClient>>,
  targetType: CommentTarget,
  targetId: string,
): Promise<string | null> {
  if (targetType === 'note') {
    const { data: note } = await supabase
      .from('notes')
      .select('child_id')
      .eq('id', targetId)
      .is('deleted_at', null)
      .maybeSingle();
    if (!note?.child_id) return null;
    const { data: child } = await supabase
      .from('child_profiles')
      .select('family_group_id')
      .eq('id', note.child_id)
      .maybeSingle();
    return (child?.family_group_id as string | null) ?? null;
  }

  if (targetType === 'milestone') {
    const { data: milestone } = await supabase
      .from('medical_milestones')
      .select('family_group_id')
      .eq('id', targetId)
      .is('deleted_at', null)
      .maybeSingle();
    return (milestone?.family_group_id as string | null) ?? null;
  }

  // feeding / sleep / diaper / media — no expuestos en UI todavía.
  return null;
}

function buildTargetUrl(targetType: CommentTarget, targetId: string): string {
  switch (targetType) {
    case 'note':
      return `/notas/${targetId}`;
    case 'milestone':
      return `/cuidar/calendario/${targetId}`;
    default:
      return '/timeline';
  }
}
