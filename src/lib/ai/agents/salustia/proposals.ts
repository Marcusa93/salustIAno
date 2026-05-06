/**
 * Tipos y schemas de "propuestas" — la pieza central del Slice 2 de SalustIA.
 *
 * Cuando el modelo entiende que la familia quiere anotar algo (toma, sueño,
 * pañal, momento), no escribe directamente en la base de datos. En su lugar
 * llama a una tool `propose_*` que devuelve un objeto Proposal validado.
 * El agente acumula esos Proposal y los devuelve junto al texto de
 * respuesta. La UI del chat muestra cards "voy a anotar X — ¿confirmás?"
 * con botones; recién al confirmar el cliente llama a executeProposalAction
 * y ahí sí se hace el INSERT.
 *
 * Por qué esta indirección:
 *   - Defensa en profundidad contra alucinaciones del LLM. Si el modelo
 *     se confunde con cantidades, horas o tipos, la familia ve la
 *     propuesta antes de que afecte al timeline.
 *   - Sin Proposal vacíos: cada uno se valida con su Zod schema acá.
 *   - Trazabilidad: cada propuesta y cada confirmación se loguean por
 *     separado en ai_logs (acción del LLM vs decisión humana).
 */

import { z } from 'zod';

import {
  breastSideEnum,
  diaperTypeEnum,
  feedingReactionEnum,
  feedingTypeEnum,
  sleepQualityEnum,
} from '@/lib/validators/events';
import { milestoneCategoryEnum } from '@/lib/validators/milestone';

const isoOrLocalDateTime = z
  .string()
  .min(1, 'occurred_at requerido')
  .refine((s) => !Number.isNaN(Date.parse(s)), 'fecha/hora inválida');

export const feedingProposalSchema = z
  .object({
    kind: z.literal('feeding'),
    occurred_at: isoOrLocalDateTime,
    type: feedingTypeEnum,
    side: breastSideEnum.optional(),
    duration_minutes: z.number().int().min(0).max(180).optional(),
    amount_ml: z.number().int().min(0).max(1000).optional(),
    foods: z.array(z.string().min(1).max(100)).max(20).optional(),
    reaction: feedingReactionEnum.default('none'),
    notes: z.string().max(2000).optional(),
  })
  .superRefine((data, ctx) => {
    // Misma coherencia que el CHECK de feeding_events_type_consistency.
    if (data.type === 'breastfeeding') {
      if (data.amount_ml !== undefined) {
        ctx.addIssue({ code: 'custom', path: ['amount_ml'], message: 'sin ml en pecho' });
      }
      if (data.foods?.length) {
        ctx.addIssue({ code: 'custom', path: ['foods'], message: 'sin sólidos en pecho' });
      }
    } else if (data.type === 'bottle') {
      if (data.side) {
        ctx.addIssue({ code: 'custom', path: ['side'], message: 'sin lado en mamadera' });
      }
      if (data.foods?.length) {
        ctx.addIssue({ code: 'custom', path: ['foods'], message: 'sin sólidos en mamadera' });
      }
    } else if (data.type === 'solid') {
      if (data.side || data.duration_minutes !== undefined || data.amount_ml !== undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['type'],
          message: 'solid no acepta side, duration ni ml',
        });
      }
    }
  });

export const sleepProposalSchema = z
  .object({
    kind: z.literal('sleep'),
    started_at: isoOrLocalDateTime,
    ended_at: isoOrLocalDateTime.optional(),
    quality: sleepQualityEnum.default('unknown'),
    is_nap: z.boolean().default(false),
    notes: z.string().max(2000).optional(),
  })
  .refine((d) => !d.ended_at || new Date(d.ended_at).getTime() > new Date(d.started_at).getTime(), {
    message: 'ended_at debe ser posterior a started_at',
    path: ['ended_at'],
  })
  .refine(
    (d) => {
      if (!d.ended_at) return true;
      return (
        new Date(d.ended_at).getTime() - new Date(d.started_at).getTime() < 24 * 60 * 60 * 1000
      );
    },
    { message: 'sueño mayor a 24h no es razonable', path: ['ended_at'] },
  );

export const diaperProposalSchema = z.object({
  kind: z.literal('diaper'),
  occurred_at: isoOrLocalDateTime,
  type: diaperTypeEnum,
  notes: z.string().max(2000).optional(),
});

export const noteProposalSchema = z.object({
  kind: z.literal('note'),
  occurred_at: isoOrLocalDateTime.optional(),
  // Mismas categorías que noteCategoryEnum en validators/note.ts.
  category: z.enum(['memory', 'observation', 'milestone', 'other']).default('memory'),
  content: z.string().min(1).max(5000),
});

/**
 * Propuesta de hito médico — turno con pediatra, vacuna, ecografía,
 * estudio, control. due_at es la fecha del turno (ISO local AR). El
 * agent puede pasar solo fecha "2026-05-08" o fecha+hora
 * "2026-05-08T15:00" — la app trata el hito por día.
 */
export const milestoneProposalSchema = z.object({
  kind: z.literal('milestone'),
  title: z.string().min(1).max(200),
  category: milestoneCategoryEnum.default('otro'),
  due_at: isoOrLocalDateTime,
  description: z.string().max(2000).optional(),
  notes: z.string().max(5000).optional(),
});

export const proposalSchema = z.discriminatedUnion('kind', [
  feedingProposalSchema,
  sleepProposalSchema,
  diaperProposalSchema,
  noteProposalSchema,
  milestoneProposalSchema,
]);

export type FeedingProposal = z.infer<typeof feedingProposalSchema>;
export type SleepProposal = z.infer<typeof sleepProposalSchema>;
export type DiaperProposal = z.infer<typeof diaperProposalSchema>;
export type NoteProposal = z.infer<typeof noteProposalSchema>;
export type MilestoneProposal = z.infer<typeof milestoneProposalSchema>;
export type Proposal = z.infer<typeof proposalSchema>;

/**
 * Resumen humano de un Proposal — usado por el LLM como tool result y por
 * la UI como subtítulo de la card de confirmación. Castellano rioplatense.
 */
export function summarizeProposal(p: Proposal): string {
  switch (p.kind) {
    case 'feeding': {
      const parts: string[] = [];
      if (p.type === 'breastfeeding') {
        parts.push('Pecho');
        if (p.side)
          parts.push(p.side === 'left' ? 'izquierdo' : p.side === 'right' ? 'derecho' : 'ambos');
        if (p.duration_minutes) parts.push(`${p.duration_minutes} min`);
      } else if (p.type === 'bottle') {
        parts.push('Mamadera');
        if (p.amount_ml) parts.push(`${p.amount_ml} ml`);
        if (p.duration_minutes) parts.push(`${p.duration_minutes} min`);
      } else if (p.type === 'solid') {
        parts.push('Sólidos');
        if (p.foods?.length) parts.push(p.foods.join(', '));
      }
      return parts.join(' · ');
    }
    case 'sleep': {
      const parts: string[] = [p.is_nap ? 'Siesta' : 'Sueño'];
      const start = new Date(p.started_at).toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      parts.push(`empezó ${start}`);
      if (p.ended_at) {
        const end = new Date(p.ended_at).toLocaleTimeString('es-AR', {
          hour: '2-digit',
          minute: '2-digit',
        });
        parts.push(`hasta ${end}`);
      }
      return parts.join(' · ');
    }
    case 'diaper': {
      const labels: Record<typeof p.type, string> = {
        wet: 'pis',
        dirty: 'caca',
        both: 'pis + caca',
        dry: 'seco',
      };
      return `Pañal — ${labels[p.type]}`;
    }
    case 'note':
      return `Nota: ${p.content.slice(0, 60)}${p.content.length > 60 ? '…' : ''}`;
    case 'milestone': {
      const labels: Record<z.infer<typeof milestoneCategoryEnum>, string> = {
        control_pediatrico: 'Control',
        pesquisa: 'Pesquisa',
        estudio: 'Estudio',
        vacuna: 'Vacuna',
        otro: 'Turno',
      };
      const date = new Date(p.due_at);
      const dateLabel = date.toLocaleDateString('es-AR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
      // Si la hora no es 00:00, la mostramos también.
      const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0;
      const timeLabel = hasTime
        ? ` ${date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`
        : '';
      return `${labels[p.category]} — ${p.title} · ${dateLabel}${timeLabel}`;
    }
  }
}
