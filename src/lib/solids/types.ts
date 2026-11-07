/**
 * Tipos de la alimentación complementaria (sólidos).
 *
 * El catálogo de alimentos (`catalog.ts`) y el motor de progreso
 * (`progress.ts`) hablan este idioma. Los enums de formato, aceptación y
 * cantidad replican los de la migración `solid_food_tastings`.
 */

export type FoodGroup =
  | 'verduras'
  | 'frutas'
  | 'cereales'
  | 'carnes'
  | 'huevo_lacteos'
  | 'legumbres'
  | 'grasas';

export type AllergenKey =
  | 'leche'
  | 'huevo'
  | 'trigo'
  | 'mani'
  | 'frutos_secos'
  | 'pescado'
  | 'mariscos'
  | 'soja'
  | 'sesamo';

export type FoodColor = 'rojo' | 'naranja' | 'amarillo' | 'verde' | 'violeta' | 'blanco' | 'marron';

export interface Food {
  /** Id estable, snake_case sin acentos. Se guarda en la base: no se renombra. */
  key: string;
  /** Nombre como lo dice una familia en Argentina ("Zapallo", "Banana"). */
  name: string;
  /** Otros nombres con los que alguien lo puede escribir ("calabaza", "anco"). */
  aliases?: readonly string[];
  emoji: string;
  group: FoodGroup;
  /** Edad mínima recomendada en meses (6 para casi todo). */
  fromMonths: number;
  allergens?: readonly AllergenKey[];
  /** Aporte de hierro: clave a partir de los 6 meses. */
  iron?: 'high' | 'medium';
  /** Rico en vitamina C: ayuda a absorber el hierro de origen vegetal. */
  vitaminC?: boolean;
  color: FoodColor;
  /** Cómo prepararlo en papilla o pisado. */
  puree: string;
  /** Cómo ofrecerlo para que lo agarre con la mano (BLW) a los 6 meses. */
  blw: string;
  /** Riesgo de atragantamiento u otra precaución puntual. */
  caution?: string;
}

/** Cómo se lo ofrecieron (define si la comida fue papilla, BLW o mixta). */
export type FoodFormat = 'puree' | 'mashed' | 'preloaded' | 'finger';

export type FoodAcceptance = 'loved' | 'liked' | 'neutral' | 'disliked' | 'refused';

export type FoodAmount = 'taste' | 'some' | 'half' | 'most' | 'all';

export type FoodReaction = 'none' | 'mild' | 'strong';

export type ReactionSign =
  | 'boca_roja'
  | 'ronchas'
  | 'hinchazon'
  | 'vomitos'
  | 'diarrea'
  | 'tos'
  | 'respirar';

export type SolidMethod = 'papilla' | 'blw' | 'mixto';

/** Un alimento dentro de una comida, tal como sale de la base. */
export interface Tasting {
  id: string;
  mealId: string;
  occurredAt: string;
  foodKey: string;
  foodName: string;
  format: FoodFormat | null;
  acceptance: FoodAcceptance | null;
  amount: FoodAmount | null;
  gagged: boolean;
  reaction: FoodReaction;
  reactionSigns: ReactionSign[];
}

/** Una comida (feeding_events type='solid') con sus alimentos. */
export interface Meal {
  id: string;
  occurredAt: string;
  notes: string | null;
  reaction: FoodReaction;
  tastings: Tasting[];
}
