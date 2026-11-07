import type {
  FoodAcceptance,
  FoodAmount,
  FoodFormat,
  FoodReaction,
  ReactionSign,
  SolidMethod,
} from './types';

export const FOOD_FORMATS: readonly FoodFormat[] = ['puree', 'mashed', 'preloaded', 'finger'];

export const FORMAT_LABELS: Record<FoodFormat, string> = {
  puree: 'Papilla',
  mashed: 'Pisado',
  preloaded: 'Cuchara precargada',
  finger: 'Con la mano',
};

export const FORMAT_HINTS: Record<FoodFormat, string> = {
  puree: 'Liso, con cuchara',
  mashed: 'Con grumitos',
  preloaded: 'Le das la cuchara cargada y la lleva él',
  finger: 'BLW: lo agarra y se lo lleva solo',
};

export const ACCEPTANCES: readonly FoodAcceptance[] = [
  'loved',
  'liked',
  'neutral',
  'disliked',
  'refused',
];

export const ACCEPTANCE_LABELS: Record<FoodAcceptance, string> = {
  loved: 'Le encantó',
  liked: 'Le gustó',
  neutral: 'Más o menos',
  disliked: 'No le gustó',
  refused: 'Lo rechazó',
};

export const ACCEPTANCE_EMOJI: Record<FoodAcceptance, string> = {
  loved: '😍',
  liked: '🙂',
  neutral: '😐',
  disliked: '😕',
  refused: '🙅',
};

export const AMOUNTS: readonly FoodAmount[] = ['taste', 'some', 'half', 'most', 'all'];

export const AMOUNT_LABELS: Record<FoodAmount, string> = {
  taste: 'Lo probó',
  some: 'Un poquito',
  half: 'La mitad',
  most: 'Casi todo',
  all: 'Todo',
};

export const REACTION_LABELS: Record<FoodReaction, string> = {
  none: 'Nada',
  mild: 'Leve',
  strong: 'Fuerte',
};

export const REACTION_SIGNS: readonly ReactionSign[] = [
  'boca_roja',
  'ronchas',
  'hinchazon',
  'vomitos',
  'diarrea',
  'tos',
  'respirar',
];

export const REACTION_SIGN_LABELS: Record<ReactionSign, string> = {
  boca_roja: 'Boca o cachetes colorados',
  ronchas: 'Ronchas',
  hinchazon: 'Hinchazón de labios o cara',
  vomitos: 'Vómitos',
  diarrea: 'Diarrea',
  tos: 'Tos o ronquera',
  respirar: 'Le costó respirar',
};

/** Signos que siempre son una urgencia: no se espera, se llama. */
export const EMERGENCY_SIGNS: ReadonlySet<ReactionSign> = new Set(['hinchazon', 'respirar']);

export const METHOD_LABELS: Record<SolidMethod, string> = {
  papilla: 'Papilla',
  blw: 'BLW',
  mixto: 'Mixto',
};

/** Números de emergencia en Argentina (107 SAME/SIPROSA, 911). */
export const EMERGENCY_PHONE = '107';
