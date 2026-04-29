import 'server-only';

import type { ToolDefinition } from '@/lib/ai/types';
import type { createClient } from '@/lib/supabase/server';

/**
 * Contexto que SalustIA pasa a cada tool handler. El cliente Supabase es
 * el SSR del usuario actual — RLS garantiza que solo vea sus datos.
 */
export interface ToolContext {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  childId: string | null;
}

export type ToolHandler = (args: unknown, ctx: ToolContext) => Promise<string>;

// ============================================================================
// Definiciones (formato OpenAI/OpenRouter — JSON Schema en parameters)
// ============================================================================

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'get_today_summary',
      description:
        'Devuelve cuántas tomas, sueños y pañales se registraron hoy para el bebé. Usá esto cuando te pregunten por el día, "¿cómo va el día?", "cuántas tomas", etc.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_child_info',
      description:
        'Devuelve la info básica del bebé: nombre, fecha de nacimiento (o esperada), edad calculada, peso/talla del último control si existen, pediatra y obra social.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_recent_events',
      description:
        'Lista los últimos eventos de un tipo. Útil para preguntas como "qué fue la última toma", "cuándo durmió la siesta", "última nota".',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['feeding', 'sleep', 'diaper', 'note'],
            description: 'Tipo de evento.',
          },
          limit: {
            type: 'integer',
            description: 'Máximo número de eventos a devolver. Default 5, máximo 20.',
          },
        },
        required: ['type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_care_guides',
      description:
        'Busca en la guía de cuidado entradas por categoría o por palabras del título/contenido. Las categorías son: dormir, higiene, alimentacion, control, emergencia, otros.',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            enum: ['dormir', 'higiene', 'alimentacion', 'control', 'emergencia', 'otros'],
            description: 'Filtrar por categoría exacta. Opcional.',
          },
          query: {
            type: 'string',
            description: 'Texto a buscar dentro del título o el contenido. Opcional.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_pending_milestones',
      description:
        'Lista los hitos médicos pendientes (controles, ecografías, vacunas) ordenados por fecha. Excluye los ya completados.',
      parameters: { type: 'object', properties: {} },
    },
  },
];

// ============================================================================
// Helpers
// ============================================================================

function jsonOk(value: unknown): string {
  return JSON.stringify({ ok: true, data: value });
}

function jsonError(message: string): string {
  return JSON.stringify({ ok: false, error: message });
}

interface RecentEventsArgs {
  type?: string;
  limit?: number;
}

interface SearchCareGuidesArgs {
  category?: string;
  query?: string;
}

// ============================================================================
// Handlers
// ============================================================================

const getTodaySummary: ToolHandler = async (_args, ctx) => {
  if (!ctx.childId) {
    return jsonError('Todavía no hay perfil de bebé.');
  }
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data, error } = await ctx.supabase.rpc('get_timeline', {
    p_child_id: ctx.childId,
    p_event_types: ['feeding', 'sleep', 'diaper'],
    p_from: todayStart.toISOString(),
    p_limit: 200,
    p_offset: 0,
  });
  if (error) return jsonError(error.message);

  const rows = (data ?? []) as Array<{ event_type: string }>;
  const counts = {
    feeding: rows.filter((r) => r.event_type === 'feeding').length,
    sleep: rows.filter((r) => r.event_type === 'sleep').length,
    diaper: rows.filter((r) => r.event_type === 'diaper').length,
  };
  return jsonOk({ date: todayStart.toISOString().slice(0, 10), counts });
};

const getChildInfo: ToolHandler = async (_args, ctx) => {
  if (!ctx.childId) return jsonError('Todavía no hay perfil de bebé.');

  const { data: child, error: childError } = await ctx.supabase
    .from('child_profiles')
    .select(
      'name, birth_date, birth_time, gestational_weeks_at_birth, is_preterm, blood_type, health_insurance, pediatrician_name, pediatrician_phone, notes',
    )
    .eq('id', ctx.childId)
    .is('deleted_at', null)
    .maybeSingle();

  if (childError) return jsonError(childError.message);
  if (!child) return jsonError('No se encontró el perfil del bebé.');

  const { data: lastMeasurement } = await ctx.supabase
    .from('child_measurements')
    .select('measured_at, weight_grams, height_cm, head_circumference_cm')
    .eq('child_id', ctx.childId)
    .is('deleted_at', null)
    .order('measured_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return jsonOk({
    profile: child,
    last_measurement: lastMeasurement,
  });
};

const listRecentEvents: ToolHandler = async (rawArgs, ctx) => {
  const args = (rawArgs ?? {}) as RecentEventsArgs;
  const type = args.type;
  if (!type || !['feeding', 'sleep', 'diaper', 'note'].includes(type)) {
    return jsonError('type debe ser feeding, sleep, diaper o note.');
  }
  if (!ctx.childId) return jsonError('Todavía no hay perfil de bebé.');

  const limit = Math.min(Math.max(args.limit ?? 5, 1), 20);

  const { data, error } = await ctx.supabase.rpc('get_timeline', {
    p_child_id: ctx.childId,
    p_event_types: [type],
    p_limit: limit,
    p_offset: 0,
  });

  if (error) return jsonError(error.message);
  return jsonOk({ type, events: data ?? [] });
};

const searchCareGuides: ToolHandler = async (rawArgs, ctx) => {
  const args = (rawArgs ?? {}) as SearchCareGuidesArgs;

  let query = ctx.supabase
    .from('care_guides')
    .select('id, title, content, category, source, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(20);

  const validCategories = [
    'dormir',
    'higiene',
    'alimentacion',
    'control',
    'emergencia',
    'otros',
  ] as const;
  type CareGuideCategory = (typeof validCategories)[number];
  if (args.category && (validCategories as readonly string[]).includes(args.category)) {
    query = query.eq('category', args.category as CareGuideCategory);
  }
  if (args.query) {
    const q = args.query.replace(/[%_]/g, ' ');
    query = query.or(`title.ilike.%${q}%,content.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) return jsonError(error.message);
  return jsonOk({ guides: data ?? [] });
};

const listPendingMilestones: ToolHandler = async (_args, ctx) => {
  const { data, error } = await ctx.supabase
    .from('medical_milestones')
    .select('id, title, description, category, due_at, notes')
    .is('deleted_at', null)
    .is('completed_at', null)
    .order('due_at', { ascending: true, nullsFirst: false });

  if (error) return jsonError(error.message);
  return jsonOk({ milestones: data ?? [] });
};

export const TOOL_HANDLERS: Record<string, ToolHandler> = {
  get_today_summary: getTodaySummary,
  get_child_info: getChildInfo,
  list_recent_events: listRecentEvents,
  search_care_guides: searchCareGuides,
  list_pending_milestones: listPendingMilestones,
};
