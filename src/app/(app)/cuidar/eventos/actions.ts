'use server';

import { createClient } from '@/lib/supabase/server';
import {
  type CloseSleepInput,
  type DiaperEventInput,
  type FeedingEventInput,
  type SleepSessionInput,
  closeSleepSchema,
  diaperEventSchema,
  feedingEventSchema,
  sleepSessionSchema,
} from '@/lib/validators/events';
import { revalidatePath } from 'next/cache';
import { sendPushToFamily } from '../../perfil/push-actions';

/**
 * Helper para resolver display_name + family_group_id del usuario actual y
 * disparar pushes a la familia. Best-effort — nunca tira si push falla.
 */
async function notifyFamily(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  childId: string,
  payload: { title: string; body: string; url?: string; tag?: string },
): Promise<void> {
  try {
    const { data: child } = await supabase
      .from('child_profiles')
      .select('family_group_id')
      .eq('id', childId)
      .maybeSingle();
    if (!child?.family_group_id) return;
    await sendPushToFamily(child.family_group_id, payload, userId);
  } catch {
    /* push falla nunca debería bloquear el evento */
  }
}

async function getActorDisplayName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string> {
  const { data } = await supabase
    .from('family_memberships')
    .select('display_name')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle();
  return (data?.display_name as string | null) ?? 'Alguien';
}

type EventResult<TInput> =
  | { ok: true; id: string }
  | { ok: false; errors: Partial<Record<keyof TInput | 'root', string>> };

function emptyToNull<T>(v: T | undefined | ''): T | null {
  if (v === undefined || v === '') return null;
  return v as T;
}

async function getActorContext() {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return { error: 'Sesión expirada.' as const };

  const { data: child, error: childError } = await supabase
    .from('child_profiles')
    .select('id, family_group_id')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (childError || !child) {
    return { error: 'Todavía no tenés un perfil de bebé creado.' as const };
  }

  return { supabase, userId: userData.user.id, childId: child.id };
}

function flatten<T>(error: import('zod').ZodError): Partial<Record<keyof T | 'root', string>> {
  const fieldErrors = error.flatten().fieldErrors as Record<string, string[] | undefined>;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(fieldErrors)) {
    if (v?.[0]) out[k] = v[0];
  }
  return out as Partial<Record<keyof T | 'root', string>>;
}

// ============================================================================
// Sleep
// ============================================================================

export async function createSleepAction(
  input: SleepSessionInput,
): Promise<EventResult<SleepSessionInput>> {
  const parsed = sleepSessionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: flatten<SleepSessionInput>(parsed.error) };
  }

  const ctx = await getActorContext();
  if ('error' in ctx) return { ok: false, errors: { root: ctx.error } };

  const { data, error } = await ctx.supabase
    .from('sleep_sessions')
    .insert({
      child_id: ctx.childId,
      started_at: parsed.data.started_at,
      ended_at: emptyToNull(parsed.data.ended_at),
      quality: parsed.data.quality,
      is_nap: parsed.data.is_nap,
      notes: emptyToNull(parsed.data.notes),
      created_by: ctx.userId,
    })
    .select('id')
    .single();

  if (error || !data) {
    return { ok: false, errors: { root: 'No pudimos guardar el sueño.' } };
  }

  revalidatePath('/home');
  revalidatePath('/timeline');
  return { ok: true, id: data.id };
}

/**
 * Devuelve la última toma activa del bebé para "duplicar" — útil cuando
 * la familia quiere registrar una toma similar a la previa (mismo tipo
 * + lado + duración aprox). El componente cliente la usa para
 * pre-rellenar el form de FeedingQuickAdd.
 */
export async function lastFeedingAction(): Promise<
  { ok: true; feeding: FeedingEventInput | null } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const { data: child } = await supabase
    .from('child_profiles')
    .select('id')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!child?.id) {
    return { ok: true, feeding: null };
  }

  const { data, error } = await supabase
    .from('feeding_events')
    .select('type, side, duration_minutes, amount_ml, foods, reaction, notes')
    .eq('child_id', child.id)
    .is('deleted_at', null)
    .order('occurred_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { ok: false, error: 'No pudimos buscar la última toma.' };
  if (!data) return { ok: true, feeding: null };

  return {
    ok: true,
    feeding: {
      // occurred_at lo dejamos para que el cliente ponga "ahora"
      occurred_at: '',
      type: data.type as FeedingEventInput['type'],
      side: (data.side as FeedingEventInput['side']) ?? '',
      duration_minutes: (data.duration_minutes as number | null) ?? undefined,
      amount_ml: (data.amount_ml as number | null) ?? undefined,
      foods: (data.foods as string[] | null) ?? undefined,
      reaction: (data.reaction as FeedingEventInput['reaction']) ?? 'none',
      notes: (data.notes as string | null) ?? '',
    },
  };
}

/**
 * Cierra un sueño en curso (`ended_at IS NULL`). Defensa en profundidad:
 *   - Validación zod (ended > started, < 24h).
 *   - WHERE ended_at IS NULL evita reescribir un sueño ya cerrado por otro
 *     dispositivo entre el render y el submit.
 *   - RLS sigue gobernando quién puede actualizar.
 */
export async function closeSleepAction(
  id: string,
  input: CloseSleepInput,
): Promise<EventResult<CloseSleepInput>> {
  const parsed = closeSleepSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: flatten<CloseSleepInput>(parsed.error) };
  }

  const supabase = await createClient();

  const update: { ended_at: string; quality?: SleepSessionInput['quality'] } = {
    ended_at: parsed.data.ended_at,
  };
  if (parsed.data.quality) update.quality = parsed.data.quality;

  // Leemos started_at para calcular la duración antes de actualizar.
  const { data: existing } = await supabase
    .from('sleep_sessions')
    .select('id, started_at, child_id, is_nap')
    .eq('id', id)
    .is('ended_at', null)
    .is('deleted_at', null)
    .maybeSingle();

  if (!existing) {
    return { ok: false, errors: { root: 'Ese sueño ya estaba cerrado o no existe.' } };
  }

  const { data, error } = await supabase
    .from('sleep_sessions')
    .update(update)
    .eq('id', id)
    .is('ended_at', null)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();

  if (error) {
    return { ok: false, errors: { root: 'No pudimos cerrar el sueño.' } };
  }
  if (!data) {
    return { ok: false, errors: { root: 'Ese sueño ya estaba cerrado o no existe.' } };
  }

  // Push best-effort: "Mamá: Salu se despertó (1h 20min)".
  const { data: userData } = await supabase.auth.getUser();
  if (userData.user) {
    const startedAt = new Date(existing.started_at as string).getTime();
    const endedAt = new Date(parsed.data.ended_at).getTime();
    const minutes = Math.max(0, Math.round((endedAt - startedAt) / 60000));
    const dur =
      minutes < 60
        ? `${minutes} min`
        : `${Math.floor(minutes / 60)} h${minutes % 60 > 0 ? ` ${minutes % 60} min` : ''}`;
    const isNap = (existing.is_nap as boolean) ?? false;
    const author = await getActorDisplayName(supabase, userData.user.id);
    await notifyFamily(supabase, userData.user.id, existing.child_id as string, {
      title: `${author}: Salu se despertó`,
      body: `Cerró ${isNap ? 'la siesta' : 'el sueño'} de ${dur}.`,
      url: '/home',
      tag: `sleep-close-${id}`,
    });
  }

  revalidatePath('/home');
  revalidatePath('/timeline');
  return { ok: true, id: data.id };
}

// ============================================================================
// Feeding
// ============================================================================

export async function createFeedingAction(
  input: FeedingEventInput,
): Promise<EventResult<FeedingEventInput>> {
  const parsed = feedingEventSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: flatten<FeedingEventInput>(parsed.error) };
  }

  const ctx = await getActorContext();
  if ('error' in ctx) return { ok: false, errors: { root: ctx.error } };

  const { data, error } = await ctx.supabase
    .from('feeding_events')
    .insert({
      child_id: ctx.childId,
      occurred_at: parsed.data.occurred_at,
      type: parsed.data.type,
      side: emptyToNull(parsed.data.side),
      duration_minutes: parsed.data.duration_minutes ?? null,
      amount_ml: parsed.data.amount_ml ?? null,
      foods: parsed.data.foods && parsed.data.foods.length > 0 ? parsed.data.foods : null,
      reaction: parsed.data.reaction,
      notes: emptyToNull(parsed.data.notes),
      created_by: ctx.userId,
    })
    .select('id')
    .single();

  if (error || !data) {
    return { ok: false, errors: { root: 'No pudimos guardar la toma.' } };
  }

  revalidatePath('/home');
  revalidatePath('/timeline');
  return { ok: true, id: data.id };
}

// ============================================================================
// Diaper photo upload
// ============================================================================

const BUCKET = 'diaper-photos';
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB

export type UploadPhotoResult = { ok: true; path: string } | { ok: false; error: string };

/**
 * Sube una foto de pañal al bucket privado `diaper-photos`. Path con
 * convención `{family_group_id}/{child_id}/{timestamp}-{rand}.{ext}` —
 * el primer segmento permite que la RLS de Storage filtre por familia.
 *
 * Devuelve el path al objeto, o un error legible. El caller pasa este
 * path a createDiaperAction como `photo_path`.
 */
export async function uploadDiaperPhotoAction(formData: FormData): Promise<UploadPhotoResult> {
  const file = formData.get('photo');
  if (!(file instanceof File)) {
    return { ok: false, error: 'No recibimos la foto.' };
  }
  if (file.size === 0 || file.size > MAX_PHOTO_BYTES) {
    return { ok: false, error: 'La foto pesa demasiado o está vacía.' };
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    return { ok: false, error: 'Formato de imagen no soportado.' };
  }

  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return { ok: false, error: 'Sesión expirada.' };
  }

  // Resolvemos family_group_id del usuario actual. Necesario porque la
  // RLS del bucket lo requiere como primer segmento del path.
  const { data: membership } = await supabase
    .from('family_memberships')
    .select('family_group_id')
    .eq('user_id', userData.user.id)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();

  if (!membership?.family_group_id) {
    return { ok: false, error: 'No encontramos tu grupo familiar.' };
  }

  const { data: child } = await supabase
    .from('child_profiles')
    .select('id')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!child?.id) {
    return { ok: false, error: 'No hay perfil de bebé creado.' };
  }

  // Convención: family/child/timestamp-rand.ext
  const ext =
    (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `${membership.family_group_id}/${child.id}/${Date.now()}-${rand}.${ext}`;

  const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: '3600',
    upsert: false,
  });

  if (uploadErr) {
    return { ok: false, error: 'No pudimos subir la foto.' };
  }

  return { ok: true, path };
}

/**
 * Devuelve un signed URL al objeto en `diaper-photos`. Lo usamos desde el
 * cliente para abrir la foto cuando la familia hace click en "Ver foto".
 * El URL expira a los 5 minutos — suficiente para abrirlo, pero corto si
 * por alguna razón se filtra a un log.
 */
export async function getDiaperPhotoUrlAction(
  path: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (typeof path !== 'string' || path.length === 0 || path.length > 500) {
    return { ok: false, error: 'Path inválido.' };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300);
  if (error || !data?.signedUrl) {
    return { ok: false, error: 'No pudimos abrir la foto.' };
  }
  return { ok: true, url: data.signedUrl };
}

// ============================================================================
// Diaper
// ============================================================================

export async function createDiaperAction(
  input: DiaperEventInput,
): Promise<EventResult<DiaperEventInput>> {
  const parsed = diaperEventSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: flatten<DiaperEventInput>(parsed.error) };
  }

  const ctx = await getActorContext();
  if ('error' in ctx) return { ok: false, errors: { root: ctx.error } };

  // Cast: photo_analysis (migration 20260430120000) y photo_path
  // (migration 20260501100000) — los Supabase types están stale hasta
  // que regeneremos. El runtime los acepta en cuanto las migrations corran.
  const insertPayload = {
    child_id: ctx.childId,
    occurred_at: parsed.data.occurred_at,
    type: parsed.data.type,
    notes: emptyToNull(parsed.data.notes),
    photo_analysis: parsed.data.photo_analysis ?? null,
    photo_path: parsed.data.photo_path ?? null,
    created_by: ctx.userId,
  };
  const { data, error } = await ctx.supabase
    .from('diaper_events')
    // biome-ignore lint/suspicious/noExplicitAny: ver comentario sobre types stale arriba.
    .insert(insertPayload as any)
    .select('id')
    .single();

  if (error || !data) {
    return { ok: false, errors: { root: 'No pudimos guardar el pañal.' } };
  }

  // Push de alarma: si la IA marcó alarm:true en el análisis de la foto,
  // notificamos a la familia para que alguien lo mire ya.
  const photoAnalysis = parsed.data.photo_analysis as
    | { alarm?: boolean; alarm_reason?: string }
    | null
    | undefined;
  if (photoAnalysis?.alarm === true) {
    const author = await getActorDisplayName(ctx.supabase, ctx.userId);
    const reason = photoAnalysis.alarm_reason?.trim() || 'Conviene mostrar al pediatra.';
    await notifyFamily(ctx.supabase, ctx.userId, ctx.childId, {
      title: '⚠️ Pañal a revisar',
      body: `${author} subió un pañal con señal de alerta: ${reason}`,
      url: '/cuidar/panal-foto',
      tag: `diaper-alarm-${data.id}`,
    });
  }

  revalidatePath('/home');
  revalidatePath('/timeline');
  return { ok: true, id: data.id };
}

/**
 * Actualiza un pañal existente. RLS gobierna quién puede; acá solo
 * defendemos forma del input y damos un mensaje amigable si Supabase
 * rebota. Soft delete y created_by no se tocan.
 */
export async function updateDiaperAction(
  id: string,
  input: DiaperEventInput,
): Promise<EventResult<DiaperEventInput>> {
  const parsed = diaperEventSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: flatten<DiaperEventInput>(parsed.error) };
  }

  const supabase = await createClient();

  const updatePayload = {
    occurred_at: parsed.data.occurred_at,
    type: parsed.data.type,
    notes: emptyToNull(parsed.data.notes),
    photo_analysis: parsed.data.photo_analysis ?? null,
    photo_path: parsed.data.photo_path ?? null,
  };

  const { data, error } = await supabase
    .from('diaper_events')
    // biome-ignore lint/suspicious/noExplicitAny: types stale por photo_analysis (ver insert arriba).
    .update(updatePayload as any)
    .eq('id', id)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();

  if (error) {
    return { ok: false, errors: { root: 'No pudimos actualizar el pañal.' } };
  }
  if (!data) {
    return { ok: false, errors: { root: 'Ese pañal ya no existe o no podés editarlo.' } };
  }

  revalidatePath('/home');
  revalidatePath('/timeline');
  return { ok: true, id: data.id };
}

// ============================================================================
// Update — feeding + sleep
// ============================================================================

/**
 * Actualiza una toma existente. Misma forma que createFeedingAction —
 * Zod replica el CHECK del schema (coherencia type-side-amount-foods).
 */
export async function updateFeedingAction(
  id: string,
  input: FeedingEventInput,
): Promise<EventResult<FeedingEventInput>> {
  const parsed = feedingEventSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: flatten<FeedingEventInput>(parsed.error) };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('feeding_events')
    .update({
      occurred_at: parsed.data.occurred_at,
      type: parsed.data.type,
      side: emptyToNull(parsed.data.side),
      duration_minutes: parsed.data.duration_minutes ?? null,
      amount_ml: parsed.data.amount_ml ?? null,
      foods: parsed.data.foods && parsed.data.foods.length > 0 ? parsed.data.foods : null,
      reaction: parsed.data.reaction,
      notes: emptyToNull(parsed.data.notes),
    })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();

  if (error) {
    return { ok: false, errors: { root: 'No pudimos actualizar la toma.' } };
  }
  if (!data) {
    return { ok: false, errors: { root: 'Esa toma ya no existe o no podés editarla.' } };
  }

  revalidatePath('/home');
  revalidatePath('/timeline');
  return { ok: true, id: data.id };
}

/**
 * Actualiza un sueño existente. Para cerrar uno en curso seguí usando
 * closeSleepAction — esa tiene la guarda WHERE ended_at IS NULL contra
 * carreras. Esta función edita libremente cualquier campo.
 */
export async function updateSleepAction(
  id: string,
  input: SleepSessionInput,
): Promise<EventResult<SleepSessionInput>> {
  const parsed = sleepSessionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: flatten<SleepSessionInput>(parsed.error) };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('sleep_sessions')
    .update({
      started_at: parsed.data.started_at,
      ended_at: emptyToNull(parsed.data.ended_at),
      quality: parsed.data.quality,
      is_nap: parsed.data.is_nap,
      notes: emptyToNull(parsed.data.notes),
    })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();

  if (error) {
    return { ok: false, errors: { root: 'No pudimos actualizar el sueño.' } };
  }
  if (!data) {
    return { ok: false, errors: { root: 'Ese sueño ya no existe o no podés editarlo.' } };
  }

  revalidatePath('/home');
  revalidatePath('/timeline');
  return { ok: true, id: data.id };
}

// ============================================================================
// Repeat — registra al instante con los mismos datos que el último evento
// ============================================================================

/**
 * Registra una nueva toma con occurred_at = ahora y los mismos datos que
 * la última toma registrada (tipo, cantidad, duración, reacción).
 * No redirige — solo revalida para que la home refresque.
 */
export async function repeatFeedingAction(): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await getActorContext();
  if ('error' in ctx) return { ok: false, error: ctx.error ?? 'Error inesperado.' };

  const { data: last, error: fetchError } = await ctx.supabase
    .from('feeding_events')
    .select('type, side, duration_minutes, amount_ml, reaction, notes')
    .eq('child_id', ctx.childId)
    .is('deleted_at', null)
    .order('occurred_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) return { ok: false, error: 'No pudimos leer la última toma.' };
  if (!last) return { ok: false, error: 'Todavía no hay tomas para repetir.' };

  const { error: insertError } = await ctx.supabase.from('feeding_events').insert({
    child_id: ctx.childId,
    occurred_at: new Date().toISOString(),
    type: last.type,
    side: (last.side as 'left' | 'right' | 'both' | null) ?? null,
    duration_minutes: (last.duration_minutes as number | null) ?? null,
    amount_ml: (last.amount_ml as number | null) ?? null,
    reaction: last.reaction,
    notes: (last.notes as string | null) ?? null,
    created_by: ctx.userId,
  });

  if (insertError) return { ok: false, error: 'No pudimos guardar la toma.' };

  revalidatePath('/home');
  revalidatePath('/timeline');
  return { ok: true };
}

/**
 * Registra un nuevo pañal con occurred_at = ahora y el mismo tipo que
 * el último pañal registrado.
 */
export async function repeatDiaperAction(): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await getActorContext();
  if ('error' in ctx) return { ok: false, error: ctx.error ?? 'Error inesperado.' };

  const { data: last, error: fetchError } = await ctx.supabase
    .from('diaper_events')
    .select('type')
    .eq('child_id', ctx.childId)
    .is('deleted_at', null)
    .order('occurred_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) return { ok: false, error: 'No pudimos leer el último pañal.' };
  if (!last) return { ok: false, error: 'Todavía no hay pañales para repetir.' };

  const payload = {
    child_id: ctx.childId,
    occurred_at: new Date().toISOString(),
    type: last.type,
    created_by: ctx.userId,
  };
  // biome-ignore lint/suspicious/noExplicitAny: types stale (photo_analysis/photo_path en diaper_events)
  const { error: insertError } = await ctx.supabase.from('diaper_events').insert(payload as any);

  if (insertError) return { ok: false, error: 'No pudimos guardar el pañal.' };

  revalidatePath('/home');
  revalidatePath('/timeline');
  return { ok: true };
}

// ============================================================================
// Delete (genérico — recibe table name + id, RLS controla quién puede)
// ============================================================================

const ALLOWED_TABLES = ['sleep_sessions', 'feeding_events', 'diaper_events'] as const;

type EventTable = (typeof ALLOWED_TABLES)[number];

export async function deleteEventAction(
  table: EventTable,
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!ALLOWED_TABLES.includes(table)) {
    return { ok: false, error: 'Tabla no permitida.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from(table)
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    return { ok: false, error: 'No pudimos borrar el evento.' };
  }

  revalidatePath('/home');
  revalidatePath('/timeline');
  return { ok: true };
}
