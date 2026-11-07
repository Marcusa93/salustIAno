/**
 * Guía de alimentación complementaria para la familia. Basada en las
 * recomendaciones de la OMS/OPS, la Sociedad Argentina de Pediatría, las
 * Guías Alimentarias para la Población Infantil (Ministerio de Salud) y la
 * AAP. Es orientación general: la pediatra de Salu tiene la última palabra.
 */

export type GuideBlock =
  | { kind: 'p'; text: string }
  | { kind: 'list'; title?: string; items: readonly string[] }
  | { kind: 'alert'; tone: 'danger' | 'info'; title: string; text: string }
  | { kind: 'compare'; items: readonly { title: string; pros: string; cons: string }[] };

export interface GuideSection {
  id: string;
  emoji: string;
  title: string;
  summary: string;
  blocks: readonly GuideBlock[];
}

export const GUIDE: readonly GuideSection[] = [
  {
    id: 'empezar',
    emoji: '🥄',
    title: 'Cómo empezar',
    summary: 'Señales de que está listo, cuántas comidas y cómo sentarlo.',
    blocks: [
      {
        kind: 'list',
        title: 'Está listo cuando…',
        items: [
          'Se sienta con poco apoyo y sostiene bien la cabeza.',
          'Ya no empuja la comida afuera con la lengua.',
          'Muestra interés: mira lo que comen, abre la boca, se lleva cosas a la boca.',
        ],
      },
      {
        kind: 'p',
        text: 'Antes del año, la leche (pecho o fórmula) sigue siendo el alimento principal. La comida suma hierro, sabores y texturas, y le enseña a comer: al principio importa más que pruebe que cuánto come.',
      },
      {
        kind: 'list',
        title: 'Cada comida',
        items: [
          'Arrancá con 1 comida por día, en un momento en que esté despierto y de buen humor. En unas semanas, pasá a 2.',
          'Sentado derecho (silla alta, a 90°), siempre con un adulto mirando y sin pantallas.',
          'Sin sal, sin azúcar, sin caldos en cubo. Sí aceite de oliva, hierbas y especias suaves.',
          'Ofrecele agua segura en vaso abierto, unos sorbos con la comida. Nada de jugos, té ni mate.',
          'Ustedes deciden qué y cuándo; él decide cuánto. Sin avioncito ni insistir.',
        ],
      },
      {
        kind: 'list',
        title: 'Ya no quiere más cuando…',
        items: [
          'Gira la cabeza, cierra la boca o empuja la cuchara.',
          'Juega o tira la comida y ya no se la lleva a la boca.',
        ],
      },
    ],
  },
  {
    id: 'metodos',
    emoji: '🤲',
    title: 'Papilla, BLW o mixto',
    summary: 'Qué tiene cada forma y cómo combinarlas.',
    blocks: [
      {
        kind: 'compare',
        items: [
          {
            title: 'Papilla',
            pros: 'Se ve cuánto come y es fácil sumar hierro (carne procesada, legumbres). Tranquiliza al principio.',
            cons: 'Si se queda mucho tiempo en lo liso, después le cuesta más aceptar grumos y trocitos. Hay que ir avanzando la textura.',
          },
          {
            title: 'BLW',
            pros: 'Aprende autonomía porque agarra el alimento. Fracciona solo y aprende a manejar las arcadas. Disfruta texturas y estimula lo sensorial.',
            cons: 'Los padres tienen que estar muy atentos: cortes seguros, alimentos blandos y nunca solo. Al principio come poco y ensucia mucho.',
          },
          {
            title: 'Mixto',
            pros: 'Toma lo mejor de los dos: por ejemplo, papilla de carne con cuchara y bastones de verdura para que agarre, o cuchara precargada para que la lleve él.',
            cons: 'Pide la misma atención que el BLW con los trozos. Conviene no darle de comer en la boca lo que él ya puede agarrar.',
          },
        ],
      },
      {
        kind: 'p',
        text: 'Cualquiera sirve si es seguro y respeta su hambre. Lo importante es avanzar: de liso a pisado con grumos antes de los 8 o 9 meses, y a trocitos y comida de la familia (sin sal) cerca del año.',
      },
    ],
  },
  {
    id: 'arcada',
    emoji: '🫁',
    title: 'Arcada o atragantamiento',
    summary: 'Cómo distinguirlos y qué hacer en cada caso.',
    blocks: [
      {
        kind: 'alert',
        tone: 'info',
        title: 'La arcada es normal y lo protege',
        text: 'Es ruidosa: tose, hace ruido, saca la lengua, se pone colorado y a veces devuelve un poco. Quedate tranquilo, no le metas los dedos y dejá que lo resuelva. Con las semanas, cada vez le pasa menos.',
      },
      {
        kind: 'alert',
        tone: 'danger',
        title: 'El atragantamiento es silencioso',
        text: 'No puede toser, llorar ni respirar; se pone azulado. Es una emergencia: pedí ayuda y que alguien llame al 107 o al 911 mientras empezás las maniobras.',
      },
      {
        kind: 'list',
        title: 'Maniobra en menores de 1 año',
        items: [
          'Boca abajo sobre tu antebrazo, con la cabeza más baja que el cuerpo, sosteniéndole la mandíbula.',
          '5 golpes firmes entre los omóplatos con el talón de la mano.',
          'Dalo vuelta boca arriba y hacé 5 compresiones en el centro del pecho con dos dedos, justo debajo de la línea de las tetillas.',
          'Repetí golpes y compresiones hasta que salga o llegue la ayuda. Si deja de responder, empezá RCP.',
        ],
      },
      {
        kind: 'p',
        text: 'Lo mejor es hacer un curso de primeros auxilios pediátricos antes de avanzar con trozos: lo dan la Cruz Roja y muchos hospitales. Para prevenir: siempre sentado derecho, nunca solo, nunca en el auto, caminando ni acostado.',
      },
    ],
  },
  {
    id: 'cortes',
    emoji: '🔪',
    title: 'Cortes y texturas por edad',
    summary: 'Qué forma y qué tan blando, según cómo agarra.',
    blocks: [
      {
        kind: 'list',
        title: '6 a 8 meses: agarra con toda la mano',
        items: [
          'Bastones del tamaño de tu dedo (5 a 6 cm), o flores grandes con el tallo como mango.',
          'Tan blandos que los aplastás entre el pulgar y el índice.',
          'Carne en tiras grandes para chupar, o desmenuzada en albóndigas y medallones.',
          'Papillas lisas que en pocas semanas pasan a pisadas con grumitos.',
        ],
      },
      {
        kind: 'list',
        title: '9 a 12 meses: aparece la pinza',
        items: [
          'Trocitos blandos del tamaño de un garbanzo para que practique.',
          'Comida picada o pisada de la familia, sin sal.',
        ],
      },
      {
        kind: 'list',
        title: 'Siempre',
        items: [
          'Lo redondo (uvas, arándanos, tomates cherry, aceitunas) en cuartos a lo largo.',
          'Lo duro (zanahoria, manzana) cocido o rallado fino, nunca crudo en trozos.',
          'Sin carozos, semillas grandes, espinas ni huesitos. Pasta de maní siempre diluida, nunca a cucharadas.',
        ],
      },
    ],
  },
  {
    id: 'hierro',
    emoji: '🩸',
    title: 'Hierro, el nutriente clave',
    summary: 'Por qué importa y cómo sumarlo todos los días.',
    blocks: [
      {
        kind: 'p',
        text: 'A los 6 meses se le terminan las reservas de hierro con las que nació y la leche sola ya no alcanza. Por eso conviene que haya un alimento con hierro en cada comida, o al menos una vez por día.',
      },
      {
        kind: 'list',
        title: 'Dónde está',
        items: [
          'Carnes rojas, pollo, cerdo y pescado: es el hierro que mejor se absorbe.',
          'Hígado, en poca cantidad y no más de una vez por semana.',
          'Lentejas, garbanzos, porotos, huevo y cereales fortificados.',
        ],
      },
      {
        kind: 'p',
        text: 'El hierro de los vegetales se absorbe mejor con vitamina C en la misma comida: tomate, morrón, brócoli, kiwi, naranja, frutilla, mango.',
      },
    ],
  },
  {
    id: 'alergenos',
    emoji: '🥚',
    title: 'Alérgenos: cómo sumarlos',
    summary: 'De a uno, temprano y sin cortarlos después.',
    blocks: [
      {
        kind: 'p',
        text: 'Hoy se recomienda no demorarlos: ofrecer huevo, maní y los demás desde los 6 meses, cuando ya probó algunas comidas, puede bajar el riesgo de alergia. Si tiene eccema fuerte o ya tuvo una alergia, hablalo antes con la pediatra.',
      },
      {
        kind: 'list',
        title: 'Cómo',
        items: [
          'De a uno por vez, en casa, a la mañana o al mediodía, cuando está sano.',
          'La primera vez, una cantidad chica. Miralo las 2 horas siguientes. Si va bien, la próxima un poco más.',
          'Esperá 2 o 3 días antes de sumar otro alérgeno nuevo.',
          'Una vez que lo toleró, que lo siga comiendo al menos una vez por semana: dejarlo también aumenta el riesgo.',
        ],
      },
      {
        kind: 'alert',
        tone: 'danger',
        title: 'Urgencia: 107 o 911',
        text: 'Si se le hinchan los labios o la cara, le cuesta respirar, tose sin parar, vomita repetido o está pálido y decaído, llamá ya. Ronchas aisladas: anotalo y consultá a la pediatra antes de volver a darlo.',
      },
      {
        kind: 'p',
        text: 'Un poco de colorado alrededor de la boca con tomate, cítricos o frutilla suele ser por contacto y no alergia. Igual anotalo.',
      },
    ],
  },
  {
    id: 'no-le-gusta',
    emoji: '🔁',
    title: 'Si no le gusta',
    summary: 'Un “no” hoy no es para siempre.',
    blocks: [
      {
        kind: 'p',
        text: 'Es normal: muchos bebés necesitan probar algo entre 8 y 15 veces antes de aceptarlo. La app cuenta los intentos por vos.',
      },
      {
        kind: 'list',
        items: [
          'Volvé a ofrecerlo otro día, sin presión ni premios.',
          'Cambiá la preparación: en papilla, en bastón, mezclado con algo que ya le gusta.',
          'Que los vea comerlo: comer juntos en familia es lo que más enseña.',
          'Si después de muchos intentos sigue sin quererlo, dale un descanso de unas semanas y volvé.',
        ],
      },
    ],
  },
];

export const GUIDE_SOURCES: readonly string[] = [
  'OMS / OPS — Principios de orientación para la alimentación complementaria del niño amamantado.',
  'Ministerio de Salud de la Nación — Guías Alimentarias para la Población Infantil.',
  'Sociedad Argentina de Pediatría — Guía de alimentación para niños sanos de 0 a 2 años.',
  'American Academy of Pediatrics — HealthyChildren.org: Starting Solid Foods.',
];
