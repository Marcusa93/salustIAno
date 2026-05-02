import { z } from 'zod';

// ============================================================================
// Tipos comunes
// ============================================================================

const isoDateTimeString = z
  .string()
  .min(1, 'La fecha/hora es obligatoria')
  .refine((s) => !Number.isNaN(Date.parse(s)), 'Fecha inválida');

const optionalNumber = z
  .number({ message: 'Tiene que ser un número' })
  .optional()
  .or(z.nan().transform(() => undefined));

// ============================================================================
// Sleep
// ============================================================================

export const sleepQualityEnum = z.enum(['good', 'regular', 'bad', 'unknown']);
export type SleepQuality = z.infer<typeof sleepQualityEnum>;

export const SLEEP_QUALITY_LABELS: Record<SleepQuality, string> = {
  good: 'Bien',
  regular: 'Regular',
  bad: 'Mal',
  unknown: 'No sé',
};

export const sleepSessionSchema = z
  .object({
    started_at: isoDateTimeString,
    ended_at: isoDateTimeString.optional().or(z.literal('')),
    quality: sleepQualityEnum.default('unknown'),
    is_nap: z.boolean().default(false),
    notes: z.string().max(2000).optional().or(z.literal('')),
  })
  .refine(
    (data) => {
      if (!data.ended_at) return true;
      return new Date(data.ended_at).getTime() > new Date(data.started_at).getTime();
    },
    { message: 'El final tiene que ser posterior al inicio', path: ['ended_at'] },
  )
  .refine(
    (data) => {
      if (!data.ended_at) return true;
      const diff = new Date(data.ended_at).getTime() - new Date(data.started_at).getTime();
      return diff < 24 * 60 * 60 * 1000;
    },
    { message: 'Más de 24 horas no parece un sueño normal', path: ['ended_at'] },
  );

export type SleepSessionInput = z.infer<typeof sleepSessionSchema>;

/**
 * Schema para cerrar un sueño en curso. El UI levanta `started_at` desde el
 * registro existente para revalidar coherencia (ended > started, < 24h) sin
 * confiar en el cliente para esa parte.
 */
export const closeSleepSchema = z
  .object({
    started_at: isoDateTimeString,
    ended_at: isoDateTimeString,
    quality: sleepQualityEnum.optional(),
  })
  .refine((data) => new Date(data.ended_at).getTime() > new Date(data.started_at).getTime(), {
    message: 'El final tiene que ser posterior al inicio',
    path: ['ended_at'],
  })
  .refine(
    (data) => {
      const diff = new Date(data.ended_at).getTime() - new Date(data.started_at).getTime();
      return diff < 24 * 60 * 60 * 1000;
    },
    { message: 'Más de 24 horas no parece un sueño normal', path: ['ended_at'] },
  );

export type CloseSleepInput = z.infer<typeof closeSleepSchema>;

// ============================================================================
// Feeding
// ============================================================================

export const feedingTypeEnum = z.enum(['breastfeeding', 'bottle', 'solid']);
export type FeedingType = z.infer<typeof feedingTypeEnum>;

export const FEEDING_TYPE_LABELS: Record<FeedingType, string> = {
  breastfeeding: 'Pecho',
  bottle: 'Biberón',
  solid: 'Sólido',
};

export const breastSideEnum = z.enum(['left', 'right', 'both']);
export type BreastSide = z.infer<typeof breastSideEnum>;

export const BREAST_SIDE_LABELS: Record<BreastSide, string> = {
  left: 'Izquierdo',
  right: 'Derecho',
  both: 'Ambos',
};

export const feedingReactionEnum = z.enum(['none', 'mild', 'strong']);
export type FeedingReaction = z.infer<typeof feedingReactionEnum>;

export const FEEDING_REACTION_LABELS: Record<FeedingReaction, string> = {
  none: 'Sin reacción',
  mild: 'Leve',
  strong: 'Fuerte',
};

/**
 * Schema de feeding_events.
 *
 * Replica el CHECK feeding_events_type_consistency de la migración 001:
 *   - breastfeeding: side y duration permitidos; amount_ml y foods deben ser NULL.
 *   - bottle:        duration y amount permitidos; side y foods deben ser NULL.
 *   - solid:         foods permitido; side, duration y amount deben ser NULL.
 *
 * El schema deja todos los campos opcionales y verifica la coherencia con
 * un superRefine para que el feedback al user sea claro antes de pegar a
 * la base.
 */
export const feedingEventSchema = z
  .object({
    occurred_at: isoDateTimeString,
    type: feedingTypeEnum,
    side: breastSideEnum.optional().or(z.literal('')),
    duration_minutes: optionalNumber.refine(
      (v) => v === undefined || (Number.isInteger(v) && v >= 0 && v <= 180),
      'Entre 0 y 180 minutos',
    ),
    amount_ml: optionalNumber.refine(
      (v) => v === undefined || (Number.isInteger(v) && v >= 0 && v <= 1000),
      'Entre 0 y 1000 ml',
    ),
    foods: z.array(z.string().min(1).max(100)).max(20).optional(),
    reaction: feedingReactionEnum.default('none'),
    notes: z.string().max(2000).optional().or(z.literal('')),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'breastfeeding') {
      if (data.amount_ml !== undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['amount_ml'],
          message: 'Sin ml en pecho',
        });
      }
      if (data.foods && data.foods.length > 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['foods'],
          message: 'Sin alimentos sólidos en pecho',
        });
      }
    } else if (data.type === 'bottle') {
      if (data.side) {
        ctx.addIssue({ code: 'custom', path: ['side'], message: 'Sin lado en biberón' });
      }
      if (data.foods && data.foods.length > 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['foods'],
          message: 'Sin alimentos sólidos en biberón',
        });
      }
    } else if (data.type === 'solid') {
      if (data.side) {
        ctx.addIssue({ code: 'custom', path: ['side'], message: 'Sin lado en sólido' });
      }
      if (data.duration_minutes !== undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['duration_minutes'],
          message: 'Sin duración en sólido',
        });
      }
      if (data.amount_ml !== undefined) {
        ctx.addIssue({ code: 'custom', path: ['amount_ml'], message: 'Sin ml en sólido' });
      }
    }
  });

export type FeedingEventInput = z.infer<typeof feedingEventSchema>;

// ============================================================================
// Diaper
// ============================================================================

export const diaperTypeEnum = z.enum(['wet', 'dirty', 'both', 'dry']);
export type DiaperType = z.infer<typeof diaperTypeEnum>;

export const DIAPER_TYPE_LABELS: Record<DiaperType, string> = {
  wet: 'Pis',
  dirty: 'Caca',
  both: 'Pis + caca',
  dry: 'Seco',
};

/**
 * Shape del análisis estructurado del agente diaper-vision. Lo replicamos
 * acá (en vez de importar el schema del agente) para mantener los
 * validators libres de imports server-side.
 */
export const diaperPhotoAnalysisSchema = z.object({
  color: z.string().min(1).max(40),
  consistency: z.string().min(1).max(40),
  observations: z.string().min(1).max(800),
  alarm: z.boolean(),
  alarm_reason: z.string().max(300),
  recommendation: z.string().min(1).max(300),
});

export type DiaperPhotoAnalysis = z.infer<typeof diaperPhotoAnalysisSchema>;

export const diaperEventSchema = z.object({
  occurred_at: isoDateTimeString,
  type: diaperTypeEnum,
  notes: z.string().max(2000).optional().or(z.literal('')),
  /**
   * Análisis estructurado del agente diaper-vision si la familia adjuntó
   * foto. NULL/undefined si fue carga manual.
   */
  photo_analysis: diaperPhotoAnalysisSchema.nullish(),
  /**
   * Path al objeto en el bucket diaper-photos. Lo arma uploadDiaperPhotoAction
   * antes del insert. NULL/undefined si el evento se cargó sin foto.
   */
  photo_path: z.string().min(1).max(500).nullish(),
});

export type DiaperEventInput = z.infer<typeof diaperEventSchema>;
