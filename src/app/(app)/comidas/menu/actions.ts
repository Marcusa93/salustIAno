'use server';

import { SOLIDS_MENU_AGENT, generateSolidsMenu } from '@/lib/ai/agents/solids-menu';
import {
  AIConfigError,
  AIGuardrailError,
  AINetworkError,
  AIParseError,
  AIProviderError,
  AIValidationError,
} from '@/lib/ai/errors';
import { logStore } from '@/lib/ai/logger';
import { babyAgeFromBirth } from '@/lib/baby-age';
import { loadSolidMeals } from '@/lib/solids/load';
import { type ValidatedMenu, buildMenuInput, validateMenu } from '@/lib/solids/menu';
import { createClient } from '@/lib/supabase/server';

/** Menús por familia en 24 h. Generoso para "Rehacer", corto para no quemar tokens. */
const DAILY_LIMIT = 10;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Antes de esto no hay menú: los sólidos arrancan alrededor de los 6 meses. */
const MIN_AGE_MONTHS = 4;
const MAX_AGE_MONTHS = 36;

export type MenuErrorType =
  | 'auth'
  | 'no_child'
  | 'too_young'
  | 'rate_limit'
  | 'config'
  | 'network'
  | 'provider'
  | 'parse'
  | 'guardrail'
  | 'validation';

export type GenerateMenuResult =
  | { ok: true; result: ValidatedMenu; generatedAt: string }
  | { ok: false; error: { type: MenuErrorType; message: string } };

function fail(type: MenuErrorType, message: string): GenerateMenuResult {
  return { ok: false, error: { type, message } };
}

/**
 * ¿La familia ya armó muchos menús hoy? Cuenta en `ai_logs` (lo escribe el
 * agente en cada intento) para no sumar tablas. Si no se puede leer, deja
 * pasar: el límite es un freno de costos, no de seguridad.
 */
async function overDailyLimit(familyGroupId: string): Promise<boolean> {
  try {
    const recent = await logStore.list({
      agent: SOLIDS_MENU_AGENT,
      familyGroupId,
      limit: DAILY_LIMIT,
    });
    const since = Date.now() - DAY_MS;
    return recent.filter((entry) => Date.parse(entry.createdAt) >= since).length >= DAILY_LIMIT;
  } catch {
    return false;
  }
}

/**
 * Arma el menú de la semana con IA y lo pasa por `validateMenu` antes de
 * devolverlo. No persiste nada: el cliente guarda el último en localStorage.
 *
 * Nunca tira: siempre devuelve un resultado discriminado con un mensaje
 * amable para mostrar tal cual.
 */
export async function generateSolidsMenuAction(): Promise<GenerateMenuResult> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return fail('auth', 'Se venció la sesión. Volvé a entrar y probá de nuevo.');
  }

  const { data: child } = await supabase
    .from('child_profiles')
    .select('id, birth_date, family_group_id')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!child) return fail('no_child', 'Primero creá el perfil del bebé.');

  const now = new Date();
  const age = babyAgeFromBirth(child.birth_date, now);
  const ageMonths = age && !age.unborn ? age.months : 6;
  if (ageMonths < MIN_AGE_MONTHS) {
    return fail(
      'too_young',
      'Todavía es chiquito para sólidos: arrancan alrededor de los 6 meses, cuando lo indique la pediatra.',
    );
  }

  if (await overDailyLimit(child.family_group_id)) {
    return fail('rate_limit', 'Hoy ya armaron varios menús. Mañana podés pedir otro.');
  }

  const { meals } = await loadSolidMeals(supabase, child.id);
  const { input, history } = buildMenuInput(meals, {
    ageMonths: Math.min(ageMonths, MAX_AGE_MONTHS),
    now,
  });

  try {
    const { output } = await generateSolidsMenu(input, {
      familyGroupId: child.family_group_id,
      childId: child.id,
      actorUserId: userData.user.id,
    });
    return { ok: true, result: validateMenu(output, history), generatedAt: now.toISOString() };
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[generateSolidsMenuAction] generateSolidsMenu failed:', err);
    }
    if (err instanceof AIValidationError) {
      return fail('validation', 'No pudimos leer bien lo que anotaron. Probá de nuevo.');
    }
    if (err instanceof AIConfigError) {
      return fail('config', 'Falta configurar la IA. Avisale al admin.');
    }
    if (err instanceof AINetworkError) {
      return fail('network', 'No pudimos conectar con la IA. Probá de nuevo en un rato.');
    }
    if (err instanceof AIProviderError) {
      return fail('provider', 'La IA tuvo un problema armando el menú. Probá de nuevo.');
    }
    if (err instanceof AIParseError) {
      return fail('parse', 'El menú no vino como esperábamos. Probá armarlo otra vez.');
    }
    if (err instanceof AIGuardrailError) {
      return fail('guardrail', 'El menú no pasó nuestros filtros de seguridad. Probá rehacerlo.');
    }
    return fail('provider', 'Algo salió mal armando el menú. Probá de nuevo.');
  }
}
