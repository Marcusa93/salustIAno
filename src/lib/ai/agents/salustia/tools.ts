import 'server-only';

import type { ToolDefinition } from '@/lib/ai/types';
import type { createClient } from '@/lib/supabase/server';
import { type Proposal, proposalSchema, summarizeProposal } from './proposals';

/**
 * Contexto que SalustIA pasa a cada tool handler. El cliente Supabase es
 * el SSR del usuario actual — RLS garantiza que solo vea sus datos.
 *
 * `proposals` es un buffer side-channel: las tools propose_* lo llenan
 * y el chat loop lo lee al final para devolver las propuestas al cliente.
 * Las tools de READ nunca tocan este array.
 */
export interface ToolContext {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  childId: string | null;
  proposals: Proposal[];
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
  {
    type: 'function',
    function: {
      name: 'recall_memories',
      description:
        'Devuelve la lista de memorias persistentes que la familia te pidió recordar (obra social, pediatra, alergias, preferencias, etc.). Las memorias compartidas las ve toda la familia; las privadas sólo quien las creó. Llamala sólo si necesitás revisar memorias que NO están en tu system prompt actual (por ejemplo si el system prompt te marcó "memoria truncada"). En condiciones normales, las memorias activas ya están inyectadas y no necesitás llamarla.',
      parameters: { type: 'object', properties: {} },
    },
  },
  // ===== Tools de PROPUESTA — no escriben, solo proponen para confirmación =====
  {
    type: 'function',
    function: {
      name: 'propose_feeding',
      description:
        'Cuando la familia quiere ANOTAR una toma (no preguntar por una existente), llamá a esta tool con los datos. NO escribe nada — solo propone, y la familia confirma con un botón en el chat. Usá occurred_at en formato ISO (ej. "2026-05-01T15:30") en hora local de Argentina. Si no especifican hora, usá "ahora" (vos completás con la hora actual). Si la cantidad es ambigua, dejala vacía.',
      parameters: {
        type: 'object',
        properties: {
          occurred_at: {
            type: 'string',
            description:
              'Fecha y hora ISO local (ej. "2026-05-01T15:30"). Si dicen "hace una hora" o "ahora", calculalo vos.',
          },
          type: {
            type: 'string',
            enum: ['breastfeeding', 'bottle', 'solid'],
            description:
              'pecho, mamadera o sólido. Si la familia dice "mamadera", corresponde a "bottle".',
          },
          side: {
            type: 'string',
            enum: ['left', 'right', 'both'],
            description: 'Solo para breastfeeding. Opcional.',
          },
          duration_minutes: {
            type: 'integer',
            description: 'Solo si lo mencionan. Opcional.',
          },
          amount_ml: {
            type: 'integer',
            description: 'Solo para mamadera. Opcional.',
          },
          foods: {
            type: 'array',
            items: { type: 'string' },
            description: 'Solo para solid. Lista de alimentos. Opcional.',
          },
          reaction: {
            type: 'string',
            enum: ['none', 'mild', 'strong'],
            description: 'Si mencionan reacción. Default none.',
          },
          notes: { type: 'string', description: 'Texto libre opcional.' },
        },
        required: ['occurred_at', 'type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_sleep',
      description:
        'Cuando la familia quiere ANOTAR un sueño o siesta. Si dicen "se durmió" sin hora de despertar, dejá ended_at vacío (queda en curso). Si dicen "durmió de tal a tal hora", completá los dos. NO escribe — solo propone para confirmar.',
      parameters: {
        type: 'object',
        properties: {
          started_at: { type: 'string', description: 'ISO local (ej. "2026-05-01T14:00").' },
          ended_at: {
            type: 'string',
            description: 'ISO local. Opcional — si todavía está durmiendo, dejalo vacío.',
          },
          quality: {
            type: 'string',
            enum: ['good', 'regular', 'bad', 'unknown'],
            description: 'Cómo durmió. Default unknown.',
          },
          is_nap: {
            type: 'boolean',
            description: 'true si fue siesta corta, false para sueño largo o nocturno.',
          },
          notes: { type: 'string', description: 'Texto libre opcional.' },
        },
        required: ['started_at'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_diaper',
      description:
        'Cuando la familia quiere ANOTAR un pañal. NO escribe — solo propone para confirmar.',
      parameters: {
        type: 'object',
        properties: {
          occurred_at: {
            type: 'string',
            description: 'ISO local. Si dicen "ahora", usá la hora actual.',
          },
          type: {
            type: 'string',
            enum: ['wet', 'dirty', 'both', 'dry'],
            description: 'pis, caca, ambos o seco.',
          },
          notes: { type: 'string', description: 'Texto libre opcional. Color, consistencia, etc.' },
        },
        required: ['occurred_at', 'type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_note',
      description:
        'Cuando la familia quiere ANOTAR un momento, una preocupación o un hito vivido (primera sonrisa, primer rollo). NO confundir con turnos futuros o controles agendados — para eso usá propose_milestone. NO escribe — solo propone para confirmar.',
      parameters: {
        type: 'object',
        properties: {
          occurred_at: { type: 'string', description: 'ISO local. Default ahora.' },
          category: {
            type: 'string',
            enum: ['memory', 'observation', 'milestone', 'other'],
            description:
              'memory: recuerdo. observation: cosa observada (algo que la familia notó pero no necesariamente preocupante). milestone: hito vivido (primera sonrisa, primer rollo). other: otra cosa. Default memory.',
          },
          content: { type: 'string', description: 'El texto del momento. Obligatorio.' },
        },
        required: ['content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_memory',
      description:
        'Cuando la familia te pide explícitamente que RECUERDES algo para siempre — "anotá que mi obra social es OSDE", "recordá que es alérgico a la proteína de leche", "guardá que el pediatra de cabecera es la Dra. Belén López". Genera una propuesta que la familia confirma con un botón. Es para HECHOS PERSISTENTES que querés tener disponibles en futuros chats, no para eventos puntuales (esos van con propose_feeding/sleep/diaper/note). Mantené el content compacto y declarativo: "Obra social: OSDE", no "La obra social del bebé es OSDE y le cubre todo". Si la familia no aclaró si es privado, asumí scope="family".',
      parameters: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description:
              'Hecho a recordar, declarativo y compacto. Máximo 500 caracteres. Ejemplos: "Obra social: OSDE", "Alergia conocida: proteína de leche de vaca (APLV)", "Pediatra de cabecera: Dra. Belén López, consultorio Av. Mitre 250".',
          },
          scope: {
            type: 'string',
            enum: ['family', 'private'],
            description:
              'family: la ven todos los miembros activos de la familia (default). private: sólo la ve el user que la creó. Asumí family salvo que la familia diga "es solo para mí".',
          },
          category: {
            type: 'string',
            description:
              'Etiqueta corta opcional para futura UI: "salud", "logística", "preferencia", etc. Si no es claro, omitilo.',
          },
        },
        required: ['content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_milestone',
      description:
        'Cuando la familia te pide AGENDAR un turno médico, control, vacuna, estudio o ecografía. Ejemplos: "el viernes turno con Belen pediatra", "en dos semanas con Pato la obstetra", "vacunas de los 2 meses el 15", "ecografía morfológica el 20 a las 10 hs". NO escribe — solo propone una card de confirmación que la familia confirma con un botón. Usá due_at en ISO local AR.',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description:
              'Resumen corto del turno. Ejemplos: "Pediatra Belen", "Obstetra Pato", "Vacuna 2 meses", "Ecografía morfológica". Evitá frases largas.',
          },
          category: {
            type: 'string',
            enum: ['control_pediatrico', 'pesquisa', 'estudio', 'vacuna', 'otro'],
            description:
              'control_pediatrico: turno con pediatra. pesquisa: pesquisa neonatal o auditiva. estudio: ecografía, análisis, RMN. vacuna: aplicación de vacuna. otro: obstetra, kinesio, fonoaudiologo, cualquier otra cosa.',
          },
          due_at: {
            type: 'string',
            description:
              'Fecha y hora del turno en ISO local AR. "2026-05-08T15:00" si saben hora; "2026-05-08T00:00" si solo fecha. Para "el viernes" calculá el próximo viernes a partir del ISO actual del contexto temporal. Para "en dos semanas" sumá 14 días.',
          },
          description: {
            type: 'string',
            description:
              'Detalle opcional: dónde es, qué llevar. Ej. "consultorio Av. Mitre 250, llevar libreta sanitaria".',
          },
          notes: { type: 'string', description: 'Notas adicionales libres opcionales.' },
        },
        required: ['title', 'due_at'],
      },
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

// ============================================================================
// Handlers de PROPUESTA — no escriben, solo arman Proposal y empujan a ctx.proposals.
// El LLM ve el summary y la confirmación de "lo dejé propuesto"; la familia
// confirma desde la UI.
// ============================================================================

function proposeHandlerFor(
  kind: 'feeding' | 'sleep' | 'diaper' | 'note' | 'milestone' | 'memory',
): ToolHandler {
  return async (rawArgs, ctx) => {
    // 'milestone' y 'memory' pueden vivir sin child (turnos antes del
    // nacimiento, hechos de la familia que no atan a un bebé). El resto
    // sí necesita child_id.
    if (kind !== 'milestone' && kind !== 'memory' && !ctx.childId) {
      return jsonError(
        'Todavía no hay perfil de bebé creado. La familia tiene que crearlo desde Familia.',
      );
    }
    const candidate = { kind, ...((rawArgs ?? {}) as Record<string, unknown>) };
    const parsed = proposalSchema.safeParse(candidate);
    if (!parsed.success) {
      const reason = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      return jsonError(`Args inválidos: ${reason}`);
    }
    ctx.proposals.push(parsed.data);
    return jsonOk({
      proposed: true,
      summary: summarizeProposal(parsed.data),
      message:
        'Propuesta lista. La familia va a ver una card de confirmación abajo del mensaje. NO la des por anotada todavía — esperá la confirmación humana.',
    });
  };
}

const recallMemories: ToolHandler = async (_args, ctx) => {
  const { data: userData } = await ctx.supabase.auth.getUser();
  if (!userData.user) return jsonError('Sesión inválida.');

  const { data: membership } = await ctx.supabase
    .from('family_memberships')
    .select('family_group_id')
    .eq('user_id', userData.user.id)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();

  if (!membership?.family_group_id) {
    return jsonOk({ memories: [] });
  }

  // Types stale hasta regenerar después de aplicar la migration 022.
  // biome-ignore lint/suspicious/noExplicitAny: types stale hasta regenerar Supabase types.
  const sb = ctx.supabase as any;
  const { data, error } = await sb
    .from('family_memories')
    .select('id, content, kind, private_to_user, created_at')
    .eq('family_group_id', membership.family_group_id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    // Si la tabla todavía no existe (migration no aplicada), degradamos.
    return jsonOk({ memories: [], note: 'Memoria persistente no disponible.' });
  }

  return jsonOk({ memories: data ?? [] });
};

export const TOOL_HANDLERS: Record<string, ToolHandler> = {
  get_today_summary: getTodaySummary,
  get_child_info: getChildInfo,
  list_recent_events: listRecentEvents,
  search_care_guides: searchCareGuides,
  list_pending_milestones: listPendingMilestones,
  propose_feeding: proposeHandlerFor('feeding'),
  propose_sleep: proposeHandlerFor('sleep'),
  propose_diaper: proposeHandlerFor('diaper'),
  propose_note: proposeHandlerFor('note'),
  propose_milestone: proposeHandlerFor('milestone'),
  propose_memory: proposeHandlerFor('memory'),
  recall_memories: recallMemories,
};
