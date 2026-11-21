'use server';

import { generateMenuSuggestions } from '@/lib/ai/agents/menu';
import type { MenuOutput } from '@/lib/ai/agents/menu';
import { AIError } from '@/lib/ai/errors';
import { babyAgeFromBirth } from '@/lib/baby-age';
import { createClient } from '@/lib/supabase/server';

export type MenuActionResult = { ok: true; result: MenuOutput } | { ok: false; error: string };

export async function getMenuSuggestionsAction(
  _prev: MenuActionResult | null,
  formData: FormData,
): Promise<MenuActionResult> {
  const ingredientes = (formData.get('ingredientes') as string | null)?.trim() ?? '';

  if (ingredientes.length < 2) {
    return { ok: false, error: 'Contame qué tenés en casa (mínimo 2 caracteres).' };
  }
  if (ingredientes.length > 500) {
    return {
      ok: false,
      error: 'La lista de ingredientes es demasiado larga (máx. 500 caracteres).',
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sesión expirada.' };

  const { data: child } = await supabase
    .from('child_profiles')
    .select('id, name, birth_date, family_group_id')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!child) return { ok: false, error: 'No encontramos el perfil del bebé.' };

  const age = babyAgeFromBirth(child.birth_date);
  if (!age) return { ok: false, error: 'No pudimos calcular la edad del bebé.' };

  try {
    const { result } = await generateMenuSuggestions(
      {
        ingredientes,
        edadMeses: age.months,
        edadDias: age.days,
        nombreBebe: child.name ?? 'el bebé',
      },
      {
        familyGroupId: child.family_group_id ?? undefined,
        childId: child.id,
        actorUserId: user.id,
      },
    );
    return { ok: true, result };
  } catch (err) {
    const msg =
      err instanceof AIError
        ? err.message
        : 'No pudimos generar las sugerencias. Intentá de nuevo.';
    return { ok: false, error: msg };
  }
}
