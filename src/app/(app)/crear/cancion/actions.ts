'use server';

import { generateLullaby, lullabyInputSchema } from '@/lib/ai/agents';
import { lullabyOutputSchema } from '@/lib/ai/agents/lullaby-schema';
import { generateLullabyAudio } from '@/lib/ai/audio/lullaby-audio';
import {
  AIConfigError,
  AIGuardrailError,
  AINetworkError,
  AIParseError,
  AIProviderError,
  AIValidationError,
} from '@/lib/ai/errors';
import { logStore } from '@/lib/ai/logger';
import { createClient } from '@/lib/supabase/server';
import type { LullabyFormState } from './shared';

/**
 * Server Action que recibe el input del form, valida con el mismo schema
 * Zod del agente y delega a `generateLullaby`. Mapea cada error a un
 * mensaje rioplatense para el toast del cliente.
 *
 * Nunca tira: siempre devuelve un `LullabyFormState` discriminado.
 */
export async function createLullabyAction(input: unknown): Promise<LullabyFormState> {
  const parsed = lullabyInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: 'error',
      error: { type: 'validation', message: 'Revisá los datos del formulario.' },
    };
  }

  try {
    const result = await generateLullaby(parsed.data);
    return {
      status: 'success',
      lullaby: result.output,
      meta: {
        model: result.meta.model,
        tokens: result.meta.tokens,
        latencyMs: result.meta.latencyMs,
        promptVersion: result.meta.promptVersion,
      },
    };
  } catch (err) {
    if (err instanceof AIValidationError) {
      return {
        status: 'error',
        error: { type: 'validation', message: 'Revisá los datos del formulario.' },
      };
    }
    if (err instanceof AIConfigError) {
      return {
        status: 'error',
        error: { type: 'config', message: 'Falta configurar el modelo de IA. Avisale al admin.' },
      };
    }
    if (err instanceof AINetworkError) {
      return {
        status: 'error',
        error: {
          type: 'network',
          message: 'No pudimos conectar con la IA. Probá de nuevo en un rato.',
        },
      };
    }
    if (err instanceof AIProviderError) {
      return {
        status: 'error',
        error: { type: 'provider', message: 'El generador tuvo un problema. Intentá de nuevo.' },
      };
    }
    if (err instanceof AIParseError) {
      return {
        status: 'error',
        error: {
          type: 'parse',
          message: 'La canción no vino como esperábamos. Probá generar otra vez.',
        },
      };
    }
    if (err instanceof AIGuardrailError) {
      return {
        status: 'error',
        error: {
          type: 'guardrail',
          message: 'La canción no pasó nuestros filtros. Generamos otra.',
        },
      };
    }
    return {
      status: 'error',
      error: { type: 'provider', message: 'Algo salió mal generando la canción. Probá de nuevo.' },
    };
  }
}

export type GenerateAudioResult =
  | { ok: true; audioUrl: string; lullabyId: string; latencyMs: number }
  | {
      ok: false;
      error: { type: 'config' | 'network' | 'provider' | 'validation'; message: string };
    };

const LULLABIES_BUCKET = 'lullabies';

/**
 * Genera audio para la nana, descarga el MP3 del CDN AIMLAPI y lo
 * persiste en Supabase Storage + tabla `lullabies`. Devuelve un signed
 * URL que el cliente puede reproducir.
 *
 * El motivo de persistir end-to-end aquí es que el URL de AIMLAPI expira
 * en horas — si la familia quiere escuchar la nana mañana, necesita
 * estar en Storage propio. Cada generación cuesta ~$0.04 USD; persistir
 * elimina re-generaciones.
 */
export async function generateLullabyAudioAction(
  rawLullaby: unknown,
): Promise<GenerateAudioResult> {
  const parsed = lullabyOutputSchema.safeParse(rawLullaby);
  if (!parsed.success) {
    return {
      ok: false,
      error: { type: 'validation', message: 'La canción no se reconoce. Generá una nueva.' },
    };
  }

  // Resolver user + family + child. El child es opcional — si todavía
  // no nació o no se creó el perfil, generamos el audio igual y
  // devolvemos URL temporal sin persistir en biblioteca.
  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return { ok: false, error: { type: 'validation', message: 'Sesión expirada.' } };
  }

  const { data: membership } = await supabase
    .from('family_memberships')
    .select('family_group_id')
    .eq('user_id', userData.user.id)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();

  const { data: child } = await supabase
    .from('child_profiles')
    .select('id')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  // Si falta family o child, no persistimos pero igual generamos.
  const canPersist = !!membership?.family_group_id && !!child?.id;

  try {
    // 1. Generar audio en AIMLAPI (paga aquí — pase lo que pase).
    const audio = await generateLullabyAudio(parsed.data, {
      actorUserId: userData.user.id,
      childId: (child?.id as string | undefined) ?? null,
    });

    // Si no podemos persistir (sin perfil aún), devolvemos URL temporal
    // del CDN. Expira en horas, pero la familia escucha la canción ahora
    // y cuando creen el perfil pueden generar de nuevo y queda en biblioteca.
    if (!canPersist) {
      return {
        ok: true,
        audioUrl: audio.audioUrl,
        lullabyId: '',
        latencyMs: audio.meta.latencyMs,
      };
    }

    // 2. Descargar el MP3 del CDN antes de que expire.
    const audioResponse = await fetch(audio.audioUrl);
    if (!audioResponse.ok) {
      throw new AIProviderError(audioResponse.status, 'No pudimos descargar el audio generado.');
    }
    const audioBlob = await audioResponse.blob();
    const audioBuffer = await audioBlob.arrayBuffer();

    // 3. Subir a Supabase Storage en {family}/{child}/{ts}-{rand}.mp3.
    const rand = Math.random().toString(36).slice(2, 8);
    const path = `${membership?.family_group_id}/${child?.id}/${Date.now()}-${rand}.mp3`;
    const { error: uploadErr } = await supabase.storage
      .from(LULLABIES_BUCKET)
      .upload(path, audioBuffer, {
        contentType: 'audio/mpeg',
        cacheControl: '31536000', // 1 año — el contenido es inmutable.
        upsert: false,
      });

    if (uploadErr) {
      await logStore.record({
        agent: 'lullaby-persist',
        model: '-',
        promptVersion: 'lullaby-persist-v1',
        error: `storage upload failed: ${uploadErr.message}`,
        actorUserId: userData.user.id,
        childId: (child?.id as string | undefined) ?? null,
      });
      // La nana se generó pero no se persistió. Devolvemos el URL temporal
      // para que la familia pueda al menos escucharla esta vez.
      return {
        ok: true,
        audioUrl: audio.audioUrl,
        lullabyId: '',
        latencyMs: audio.meta.latencyMs,
      };
    }

    // 4. Insertar fila en lullabies. Cast por types stale.
    // biome-ignore lint/suspicious/noExplicitAny: types stale hasta regenerar.
    const sb = supabase as any;
    const { data: row, error: insertErr } = await sb
      .from('lullabies')
      .insert({
        child_id: child?.id,
        family_group_id: membership?.family_group_id,
        title: parsed.data.title,
        intro: parsed.data.intro,
        verses: parsed.data.verses,
        chorus: parsed.data.chorus,
        closing: parsed.data.closing,
        mood: parsed.data.mood,
        audio_path: path,
        generation_meta: audio.meta,
        created_by: userData.user.id,
      })
      .select('id')
      .single();

    if (insertErr || !row) {
      await logStore.record({
        agent: 'lullaby-persist',
        model: '-',
        promptVersion: 'lullaby-persist-v1',
        error: `insert failed: ${insertErr?.message ?? 'unknown'}`,
        actorUserId: userData.user.id,
        childId: (child?.id as string | undefined) ?? null,
      });
      // Mismo fallback: ya tenemos el audio en Storage, solo falta la fila.
      // Devolvemos el URL temporal del CDN para esta sesión.
      return {
        ok: true,
        audioUrl: audio.audioUrl,
        lullabyId: '',
        latencyMs: audio.meta.latencyMs,
      };
    }

    // 5. Generar signed URL desde Supabase para reproducción inmediata.
    const { data: signed } = await supabase.storage
      .from(LULLABIES_BUCKET)
      .createSignedUrl(path, 3600);

    return {
      ok: true,
      audioUrl: signed?.signedUrl ?? audio.audioUrl,
      lullabyId: row.id as string,
      latencyMs: audio.meta.latencyMs,
    };
  } catch (err) {
    if (err instanceof AIConfigError) {
      return {
        ok: false,
        error: { type: 'config', message: 'Falta configurar AIMLAPI. Avisale al admin.' },
      };
    }
    if (err instanceof AINetworkError) {
      return {
        ok: false,
        error: { type: 'network', message: 'No pudimos conectar con el generador de audio.' },
      };
    }
    if (err instanceof AIProviderError) {
      return { ok: false, error: { type: 'provider', message: err.message } };
    }
    return {
      ok: false,
      error: { type: 'provider', message: 'Algo salió mal generando el audio. Probá de nuevo.' },
    };
  }
}

// ============================================================================
// Biblioteca — listado + signed URLs + delete
// ============================================================================

export interface LullabyLibraryEntry {
  id: string;
  title: string;
  intro: string;
  verses: string[];
  chorus: string;
  closing: string;
  mood: 'dulce' | 'jugueton' | 'calmo' | 'valiente';
  audioPath: string | null;
  createdAt: string;
}

/**
 * Devuelve la biblioteca de canciones del usuario actual (filtro por
 * familia vía RLS). Sin signed URLs: las generamos sólo cuando se
 * reproduce, igual que con las fotos de pañal.
 */
export async function listLullabiesAction(): Promise<LullabyLibraryEntry[]> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];

  // biome-ignore lint/suspicious/noExplicitAny: types stale.
  const sb = supabase as any;
  const { data, error } = await sb
    .from('lullabies')
    .select('id, title, intro, verses, chorus, closing, mood, audio_path, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(60);

  if (error || !data) return [];

  return (data as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    title: r.title as string,
    intro: r.intro as string,
    verses: (r.verses as string[]) ?? [],
    chorus: (r.chorus as string) ?? '',
    closing: (r.closing as string) ?? '',
    mood: r.mood as LullabyLibraryEntry['mood'],
    audioPath: (r.audio_path as string | null) ?? null,
    createdAt: r.created_at as string,
  }));
}

export async function getLullabyAudioUrlAction(
  audioPath: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (typeof audioPath !== 'string' || audioPath.length === 0 || audioPath.length > 500) {
    return { ok: false, error: 'Path inválido.' };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(LULLABIES_BUCKET)
    .createSignedUrl(audioPath, 3600);
  if (error || !data?.signedUrl) {
    return { ok: false, error: 'No pudimos abrir la canción.' };
  }
  return { ok: true, url: data.signedUrl };
}

export async function shareLullabyAction(
  id: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (typeof id !== 'string' || id.length === 0) {
    return { ok: false, error: 'ID inválido.' };
  }
  const supabase = await createClient();
  const token = generateShareToken();
  // biome-ignore lint/suspicious/noExplicitAny: types stale.
  const sb = supabase as any;
  const { error } = await sb
    .from('lullabies')
    .update({ share_token: token, shared_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { ok: false, error: 'No pudimos generar el link.' };
  return {
    ok: true,
    url: `/compartir/cancion/${token}`,
  };
}

export async function revokeLullabyShareAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  // biome-ignore lint/suspicious/noExplicitAny: types stale.
  const sb = supabase as any;
  const { error } = await sb
    .from('lullabies')
    .update({ share_token: null, shared_at: null })
    .eq('id', id);
  if (error) return { ok: false, error: 'No pudimos revocar el link.' };
  return { ok: true };
}

function generateShareToken(): string {
  // 32 chars alfanuméricos. URL-safe, ~190 bits de entropía.
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

export async function deleteLullabyAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof id !== 'string' || id.length === 0) {
    return { ok: false, error: 'ID inválido.' };
  }
  const supabase = await createClient();
  // biome-ignore lint/suspicious/noExplicitAny: types stale.
  const sb = supabase as any;
  const { error } = await sb
    .from('lullabies')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return { ok: false, error: 'No pudimos borrar la canción.' };
  return { ok: true };
}
