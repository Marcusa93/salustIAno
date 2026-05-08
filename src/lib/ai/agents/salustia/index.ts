import 'server-only';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { callLLM } from '@/lib/ai/client';
import { AIError } from '@/lib/ai/errors';
import { logStore } from '@/lib/ai/logger';
import type { ChatMessage } from '@/lib/ai/types';
import { babyAgeFromBirth } from '@/lib/baby-age';
import { createClient } from '@/lib/supabase/server';
import type { Proposal } from './proposals';
import { TOOL_DEFINITIONS, TOOL_HANDLERS, type ToolContext } from './tools';

export type { Proposal } from './proposals';
export { proposalSchema, summarizeProposal } from './proposals';

const AGENT_NAME = 'salustia';
const MODEL = 'anthropic/claude-haiku-4-5';
// v3: inyectamos perfil del bebé + memorias persistentes al system prompt.
const PROMPT_VERSION = 'salustia-v3';
const MAX_ITERATIONS = 5;
// Cota de inyección: si la familia acumula 200 memorias, no las metemos
// todas en cada turno. Cortamos por cantidad y por chars.
const MAX_INJECTED_MEMORIES = 30;
const MAX_INJECTED_MEMORIES_CHARS = 4000;

const SYSTEM_PROMPT = readFileSync(
  join(process.cwd(), 'src/lib/ai/agents/salustia/prompt.md'),
  'utf8',
);

const VOICE_BABY_PREFIX = readFileSync(
  join(process.cwd(), 'src/lib/ai/agents/salustia/voice-baby.md'),
  'utf8',
);

export type SalustiaVoice = 'assistant' | 'baby';

export interface SalustiaInput {
  /**
   * Conversación previa más el último mensaje del usuario. El agente le
   * antepone el system prompt internamente, no hay que mandárselo.
   */
  messages: ChatMessage[];
  /**
   * Persona del asistente. 'assistant' (default) habla como SalustIA
   * ayudante. 'baby' habla como Salu en primera persona, cariñoso. Las
   * tools y reglas operativas son idénticas — solo cambia la forma.
   */
  voice?: SalustiaVoice;
}

export interface SalustiaOutput {
  reply: string;
  /**
   * Lista de propuestas que SalustIA armó durante este turno. La UI las
   * muestra como cards de confirmación debajo del mensaje. Vacío si el
   * turno fue puramente de lectura.
   */
  proposals: Proposal[];
  meta: {
    model: string;
    promptVersion: string;
    iterations: number;
    totalTokens: number;
    latencyMs: number;
    toolCallsMade: string[];
  };
}

interface AgentContext {
  familyGroupId?: string;
  actorUserId?: string;
}

interface ResolvedContext {
  toolCtx: ToolContext;
  /**
   * Snippet ya formateado con datos del bebé (nombre, edad, pediatra) +
   * memorias persistentes activas. Se appendea al system prompt para que
   * el modelo no tenga que llamar `get_child_info` ni `recall_memories`
   * en cada turno.
   */
  ambientContext: string;
}

/**
 * Resuelve user, child y memoria persistente en una sola pasada. Devuelve
 * tanto el ToolContext (para tool handlers) como un snippet de "ambient
 * context" listo para inyectar al system prompt.
 *
 * Si no hay child_profile activo el agente igual responde — algunas tools
 * devolverán "no hay bebé" pero la conversación general funciona.
 *
 * Si la migration 022 (family_memories) todavía no está aplicada, el
 * fetch falla silencioso y se omite la sección de memorias — el chat
 * sigue andando como antes.
 */
async function resolveContext(): Promise<ResolvedContext> {
  const supabase = await createClient();
  const { data: userData, error } = await supabase.auth.getUser();
  if (error || !userData.user) {
    throw new AIError('config', 'Sesión no válida.');
  }

  const { data: child } = await supabase
    .from('child_profiles')
    .select(
      'id, name, birth_date, pediatrician_name, pediatrician_phone, blood_type, health_insurance, gestational_weeks_at_birth, is_preterm',
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  // Lookup del family_group para fetchar memorias compartidas.
  const { data: membership } = await supabase
    .from('family_memberships')
    .select('family_group_id')
    .eq('user_id', userData.user.id)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();

  let memories: Array<{ content: string; private: boolean }> = [];
  if (membership?.family_group_id) {
    // biome-ignore lint/suspicious/noExplicitAny: types stale hasta regenerar Supabase types con la migration 022.
    const sb = supabase as any;
    const { data, error: memErr } = await sb
      .from('family_memories')
      .select('content, kind, private_to_user, created_at')
      .eq('family_group_id', membership.family_group_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(MAX_INJECTED_MEMORIES);
    if (!memErr && Array.isArray(data)) {
      memories = (data as Array<{ content: string; private_to_user: string | null }>).map((m) => ({
        content: m.content,
        private: m.private_to_user !== null,
      }));
    }
  }

  return {
    toolCtx: {
      supabase,
      userId: userData.user.id,
      childId: child?.id ?? null,
      proposals: [],
    },
    ambientContext: buildAmbientContext(child, memories),
  };
}

interface ChildSnapshot {
  name: string;
  birth_date: string | null;
  pediatrician_name: string | null;
  pediatrician_phone: string | null;
  blood_type: string | null;
  health_insurance: string | null;
  gestational_weeks_at_birth: number | null;
  is_preterm: boolean | null;
}

function buildAmbientContext(
  child: ChildSnapshot | null,
  memories: ReadonlyArray<{ content: string; private: boolean }>,
): string {
  const sections: string[] = [];

  if (child) {
    const lines: string[] = [`- Nombre: ${child.name}`];
    if (child.birth_date) {
      const age = babyAgeFromBirth(child.birth_date);
      if (age) {
        lines.push(
          age.unborn
            ? `- Fecha esperada: ${child.birth_date} (todavía no nació, ${age.label.toLowerCase()})`
            : `- Edad: ${age.label} (nacido el ${child.birth_date})`,
        );
      } else {
        lines.push(`- Fecha de nacimiento: ${child.birth_date}`);
      }
    }
    if (child.is_preterm && child.gestational_weeks_at_birth !== null) {
      lines.push(`- Prematuro (${child.gestational_weeks_at_birth} semanas de gestación)`);
    }
    if (child.pediatrician_name) {
      const phone = child.pediatrician_phone ? ` (${child.pediatrician_phone})` : '';
      lines.push(`- Pediatra: ${child.pediatrician_name}${phone}`);
    }
    if (child.health_insurance) {
      lines.push(`- Obra social: ${child.health_insurance}`);
    }
    if (child.blood_type) {
      lines.push(`- Grupo sanguíneo: ${child.blood_type}`);
    }
    sections.push(['## Acerca del bebé (ya lo sabés, no preguntes)', '', ...lines].join('\n'));
  }

  if (memories.length > 0) {
    let totalChars = 0;
    const used: string[] = [];
    for (const m of memories) {
      const line = `- ${m.content}${m.private ? ' (privado tuyo)' : ''}`;
      if (totalChars + line.length > MAX_INJECTED_MEMORIES_CHARS) break;
      used.push(line);
      totalChars += line.length;
    }
    const truncated = used.length < memories.length;
    const header = truncated
      ? `## Memoria persistente (${used.length} de ${memories.length}; resto disponible vía recall_memories)`
      : '## Memoria persistente (estos hechos los recordás siempre)';
    sections.push([header, '', ...used].join('\n'));
  }

  return sections.length > 0 ? sections.join('\n\n') : '';
}

/**
 * Loop principal del chat con SalustIA.
 *
 * Antepone el system prompt, llama al LLM con tools disponibles, ejecuta
 * cada tool call que el modelo proponga, vuelve a llamar al LLM con los
 * resultados anexados, y repite hasta que el modelo devuelva una respuesta
 * en texto plano (sin más tool calls) o se llegue al máximo de iteraciones.
 *
 * Persiste un log por turno en `ai_logs` con metadata (sin contenido), para
 * que después podamos auditar uso y latencia. Si una iteración falla, el
 * error se registra y se re-tira para que el caller lo vea.
 */
export async function chat(
  input: SalustiaInput,
  context: AgentContext = {},
): Promise<SalustiaOutput> {
  const startedAt = Date.now();
  const voice: SalustiaVoice = input.voice ?? 'assistant';
  const agentLabel = voice === 'baby' ? `${AGENT_NAME}-baby` : AGENT_NAME;

  let toolCtx: ToolContext;
  let ambientContext = '';
  try {
    const resolved = await resolveContext();
    toolCtx = resolved.toolCtx;
    ambientContext = resolved.ambientContext;
  } catch (err) {
    await logStore.record({
      agent: agentLabel,
      model: MODEL,
      promptVersion: PROMPT_VERSION,
      error: err instanceof Error ? err.message : 'unknown',
      familyGroupId: context.familyGroupId ?? null,
      actorUserId: context.actorUserId ?? null,
    });
    throw err;
  }

  // Anchor temporal — le pasamos al modelo la fecha y hora ACTUAL de
  // Argentina explícita. Sin esto, el LLM tiene que adivinar:
  //   - El día (puede agarrar uno cacheado del entrenamiento).
  //   - AM/PM cuando el usuario dice "12:50" sin contexto.
  //   - "Hace una hora" o "ahora mismo" sin fecha referente.
  // Con el anchor inyectado al system, el modelo puede calcular bien y
  // los timestamps que genera se acercan mucho más a lo que la familia
  // espera. NO es timezone math — es solo dar contexto al LLM.
  const nowAr = new Date();
  const arDateTime = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(nowAr);
  const arIsoLocal = (() => {
    // Construimos "YYYY-MM-DDTHH:mm" en hora AR para que el modelo lo
    // copie tal cual al generar occurred_at sin tener que calcular.
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(nowAr);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
  })();
  const timeAnchor = [
    '## Contexto temporal (no se lo digas al usuario salvo que pregunte)',
    '',
    `- Hora actual de Argentina: ${arDateTime}`,
    `- ISO local AR para usar en occurred_at: ${arIsoLocal}`,
    '- Si el usuario dice "ahora", "recién", "ya": usá exactamente este ISO.',
    '- Si dice "hace X minutos/horas": restá X al ISO actual.',
    '- Si dice solo una hora (ej. "12:50"): asumí que es de HOY si esa hora ya pasó. Si todavía no llegó esa hora hoy (ej. son las 10 y dice "15:30"), preguntá si fue ayer o si es para más tarde. NO interpretes 12-horas: en AR siempre se usa formato 24-horas.',
    '- El sistema convierte tu ISO a UTC automáticamente. Vos siempre escribís en hora AR sin sufijo.',
  ].join('\n');

  const ambientBlock = ambientContext ? `\n\n---\n\n${ambientContext}` : '';
  const systemContent =
    voice === 'baby'
      ? `${VOICE_BABY_PREFIX}\n\n---\n\n${SYSTEM_PROMPT}\n\n---\n\n${timeAnchor}${ambientBlock}`
      : `${SYSTEM_PROMPT}\n\n---\n\n${timeAnchor}${ambientBlock}`;
  const messages: ChatMessage[] = [{ role: 'system', content: systemContent }, ...input.messages];

  const toolCallsMade: string[] = [];
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let lastModel = MODEL;

  try {
    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      const response = await callLLM({
        model: MODEL,
        messages,
        temperature: 0.4,
        maxTokens: 1024,
        tools: TOOL_DEFINITIONS,
      });

      totalPromptTokens += response.usage.promptTokens;
      totalCompletionTokens += response.usage.completionTokens;
      lastModel = response.model;

      // Sin tool calls → respuesta final.
      if (response.toolCalls.length === 0) {
        const totalTokens = totalPromptTokens + totalCompletionTokens;
        const latencyMs = Date.now() - startedAt;

        await logStore.record({
          agent: agentLabel,
          model: lastModel,
          promptVersion: PROMPT_VERSION,
          promptTokens: totalPromptTokens,
          completionTokens: totalCompletionTokens,
          latencyMs,
          familyGroupId: context.familyGroupId ?? null,
          actorUserId: context.actorUserId ?? null,
        });

        return {
          reply: response.content || '',
          proposals: toolCtx.proposals,
          meta: {
            model: lastModel,
            promptVersion: PROMPT_VERSION,
            iterations: iter + 1,
            totalTokens,
            latencyMs,
            toolCallsMade,
          },
        };
      }

      // Append assistant message con tool_calls.
      messages.push({
        role: 'assistant',
        content: response.content || null,
        tool_calls: response.toolCalls,
      });

      // Ejecutamos cada tool call y appendeamos su resultado.
      for (const call of response.toolCalls) {
        const handler = TOOL_HANDLERS[call.function.name];
        if (!handler) {
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            name: call.function.name,
            content: JSON.stringify({
              ok: false,
              error: `Tool desconocida: ${call.function.name}`,
            }),
          });
          continue;
        }

        toolCallsMade.push(call.function.name);
        let parsedArgs: unknown = {};
        try {
          parsedArgs = JSON.parse(call.function.arguments || '{}');
        } catch {
          // argumentos malformados — el handler recibe {} y se queja.
        }

        try {
          const result = await handler(parsedArgs, toolCtx);
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            name: call.function.name,
            content: result,
          });
        } catch (err) {
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            name: call.function.name,
            content: JSON.stringify({
              ok: false,
              error: err instanceof Error ? err.message : 'tool failed',
            }),
          });
        }
      }
    }

    // Si llegamos acá, MAX_ITERATIONS sin respuesta final.
    throw new AIError('provider', 'El asistente se enroscó y no pudo terminar la respuesta.');
  } catch (err) {
    await logStore.record({
      agent: agentLabel,
      model: lastModel,
      promptVersion: PROMPT_VERSION,
      error: err instanceof Error ? err.message : 'unknown',
      familyGroupId: context.familyGroupId ?? null,
      actorUserId: context.actorUserId ?? null,
    });
    throw err;
  }
}
