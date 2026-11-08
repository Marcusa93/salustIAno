import { z } from 'zod';

/**
 * Schemas del agente solids-menu (menú semanal de alimentación complementaria).
 *
 * Sin `import 'server-only'` ni dependencias de Node: los tipos se usan desde
 * `src/lib/solids/menu.ts` (puro, testeable) y desde la UI.
 *
 * El output del LLM se valida acá con criterio tolerante (recortamos strings
 * largos en vez de rebotar todo el menú), pero NO se confía en él: después
 * pasa por `validateMenu`, que resuelve alimentos contra el catálogo, saca lo
 * prohibido y recalcula las etiquetas.
 */

export const MENU_TAGS = ['nuevo', 'alergeno', 'hierro'] as const;
export type MenuTag = (typeof MENU_TAGS)[number];

function isMenuTag(s: string): s is MenuTag {
  return (MENU_TAGS as readonly string[]).includes(s);
}

/** Recorta en vez de rebotar: un texto un poco largo no tiene que tirar el menú entero. */
function clipped(max: number) {
  return z
    .string()
    .trim()
    .min(1)
    .transform((s) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s));
}

// ---------------------------------------------------------------------------
// Input (lo que arma el server action y viaja al LLM como JSON)
// ---------------------------------------------------------------------------

const foodRefSchema = z.object({
  key: z.string(),
  name: z.string(),
  /** Veces que lo comió (comidas distintas). */
  times: z.number().int().min(0),
});

export const solidsMenuInputSchema = z.object({
  /** Hoy en Argentina, "YYYY-MM-DD". */
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Los 7 días del menú, ya calculados: el modelo los usa tal cual. */
  weekDays: z.array(z.object({ date: z.string(), label: z.string() })).length(7),
  ageMonths: z.number().int().min(4).max(36),
  mealsPerDayGuide: z.string(),
  /** Cómo vienen ofreciendo la comida. null si todavía no hay datos. */
  method: z.enum(['papilla', 'blw', 'mixto']).nullable(),
  /** Días desde la primera comida sólida (1 = hoy empezó). null si todavía no empezó. */
  solidsDay: z.number().int().min(1).nullable(),
  foodsTried: z.object({
    favorites: z.array(foodRefSchema),
    accepted: z.array(foodRefSchema),
    learning: z.array(foodRefSchema),
    refused: z.array(foodRefSchema),
  }),
  /** Lo que todavía no le entra y conviene volver a ofrecer, primero lo más olvidado. */
  reoffer: z.array(foodRefSchema),
  allergens: z.array(
    z.object({
      allergen: z.string(),
      label: z.string(),
      state: z.enum(['pending', 'introducing', 'maintain', 'lapsed', 'reaction']),
      exposures: z.number().int().min(0),
      daysSinceLast: z.number().int().nullable(),
    }),
  ),
  /** Si no hay que sumar un alérgeno nuevo esta semana, el motivo. */
  allergenHold: z.string().nullable(),
  /** El primer día del menú en que se podría sumar un alérgeno nuevo, o null si no aplica. */
  earliestNewAllergenDate: z.string().nullable(),
  /** Alimentos prohibidos (reacciones anotadas): no pueden aparecer. */
  forbidden: z.array(z.object({ key: z.string(), name: z.string(), reason: z.string() })),
  /** Catálogo de alimentos aptos para la edad, para que use nombres y claves reales. */
  catalog: z.array(
    z.object({
      key: z.string(),
      name: z.string(),
      group: z.string(),
      iron: z.enum(['high', 'medium']).optional(),
      allergens: z.array(z.string()).optional(),
    }),
  ),
});

export type SolidsMenuInput = z.infer<typeof solidsMenuInputSchema>;

// ---------------------------------------------------------------------------
// Output del LLM
// ---------------------------------------------------------------------------

const menuFoodSchema = z.object({
  /** Clave del catálogo cuando la hay. */
  key: z.string().trim().max(80).nullish(),
  name: clipped(60),
});

const menuMealSchema = z.object({
  /** "Almuerzo", "Cena", "Desayuno"… */
  name: clipped(40),
  foods: z.array(menuFoodSchema).min(1).max(6),
  /** Nota corta de preparación para el método de la familia. */
  prep: clipped(320),
  tags: z
    .array(z.string())
    .max(8)
    .default([])
    .transform((tags) => tags.filter(isMenuTag)),
});

const menuDaySchema = z.object({
  date: z.string().trim().max(20),
  label: z.string().trim().max(40),
  meals: z.array(menuMealSchema).min(1).max(2),
});

const shoppingGroupSchema = z.object({
  /** Clave de grupo del catálogo ("verduras", "frutas"…). */
  group: z.string().trim().max(40),
  items: z
    .array(
      z.object({
        item: clipped(60),
        quantity: z
          .string()
          .trim()
          .max(80)
          .default('')
          .transform((s) => s.slice(0, 60)),
      }),
    )
    .max(30),
});

export const solidsMenuOutputSchema = z.object({
  days: z.array(menuDaySchema).length(7),
  shoppingList: z.array(shoppingGroupSchema).max(10),
  tips: z.array(clipped(220)).min(1).max(4),
});

export type SolidsMenuOutput = z.infer<typeof solidsMenuOutputSchema>;
