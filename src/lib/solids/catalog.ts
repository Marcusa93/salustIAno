/**
 * Catálogo de alimentos para la alimentación complementaria (papilla + BLW).
 *
 * Criterio: guía práctica y conservadora para una familia de Argentina, basada
 * en los principios de alimentación complementaria de OMS/OPS, la Sociedad
 * Argentina de Pediatría, las Guías Alimentarias para la Población Infantil
 * del Ministerio de Salud de la Nación, la AAP y la AEP.
 *
 * IMPORTANTE:
 *   - No es indicación médica. Ante cualquier duda, manda lo que diga la
 *     pediatra de Salu.
 *   - Nada lleva sal ni azúcar. No hay números clínicos inventados.
 *   - El texto `blw` está pensado para los 6 meses (agarre con toda la mano):
 *     piezas del largo de un dedo adulto, blandas como para aplastarse entre
 *     el pulgar y el índice.
 *   - Las `key` se guardan en la base: no se renombran.
 */

import type { AllergenKey, Food, FoodGroup } from './types';

export const FOOD_GROUP_LABELS: Record<FoodGroup, string> = {
  verduras: 'Verduras',
  frutas: 'Frutas',
  cereales: 'Cereales, papa y pastas',
  carnes: 'Carnes y pescado',
  huevo_lacteos: 'Huevo y lácteos',
  legumbres: 'Legumbres',
  grasas: 'Grasas buenas y semillas',
};

export const ALLERGEN_LABELS: Record<AllergenKey, string> = {
  leche: 'Leche de vaca',
  huevo: 'Huevo',
  trigo: 'Trigo (gluten)',
  mani: 'Maní',
  frutos_secos: 'Frutos secos',
  pescado: 'Pescado',
  mariscos: 'Mariscos',
  soja: 'Soja',
  sesamo: 'Sésamo',
};

export const FOODS: readonly Food[] = [
  // ─── Verduras ────────────────────────────────────────────────────────────
  {
    key: 'zapallo',
    name: 'Zapallo',
    aliases: ['anco', 'zapallo anco', 'calabaza', 'cabutiá', 'cabotiá', 'zapallo plomo'],
    emoji: '🎃',
    group: 'verduras',
    fromMonths: 6,
    color: 'naranja',
    puree:
      'Pelalo, sacale las semillas y cocinalo al vapor o hervido hasta que esté muy blando. Pisalo con leche materna o fórmula y un chorrito de aceite de oliva. Con las semanas, más grumoso.',
    blw: 'Bastones pelados del largo de un dedo adulto (5-6 cm, 1-1,5 cm de grosor), al horno o al vapor, tan blandos que se aplasten entre tu pulgar y tu índice.',
  },
  {
    key: 'zapallito',
    name: 'Zapallito',
    aliases: [
      'zapallito redondo',
      'zapallito de tronco',
      'zapallito largo',
      'zucchini',
      'zuchini',
      'zuquini',
      'calabacín',
    ],
    emoji: '🥒',
    group: 'verduras',
    fromMonths: 6,
    color: 'verde',
    puree:
      'Lavalo bien y cocinalo al vapor (pelado al principio) hasta que esté tierno; pisalo o procesalo. Queda aguado: espesalo con papa, zapallo o arroz.',
    blw: 'Bastones del largo de un dedo, con cáscara para que no se desarmen, al vapor o al horno hasta que estén blandos pero enteros.',
  },
  {
    key: 'zanahoria',
    name: 'Zanahoria',
    emoji: '🥕',
    group: 'verduras',
    fromMonths: 6,
    color: 'naranja',
    puree:
      'Pelala y cocinala al vapor o hervida hasta que esté muy blanda. Procesala con agua de cocción o leche materna y un chorrito de aceite de oliva. Con las semanas, pisala más gruesa.',
    blw: 'Bastones del largo de un dedo, al vapor o al horno hasta que se aplasten entre tus dedos. Cruda, solo rallada bien fina.',
    caution:
      'Cruda en bastones o rodajas tiene alto riesgo de atragantamiento: siempre cocida blanda o rallada fina.',
  },
  {
    key: 'brocoli',
    name: 'Brócoli',
    aliases: ['brécol', 'broccoli'],
    emoji: '🥦',
    group: 'verduras',
    fromMonths: 6,
    vitaminC: true,
    color: 'verde',
    puree:
      'Cocinalo al vapor hasta que el tronco esté tierno y procesalo con un chorrito de aceite de oliva. Con papa o zapallo se suaviza el sabor.',
    blw: 'Ramitos grandes con el tronco como mango, al vapor hasta que estén bien blandos. Que el ramito sea más grande que su puño.',
  },
  {
    key: 'coliflor',
    name: 'Coliflor',
    emoji: '🥦',
    group: 'verduras',
    fromMonths: 6,
    vitaminC: true,
    color: 'blanco',
    puree:
      'Cocinala al vapor hasta que esté muy tierna y procesala con un chorrito de aceite de oliva. Mezclada con papa o zapallo queda más cremosa.',
    blw: 'Ramitos grandes con el tronco como mango, al vapor o al horno, hasta que se aplasten fácil entre tus dedos.',
  },
  {
    key: 'chauchas',
    name: 'Chauchas',
    aliases: ['judías verdes', 'porotos verdes', 'vainitas', 'ejotes'],
    emoji: '🫛',
    group: 'verduras',
    fromMonths: 6,
    color: 'verde',
    puree:
      'Sacales las puntas y los hilos, cocinalas al vapor hasta que estén muy tiernas y procesalas bien (tienen fibra). Mezclalas con papa o zapallo.',
    blw: 'Enteras, sin puntas ni hilos, cocidas bien blandas: son un buen bastón para agarrar. Si arranca pedazos duros, volvé al puré.',
  },
  {
    key: 'arvejas',
    name: 'Arvejas',
    aliases: ['arvejitas', 'guisantes', 'chícharos', 'arvejas frescas', 'arvejas congeladas'],
    emoji: '🫛',
    group: 'verduras',
    fromMonths: 6,
    color: 'verde',
    puree:
      'Cocinalas (frescas o congeladas) hasta que estén muy blandas y procesalas. Si queda la piel, pasalas por un colador. Van bien con papa o zanahoria.',
    blw: 'Cocidas y aplastadas una por una con el tenedor; mezcladas con puré sirven para precargar la cuchara o armar medallones.',
    caution:
      'Enteras pueden trabarse: aplastalas siempre, al menos hasta que agarre bien con la pinza de los dedos.',
  },
  {
    key: 'tomate',
    name: 'Tomate',
    aliases: ['tomate perita', 'tomate redondo', 'tomate cherry'],
    emoji: '🍅',
    group: 'verduras',
    fromMonths: 6,
    vitaminC: true,
    color: 'rojo',
    puree:
      'Pelalo (unos segundos en agua hirviendo), sacale las semillas y cocinalo, o usalo bien maduro. Mezclalo con otros purés: solo es muy ácido y aguado.',
    blw: 'Cuartos grandes de tomate maduro, pelados si la piel es dura. El cherry, siempre en cuartos a lo largo.',
    caution:
      'Por la acidez puede enrojecer la piel alrededor de la boca, sin que sea alergia. El cherry entero tiene riesgo de atragantamiento.',
  },
  {
    key: 'morron',
    name: 'Morrón',
    aliases: ['morrón rojo', 'morrón verde', 'morrón amarillo', 'pimiento', 'ají morrón'],
    emoji: '🫑',
    group: 'verduras',
    fromMonths: 6,
    vitaminC: true,
    color: 'rojo',
    puree:
      'Asalo al horno o hervilo hasta que esté blando, pelalo y sacale semillas y nervaduras. Procesalo con papa o zapallo: suma sabor y vitamina C.',
    blw: 'Tiras anchas, asadas y peladas, del largo de un dedo y bien blandas. Crudo es demasiado duro para esta edad.',
    caution: 'La piel es dura y se pega al paladar: pelalo después de asarlo.',
  },
  {
    key: 'berenjena',
    name: 'Berenjena',
    emoji: '🍆',
    group: 'verduras',
    fromMonths: 6,
    color: 'violeta',
    puree:
      'Pelala y cocinala al horno o al vapor hasta que esté muy blanda; pisala con un chorrito de aceite de oliva. Mezclada con tomate o papa queda más rica.',
    blw: 'Bastones anchos del largo de un dedo, sin piel, al horno con un poco de aceite de oliva hasta que estén bien blandos.',
  },
  {
    key: 'cebolla',
    name: 'Cebolla',
    emoji: '🧅',
    group: 'verduras',
    fromMonths: 6,
    color: 'blanco',
    puree:
      'Cocinala bien (rehogada en aceite de oliva, al vapor o al horno) y sumala al puré de otras verduras: da sabor sin necesidad de sal.',
    blw: 'Gajos grandes asados al horno hasta que estén muy blandos, o picada y bien cocida dentro de medallones y salsas.',
  },
  {
    key: 'puerro',
    name: 'Puerro',
    emoji: '🌿',
    group: 'verduras',
    fromMonths: 6,
    color: 'verde',
    puree:
      'Usá la parte blanca y verde clara, bien lavada. Cocinalo hasta que esté muy tierno y procesalo con papa o zapallo: da sabor sin sal.',
    blw: 'Mejor picado y bien cocido dentro de tortillas, medallones o salsas. En trozos es fibroso y difícil de manejar.',
    caution: 'Tiene fibras largas: si lo ofrecés en trozos, que esté muy cocido; si no, procesado.',
  },
  {
    key: 'apio',
    name: 'Apio',
    emoji: '🥬',
    group: 'verduras',
    fromMonths: 6,
    color: 'verde',
    puree:
      'Sacale los hilos, cocinalo bien y procesalo con otras verduras: en poca cantidad da mucho sabor a sopas y purés.',
    blw: 'Mejor picado y bien cocido dentro de preparaciones. En rama, crudo o al dente, no es para esta edad.',
    caution: 'Crudo es fibroso y riesgoso: siempre bien cocido y sin hilos.',
  },
  {
    key: 'pepino',
    name: 'Pepino',
    emoji: '🥒',
    group: 'verduras',
    fromMonths: 6,
    color: 'verde',
    puree:
      'Pelalo, sacale las semillas y rallalo fino o procesalo crudo. Queda rico mezclado con yogur natural o con palta.',
    blw: 'Rallado fino o en láminas muy finitas que se doblen. Evitá cubos y rodajas gruesas.',
    caution: 'Es crocante: si arranca trozos con las encías, volvé a ofrecerlo rallado.',
  },
  {
    key: 'esparragos',
    name: 'Espárragos',
    emoji: '🌱',
    group: 'verduras',
    fromMonths: 6,
    color: 'verde',
    puree:
      'Usá las puntas y la parte tierna (cortá el extremo duro). Cocinalos al vapor hasta que estén muy blandos y procesalos con papa.',
    blw: 'Enteros, sin la parte dura, cocidos hasta que se aplasten entre tus dedos. Los gruesos son más fáciles de agarrar.',
  },
  {
    key: 'acelga',
    name: 'Acelga',
    emoji: '🥬',
    group: 'verduras',
    fromMonths: 12,
    iron: 'medium',
    color: 'verde',
    puree:
      'Desde el año: hojas sin el tallo grueso, cocidas al vapor y procesadas con papa o zapallo. Tirá el agua de cocción.',
    blw: 'Desde el año: picada y bien cocida dentro de tortillas, medallones o budines.',
    caution: 'Hasta el año, salvo que la pediatra indique otra cosa (acumula nitratos).',
  },
  {
    key: 'espinaca',
    name: 'Espinaca',
    emoji: '🥬',
    group: 'verduras',
    fromMonths: 12,
    iron: 'medium',
    color: 'verde',
    puree:
      'Desde el año: hojas lavadas, cocidas al vapor y procesadas con papa o zapallo. Tirá el agua de cocción.',
    blw: 'Desde el año: picada y bien cocida dentro de tortillas, medallones o budines.',
    caution: 'Hasta el año, salvo que la pediatra indique otra cosa (acumula nitratos).',
  },
  {
    key: 'remolacha',
    name: 'Remolacha',
    aliases: ['betarraga', 'beterraga'],
    emoji: '🟣',
    group: 'verduras',
    fromMonths: 12,
    color: 'violeta',
    puree:
      'Desde el año: hervida o al horno hasta que esté blanda, pelada y procesada. Tiñe todo de violeta.',
    blw: 'Desde el año: bastones o gajos asados, pelados y bien blandos.',
    caution:
      'Hasta el año, salvo que la pediatra indique otra cosa (acumula nitratos). Puede teñir el pis y la caca de rojo: es normal.',
  },
  {
    key: 'hongos',
    name: 'Hongos',
    aliases: ['champiñones', 'champignones', 'portobellos', 'gírgolas'],
    emoji: '🍄',
    group: 'verduras',
    fromMonths: 6,
    color: 'marron',
    puree:
      'Limpialos, cocinalos bien (salteados en aceite de oliva o al horno) y procesalos con otras verduras o con carne.',
    blw: 'Champiñones grandes, enteros o en mitades, bien cocidos para que los agarre y chupe; o picados dentro de medallones y salsas.',
    caution:
      'Siempre cocidos. Son gomosos y resbaladizos: si le cuestan, ofrecelos bien picados. Nunca hongos silvestres.',
  },

  // ─── Frutas ──────────────────────────────────────────────────────────────
  {
    key: 'banana',
    name: 'Banana',
    aliases: ['plátano', 'banano'],
    emoji: '🍌',
    group: 'frutas',
    fromMonths: 6,
    color: 'amarillo',
    puree:
      'Bien madura (con pintitas), pisada con tenedor: no hace falta cocinarla. Al principio aflojala con leche materna o fórmula; con las semanas, dejala grumosa.',
    blw: 'Media banana con un poco de cáscara abajo como mango, o pelada y partida a lo largo en tres. Si se resbala, pasala por avena molida.',
  },
  {
    key: 'manzana',
    name: 'Manzana',
    emoji: '🍎',
    group: 'frutas',
    fromMonths: 6,
    color: 'rojo',
    puree:
      'Pelada y sin semillas, cocinala al vapor o al horno hasta que esté blanda y pisala o procesala. También cruda, rallada bien fina.',
    blw: 'Gajos gruesos cocidos al horno o al vapor hasta que se aplasten entre tus dedos. Cruda, solo rallada fina.',
    caution:
      'Cruda en gajos o trozos es de las comidas con más riesgo de atragantamiento: siempre cocida blanda o rallada fina.',
  },
  {
    key: 'pera',
    name: 'Pera',
    emoji: '🍐',
    group: 'frutas',
    fromMonths: 6,
    color: 'verde',
    puree:
      'Si está bien madura y blanda, pelala y pisala cruda; si está firme, cocinala al vapor unos minutos. Sacale el centro y las semillas.',
    blw: 'Gajos gruesos y pelados: crudos si está muy madura, o cocidos hasta que se aplasten entre tus dedos. Si resbala, pasala por avena molida.',
    caution: 'Firme y cruda tiene el mismo riesgo que la manzana: cocinala o rallala.',
  },
  {
    key: 'durazno',
    name: 'Durazno',
    aliases: ['melocotón', 'pelón', 'nectarina'],
    emoji: '🍑',
    group: 'frutas',
    fromMonths: 6,
    color: 'naranja',
    puree:
      'Bien maduro, pelado y sin carozo: pisalo crudo o, si está firme, cocinalo unos minutos. Combina rico con yogur natural.',
    blw: 'Gajos grandes, maduros y pelados. Como resbala, pasalos por avena molida o semillas molidas para que los pueda agarrar.',
    caution: 'Al principio, sin piel (se pega al paladar). Siempre sin carozo.',
  },
  {
    key: 'damasco',
    name: 'Damasco',
    aliases: ['albaricoque', 'chabacano'],
    emoji: '🍑',
    group: 'frutas',
    fromMonths: 6,
    color: 'naranja',
    puree:
      'Maduro, pelado y sin carozo, pisado crudo o cocido unos minutos si está firme. Los desecados, hidratados en agua caliente y procesados.',
    blw: 'Mitades o cuartos maduros, pelados y sin carozo. Si resbalan, pasalos por avena molida.',
    caution:
      'Sin carozo y, al principio, sin piel. Los desecados enteros son duros y pegajosos: solo hidratados y procesados.',
  },
  {
    key: 'ciruela',
    name: 'Ciruela',
    aliases: ['ciruela pasa'],
    emoji: '🟣',
    group: 'frutas',
    fromMonths: 6,
    color: 'violeta',
    puree:
      'Madura, pelada y sin carozo, pisada cruda o cocida unos minutos. Las pasas, hidratadas y procesadas, pueden ayudar si hay constipación.',
    blw: 'Mitades o cuartos maduros, pelados y sin carozo. Si resbalan, pasalos por avena molida.',
    caution:
      'Sin carozo y, al principio, sin piel. Las pasas enteras son pegajosas: siempre procesadas. Puede aflojar la panza.',
  },
  {
    key: 'mango',
    name: 'Mango',
    emoji: '🥭',
    group: 'frutas',
    fromMonths: 6,
    vitaminC: true,
    color: 'amarillo',
    puree:
      'Bien maduro y pelado, pisado o procesado crudo. Va bien solo o con banana o yogur natural.',
    blw: 'Tiras gruesas y largas de mango maduro, sin cáscara. Resbala: pasalas por avena o semillas molidas.',
    caution: 'Pelalo bien: la cáscara puede irritar la piel alrededor de la boca.',
  },
  {
    key: 'palta',
    name: 'Palta',
    aliases: ['aguacate', 'avocado'],
    emoji: '🥑',
    group: 'frutas',
    fromMonths: 6,
    color: 'verde',
    puree:
      'Madura y pisada con tenedor; no se cocina. Aflojala con leche materna o fórmula, o mezclala con banana. Es una grasa buena ideal para empezar.',
    blw: 'Gajos gruesos de palta madura. Es resbaladiza: pasalos por avena molida o dejale un poco de cáscara abajo como mango.',
  },
  {
    key: 'frutilla',
    name: 'Frutilla',
    aliases: ['fresa'],
    emoji: '🍓',
    group: 'frutas',
    fromMonths: 6,
    vitaminC: true,
    color: 'rojo',
    puree:
      'Lavalas bien, sacales el cabito y pisalas o procesalas crudas. Solas son ácidas: mezclalas con banana o yogur natural.',
    blw: 'Las grandes y maduras, enteras sin cabito para que las muerda, o aplastadas. Las chicas o firmes, aplastadas o en cuartos a lo largo.',
    caution:
      'Pueden enrojecer la piel alrededor de la boca por contacto; no siempre es alergia. Si aparecen ronchas en el cuerpo o hinchazón, consultá.',
  },
  {
    key: 'kiwi',
    name: 'Kiwi',
    emoji: '🥝',
    group: 'frutas',
    fromMonths: 6,
    vitaminC: true,
    color: 'verde',
    puree: 'Bien maduro y pelado, pisado crudo. Es ácido: mezclalo con banana o pera.',
    blw: 'Gajos o bastones gruesos, pelados y maduros. Pasalos por avena molida para que no resbalen.',
    caution:
      'Puede irritar la boca o enrojecer la piel por contacto. Si notás hinchazón de labios o ronchas, suspendelo y consultá.',
  },
  {
    key: 'naranja',
    name: 'Naranja',
    emoji: '🍊',
    group: 'frutas',
    fromMonths: 6,
    vitaminC: true,
    color: 'naranja',
    puree:
      'Gajos pelados, sin semillas ni membranas, pisados o procesados con otra fruta. Fruta, no jugo.',
    blw: 'Un cuarto grande con cáscara y sin semillas, para que chupe la pulpa. Si arranca pedazos de cáscara o de membrana, sacáselos.',
    caution:
      'Sacale todas las semillas. La acidez puede enrojecer la piel alrededor de la boca, sin que sea alergia.',
  },
  {
    key: 'mandarina',
    name: 'Mandarina',
    emoji: '🍊',
    group: 'frutas',
    fromMonths: 6,
    vitaminC: true,
    color: 'naranja',
    puree: 'Gajos sin semillas y sin la membrana, pisados o mezclados con otra fruta.',
    blw: 'Gajos sin semillas, abiertos y aplastados entre tus dedos, o sin la membrana. Enteros, no.',
    caution: 'El gajo entero, con su membrana, puede trabarse: abrilo y aplastalo. Sin semillas.',
  },
  {
    key: 'melon',
    name: 'Melón',
    emoji: '🍈',
    group: 'frutas',
    fromMonths: 6,
    vitaminC: true,
    color: 'naranja',
    puree:
      'Bien maduro, sin cáscara ni semillas, pisado o procesado crudo. Queda líquido: espesalo con banana o avena.',
    blw: 'Tajadas largas y gruesas de melón muy maduro, sin cáscara ni semillas.',
  },
  {
    key: 'sandia',
    name: 'Sandía',
    emoji: '🍉',
    group: 'frutas',
    fromMonths: 6,
    color: 'rojo',
    puree:
      'Sin cáscara ni semillas, pisada o procesada. Es casi toda agua: mezclala con una fruta más espesa.',
    blw: 'Bastones o triángulos grandes, sin cáscara y sin semillas. Es blanda y fácil de manejar.',
    caution: 'Sacale todas las semillas negras.',
  },
  {
    key: 'uvas',
    name: 'Uvas',
    emoji: '🍇',
    group: 'frutas',
    fromMonths: 6,
    color: 'violeta',
    puree: 'Peladas y sin semillas, pisadas o procesadas con otra fruta.',
    blw: 'Siempre en cuartos a lo largo, sin semillas y, al principio, peladas.',
    caution:
      'Enteras son de los alimentos con más riesgo de atragantamiento: nunca enteras ni en rodajas, siempre en cuartos a lo largo.',
  },
  {
    key: 'arandanos',
    name: 'Arándanos',
    aliases: ['blueberries'],
    emoji: '🫐',
    group: 'frutas',
    fromMonths: 6,
    color: 'violeta',
    puree:
      'Crudos o cocidos un par de minutos, procesados. Mezclados con yogur natural o avena quedan muy ricos.',
    blw: 'Aplastados entre tus dedos (que queden como un disquito) o cortados en cuartos. Nunca enteros.',
    caution: 'Enteros tienen riesgo de atragantamiento: siempre aplastados o cortados.',
  },
  {
    key: 'higo',
    name: 'Higo',
    aliases: ['breva'],
    emoji: '🟣',
    group: 'frutas',
    fromMonths: 6,
    color: 'violeta',
    puree:
      'Bien maduro y sin el cabito, pisado con o sin piel. Los secos, hidratados y procesados.',
    blw: 'Mitades o cuartos de higo maduro, a lo largo. La piel fina se puede dejar si está blanda.',
    caution: 'Los higos secos son duros y pegajosos: solo hidratados y bien procesados.',
  },
  {
    key: 'mamon',
    name: 'Mamón',
    aliases: ['papaya', 'papaia'],
    emoji: '🟠',
    group: 'frutas',
    fromMonths: 6,
    vitaminC: true,
    color: 'naranja',
    puree:
      'Bien maduro, sin cáscara ni semillas, pisado crudo con tenedor. Mezclado con banana queda más espeso.',
    blw: 'Tiras gruesas y largas de mamón maduro. Resbala: pasalas por avena molida.',
    caution: 'Solo fresco: el dulce de mamón y el de almíbar tienen mucho azúcar.',
  },
  {
    key: 'anana',
    name: 'Ananá',
    aliases: ['piña'],
    emoji: '🍍',
    group: 'frutas',
    fromMonths: 6,
    vitaminC: true,
    color: 'amarillo',
    puree:
      'Bien maduro, sin cáscara ni el centro duro, procesado crudo y mezclado con otra fruta. Fresco, no en almíbar.',
    blw: 'Bastones grandes de ananá muy maduro, sin el centro duro, para que chupe y muerda. Si arranca fibras, ofrecelo rallado.',
    caution: 'Es fibroso y ácido: puede irritar la boca. El de lata en almíbar tiene azúcar.',
  },
  {
    key: 'cereza',
    name: 'Cereza',
    emoji: '🍒',
    group: 'frutas',
    fromMonths: 6,
    color: 'rojo',
    puree: 'Sin carozo ni cabito, pisadas o procesadas. Las bien maduras se pisan fácil.',
    blw: 'Sin carozo, cortadas en cuartos o aplastadas entre tus dedos.',
    caution:
      'Enteras o con carozo tienen riesgo de atragantamiento: sacales siempre el carozo y cortalas.',
  },
  {
    key: 'frambuesas',
    name: 'Frambuesas',
    emoji: '🔴',
    group: 'frutas',
    fromMonths: 6,
    vitaminC: true,
    color: 'rojo',
    puree:
      'Lavalas con cuidado y pisalas o procesalas; si molestan las semillitas, pasalas por un colador.',
    blw: 'Enteras y un poco aplastadas entre tus dedos: son blandas y se desarman fácil.',
  },
  {
    key: 'moras',
    name: 'Moras',
    aliases: ['zarzamora'],
    emoji: '🫐',
    group: 'frutas',
    fromMonths: 6,
    vitaminC: true,
    color: 'violeta',
    puree:
      'Lavalas bien y pisalas o procesalas; si molestan las semillitas, pasalas por un colador.',
    blw: 'Aplastadas entre tus dedos, o cortadas en cuartos a lo largo si son grandes.',
    caution: 'Las grandes y firmes, mejor cortadas: enteras pueden trabarse.',
  },

  // ─── Cereales, papa y pastas ─────────────────────────────────────────────
  {
    key: 'papa',
    name: 'Papa',
    emoji: '🥔',
    group: 'cereales',
    fromMonths: 6,
    color: 'blanco',
    puree:
      'Pelala y hervila o cocinala al vapor hasta que esté muy blanda. Pisala con leche materna o fórmula y un chorrito de aceite de oliva: es la base ideal para mezclar.',
    blw: 'Bastones del largo de un dedo, al horno o al vapor, bien blandos. Nada de papas fritas de paquete.',
  },
  {
    key: 'batata',
    name: 'Batata',
    aliases: ['camote', 'boniato'],
    emoji: '🍠',
    group: 'cereales',
    fromMonths: 6,
    color: 'naranja',
    puree:
      'Pelala y cocinala al vapor, hervida o al horno hasta que esté muy blanda; pisala con un chorrito de aceite de oliva. Es dulce y suele gustarles mucho.',
    blw: 'Bastones o gajos del largo de un dedo, al horno o al vapor, hasta que se aplasten entre tus dedos.',
  },
  {
    key: 'mandioca',
    name: 'Mandioca',
    aliases: ['yuca'],
    emoji: '🥔',
    group: 'cereales',
    fromMonths: 6,
    color: 'blanco',
    puree:
      'Pelala, sacale la fibra del centro y hervila hasta que esté muy blanda. Pisala con un chorrito de aceite de oliva; si queda pegajosa, aflojala con agua de cocción.',
    blw: 'Bastones hervidos y después dorados al horno, bien blandos por dentro y sin la fibra del centro.',
    caution: 'Siempre bien cocida: cruda es tóxica. Sacale la cáscara y la fibra dura del centro.',
  },
  {
    key: 'choclo',
    name: 'Choclo',
    aliases: ['maíz', 'elote', 'mazorca'],
    emoji: '🌽',
    group: 'cereales',
    fromMonths: 6,
    color: 'amarillo',
    puree:
      'Granos cocidos, procesados y pasados por colador para sacar la piel, que es dura. Queda muy rico mezclado con zapallo.',
    blw: 'Un trozo grande de mazorca cocida, para que raspe y chupe los granos con las encías.',
    caution: 'Los granos sueltos enteros pueden trabarse: pisalos o procesalos.',
  },
  {
    key: 'arroz',
    name: 'Arroz',
    emoji: '🍚',
    group: 'cereales',
    fromMonths: 6,
    color: 'blanco',
    puree:
      'Cocinalo con bastante agua hasta que quede muy blando y pisalo o procesalo con verduras. Con las semanas, dejalo más entero.',
    blw: 'Arroz bien cocido y pegajoso, armado en bolitas o medallones con verduras pisadas, para que lo agarre con la mano.',
    caution:
      'No lo uses como único cereal: alterná con avena, polenta y otros, porque el arroz puede acumular arsénico.',
  },
  {
    key: 'avena',
    name: 'Avena',
    aliases: [
      'copos de avena',
      'avena arrollada',
      'avena instantánea',
      'harina de avena',
      'salvado de avena',
    ],
    emoji: '🌾',
    group: 'cereales',
    fromMonths: 6,
    iron: 'medium',
    color: 'marron',
    puree:
      'Copos cocidos en agua hasta que estén blandos; procesalos si hace falta y al final sumá leche materna o fórmula. Endulzá con fruta pisada, nunca con azúcar.',
    blw: 'Avena cocida espesa en bolitas, o medallones de banana pisada y avena al horno. Molida, sirve para rebozar fruta resbaladiza.',
    caution: 'Si no dice "sin TACC", puede tener trazas de trigo.',
  },
  {
    key: 'polenta',
    name: 'Polenta',
    aliases: ['harina de maíz', 'sémola de maíz', 'maíz molido'],
    emoji: '🌽',
    group: 'cereales',
    fromMonths: 6,
    color: 'amarillo',
    puree:
      'Cocinala en agua revolviendo hasta que quede blanda y cremosa, sin caldo en cubo. Sumale puré de verduras, ricota o un chorrito de aceite de oliva.',
    blw: 'Hacela más firme, dejala enfriar en una fuente y cortala en bastones del largo de un dedo. Podés dorarlos un poco al horno.',
  },
  {
    key: 'semola',
    name: 'Sémola',
    aliases: ['semolín', 'sémola de trigo'],
    emoji: '🌾',
    group: 'cereales',
    fromMonths: 6,
    allergens: ['trigo'],
    color: 'amarillo',
    puree:
      'Cocinala en agua revolviendo hasta que quede cremosa; al final podés sumar leche materna o fórmula. Sin azúcar: sumale fruta pisada.',
    blw: 'Sémola cocida bien firme, enfriada y cortada en bastones (tipo ñoquis a la romana) o armada en bolitas.',
    caution: 'Tiene trigo (gluten), que es alérgeno: las primeras veces, poquita cantidad.',
  },
  {
    key: 'fideos',
    name: 'Fideos',
    aliases: [
      'pasta',
      'tallarines',
      'spaghetti',
      'espaguetis',
      'tirabuzones',
      'mostacholes',
      'moñitos',
      'coditos',
      'municiones',
      'cabello de ángel',
    ],
    emoji: '🍝',
    group: 'cereales',
    fromMonths: 6,
    allergens: ['trigo'],
    color: 'amarillo',
    puree:
      'Fideos chicos (municiones, cabello de ángel) bien cocidos y pisados con puré de verduras o salsa de tomate casera sin sal.',
    blw: 'Fideos grandes (tirabuzones, mostacholes, penne) cocidos un poco más de lo normal, con salsa o aceite de oliva. Los largos también los agarran.',
    caution:
      'Tienen trigo (gluten): ofrecé poquito las primeras veces. Los fideos al huevo también tienen huevo.',
  },
  {
    key: 'pan',
    name: 'Pan',
    aliases: ['pan francés', 'pan casero', 'pan integral', 'pan de molde', 'tostada', 'miga'],
    emoji: '🍞',
    group: 'cereales',
    fromMonths: 6,
    allergens: ['trigo'],
    color: 'marron',
    puree:
      'Miga de pan remojada en leche materna, fórmula o en el puré, bien pisada: sirve para ir sumando gluten de a poco.',
    blw: 'Tostada en tiras del ancho de un dedo, untada finita con palta, ricota o pasta de maní. Mejor tostado que miga blanda.',
    caution:
      'Tiene sal: elegí el de menos sodio y ofrecelo de a poco. La miga blanda se hace un bollo pegajoso en la boca.',
  },
  {
    key: 'quinoa',
    name: 'Quinoa',
    aliases: ['quinua'],
    emoji: '🌾',
    group: 'cereales',
    fromMonths: 6,
    iron: 'medium',
    color: 'blanco',
    puree:
      'Lavala bien bajo el agua (si no, queda amarga), cocinala hasta que esté muy blanda y procesala con verduras.',
    blw: 'Cocida bien blanda y mezclada con verduras pisadas o huevo en medallones al horno, o para precargar la cuchara.',
  },
  {
    key: 'cuscus',
    name: 'Cuscús',
    aliases: ['couscous', 'cous cous', 'cus cus'],
    emoji: '🌾',
    group: 'cereales',
    fromMonths: 6,
    allergens: ['trigo'],
    color: 'amarillo',
    puree:
      'Hidratalo con agua caliente hasta que esté bien blando y mezclalo con puré de verduras o legumbres.',
    blw: 'Suelto es difícil de agarrar: mezclalo con verduras pisadas en bolitas o medallones, o precargá la cuchara.',
    caution: 'Es trigo (gluten): si todavía no lo probó, empezá por poquito.',
  },
  {
    key: 'cereal_fortificado',
    name: 'Cereal infantil fortificado',
    aliases: ['cereal para bebés', 'cereal infantil', 'cereal fortificado', 'papilla de cereales'],
    emoji: '🥣',
    group: 'cereales',
    fromMonths: 6,
    iron: 'high',
    color: 'amarillo',
    puree:
      'Preparalo como dice el envase, con agua, leche materna o fórmula, hasta una papilla suave. Sumale fruta o verdura pisada en vez de azúcar.',
    blw: 'Preparado espeso para precargar la cuchara, o mezclado en medallones de banana al horno.',
    caution:
      'Elegí uno sin azúcar agregada y leé la etiqueta: muchos traen trigo o leche (son alérgenos).',
  },

  // ─── Carnes y pescado ────────────────────────────────────────────────────
  {
    key: 'carne',
    name: 'Carne vacuna',
    aliases: [
      'carne',
      'carne de vaca',
      'carne picada',
      'carne roja',
      'ternera',
      'nalga',
      'peceto',
      'bife',
      'cuadril',
      'lomo',
      'bola de lomo',
    ],
    emoji: '🥩',
    group: 'carnes',
    fromMonths: 6,
    iron: 'high',
    color: 'rojo',
    puree:
      'Bien cocida (hervida, al horno o a la plancha) y procesada con el caldo de cocción o con puré de verduras. Con las semanas, procesala menos.',
    blw: 'Tira gruesa, tierna y bien cocida, del largo de un dedo, para que la chupe y la raspe; o albóndigas y medallones blanditos de carne picada.',
    caution:
      'La picada, siempre cocida hasta que no quede rosada por dentro (riesgo de SUH). Sacale nervios, grasa dura y partes fibrosas.',
  },
  {
    key: 'pollo',
    name: 'Pollo',
    aliases: [
      'carne de pollo',
      'carne picada de pollo',
      'pechuga',
      'muslo',
      'pata muslo',
      'suprema',
      'gallina',
    ],
    emoji: '🍗',
    group: 'carnes',
    fromMonths: 6,
    iron: 'medium',
    color: 'blanco',
    puree:
      'Bien cocido (hervido o al horno), sin piel ni huesos, procesado con su caldo o con verduras. El muslo queda más jugoso que la pechuga.',
    blw: 'Muslo bien cocido, sin piel ni huesitos chicos, para que lo chupe; o tiras tiernas de carne deshilachada. También en albóndigas.',
    caution:
      'Sacale la piel, los cartílagos y los huesitos sueltos. Siempre bien cocido, sin partes rosadas.',
  },
  {
    key: 'cerdo',
    name: 'Cerdo',
    aliases: ['carne de cerdo', 'chancho', 'bondiola', 'carré', 'solomillo', 'lomo de cerdo'],
    emoji: '🍖',
    group: 'carnes',
    fromMonths: 6,
    iron: 'medium',
    color: 'blanco',
    puree:
      'Cortes magros (lomo, solomillo) bien cocidos y sin grasa, procesados con caldo de cocción o con verduras.',
    blw: 'Tiras tiernas y bien cocidas del largo de un dedo, o desmenuzado en albóndigas. La bondiola cocida lento queda muy blanda.',
    caution:
      'Siempre bien cocido. Nada de fiambres ni embutidos (jamón, salame, salchichas, chorizo).',
  },
  {
    key: 'cordero',
    name: 'Cordero',
    aliases: ['carne de cordero'],
    emoji: '🍖',
    group: 'carnes',
    fromMonths: 6,
    iron: 'high',
    color: 'rojo',
    puree: 'Bien cocido y sin grasa, procesado con caldo de cocción o con puré de verduras.',
    blw: 'Tiras tiernas y bien cocidas para chupar, o picado en albóndigas y medallones.',
    caution: 'Sacale la grasa dura y todos los huesitos.',
  },
  {
    key: 'higado',
    name: 'Hígado',
    aliases: ['hígado vacuno', 'hígado de pollo', 'higaditos'],
    emoji: '🥩',
    group: 'carnes',
    fromMonths: 6,
    iron: 'high',
    color: 'marron',
    puree:
      'Bien cocido, sin partes rosadas, y procesado con puré de papa o zapallo. Queda como un paté suave.',
    blw: 'Como paté, untado finito en una tira de tostada, o picado dentro de albóndigas. En tiras suele quedar seco.',
    caution:
      'No más de una vez por semana y en poca cantidad (mucha vitamina A). Siempre bien cocido.',
  },
  {
    key: 'merluza',
    name: 'Merluza',
    aliases: ['pescado blanco', 'filet de merluza'],
    emoji: '🐟',
    group: 'carnes',
    fromMonths: 6,
    allergens: ['pescado'],
    iron: 'medium',
    color: 'blanco',
    puree:
      'Al vapor, hervida o al horno hasta que se desarme. Revisá que no tenga espinas y pisala con papa o zapallo.',
    blw: 'En lascas grandes, sin piel ni espinas, o en medallones con papa. Se desarma fácil: ideal para practicar.',
    caution:
      'Revisá con los dedos que no queden espinas. Es alérgeno: las primeras veces, de día y sin otro alimento nuevo.',
  },
  {
    key: 'salmon',
    name: 'Salmón',
    emoji: '🐟',
    group: 'carnes',
    fromMonths: 6,
    allergens: ['pescado'],
    iron: 'medium',
    color: 'naranja',
    puree:
      'Al horno o al vapor hasta que esté bien cocido, sin piel ni espinas, pisado con papa o batata.',
    blw: 'En lascas grandes sin espinas, o en medallones con papa. Se desarma fácil en la mano.',
    caution:
      'Revisá que no queden espinas. Fresco o congelado; nada de salmón ahumado (tiene mucha sal).',
  },
  {
    key: 'trucha',
    name: 'Trucha',
    emoji: '🐟',
    group: 'carnes',
    fromMonths: 6,
    allergens: ['pescado'],
    iron: 'medium',
    color: 'naranja',
    puree: 'Al horno o al vapor, sin piel ni espinas, pisada con papa o zapallo.',
    blw: 'Lascas grandes sin espinas, o desmenuzada en medallones con papa o zapallo.',
    caution: 'Tiene muchas espinas finas: revisala bien con los dedos antes de ofrecerla.',
  },
  {
    key: 'atun',
    name: 'Atún al natural',
    aliases: ['atún', 'atún en lata', 'atún al agua'],
    emoji: '🐟',
    group: 'carnes',
    fromMonths: 6,
    allergens: ['pescado'],
    iron: 'medium',
    color: 'marron',
    puree: 'Al natural (en agua), escurrido y enjuagado, pisado con papa, zapallo o palta.',
    blw: 'Desmenuzado y mezclado con papa o huevo en medallones al horno, o untado sobre tostada con palta.',
    caution:
      'Por el mercurio, que no sea de todos los días: alterná con merluza o sardinas. Elegí el bajo en sodio. Nunca atún rojo.',
  },
  {
    key: 'sardinas',
    name: 'Sardinas',
    emoji: '🐟',
    group: 'carnes',
    fromMonths: 6,
    allergens: ['pescado'],
    iron: 'medium',
    color: 'marron',
    puree:
      'Las de lata (en agua o en aceite de oliva), escurridas, sin el espinazo y bien pisadas con papa o palta.',
    blw: 'Pisadas y untadas sobre una tira de tostada, o mezcladas en medallones con papa.',
    caution:
      'Las enlatadas tienen sal: elegí bajas en sodio y en poca cantidad. Sacale el espinazo y pisá bien las espinitas.',
  },
  {
    key: 'langostinos',
    name: 'Langostinos',
    aliases: ['camarones', 'gambas', 'mariscos', 'frutos de mar'],
    emoji: '🦐',
    group: 'carnes',
    fromMonths: 12,
    allergens: ['mariscos'],
    color: 'naranja',
    puree: 'Desde el año: bien cocidos, pelados y sin la vena, procesados con papa o arroz.',
    blw: 'Desde el año: bien cocidos y picados finitos, o procesados en medallones. Enteros son gomosos.',
    caution:
      'Suelen ofrecerse después del año: no hace falta apurarlos. Son alérgeno: consultá con la pediatra cuándo empezar. Siempre bien cocidos y sin cabeza.',
  },

  // ─── Huevo y lácteos ─────────────────────────────────────────────────────
  {
    key: 'huevo',
    name: 'Huevo',
    aliases: ['huevo duro', 'huevo revuelto', 'omelette', 'tortilla de huevo', 'yema', 'clara'],
    emoji: '🥚',
    group: 'huevo_lacteos',
    fromMonths: 6,
    allergens: ['huevo'],
    iron: 'medium',
    color: 'amarillo',
    puree:
      'Duro, con la yema bien firme, pisado con leche materna, fórmula o agua, o mezclado en el puré de verduras. Yema y clara juntas, bien cocidas.',
    blw: 'Omelette bien cocida en tiras de un dedo (podés sumarle verduras ralladas), o huevo duro en cuartos a lo largo.',
    caution:
      'Siempre bien cocido, nada de yema blanda. Es alérgeno: conviene ofrecerlo temprano, de a un alérgeno nuevo por vez, de día y en poquita cantidad.',
  },
  {
    key: 'yogur',
    name: 'Yogur natural',
    aliases: ['yogur', 'yogurt', 'yoghurt', 'yogur entero', 'yogur natural entero', 'yogur griego'],
    emoji: '🥛',
    group: 'huevo_lacteos',
    fromMonths: 6,
    allergens: ['leche'],
    color: 'blanco',
    puree:
      'Entero, natural y sin azúcar, tal cual o mezclado con fruta pisada. Es una buena forma de empezar con la leche de vaca.',
    blw: 'Precargá la cuchara y dásela para que se la lleve a la boca, o usalo como salsa para mojar tiras de fruta.',
    caution:
      'Sin azúcar ni saborizado: los bebibles y los de frutas suelen tener azúcar. Es alérgeno (leche): empezá con poquito.',
  },
  {
    key: 'queso_cremoso',
    name: 'Queso cremoso',
    aliases: [
      'queso',
      'queso fresco',
      'cremoso',
      'port salut',
      'por salut',
      'mozzarella',
      'muzzarella',
    ],
    emoji: '🧀',
    group: 'huevo_lacteos',
    fromMonths: 6,
    allergens: ['leche'],
    color: 'blanco',
    puree: 'Rallado o en trocitos, derretido sobre el puré tibio de verduras, en poca cantidad.',
    blw: 'En láminas o tiras finitas, o derretido sobre verduras cocidas. Nunca en cubos.',
    caution:
      'Siempre pasteurizado: nada de queso de campo sin pasteurizar. Tiene sal: poca cantidad. En cubos tiene riesgo de atragantamiento.',
  },
  {
    key: 'queso_untable',
    name: 'Queso blanco untable',
    aliases: ['queso blanco', 'queso crema', 'queso untable'],
    emoji: '🧀',
    group: 'huevo_lacteos',
    fromMonths: 6,
    allergens: ['leche'],
    color: 'blanco',
    puree: 'Mezclado con puré de verduras o de fruta para darle cremosidad.',
    blw: 'Untado finito sobre tiras de tostada o sobre bastones de verdura cocida.',
    caution: 'Elegí el de menos sodio y sin saborizar. Es alérgeno (leche).',
  },
  {
    key: 'ricota',
    name: 'Ricota',
    aliases: ['ricotta', 'requesón'],
    emoji: '🧀',
    group: 'huevo_lacteos',
    fromMonths: 6,
    allergens: ['leche'],
    color: 'blanco',
    puree:
      'Tal cual o pisada con fruta o verduras. Tiene poca sal y textura suave: ideal para empezar con los lácteos.',
    blw: 'Untada sobre tiras de tostada, mezclada en medallones o tortillas, o en la cuchara precargada.',
    caution: 'Elegila fresca y pasteurizada. Es alérgeno (leche).',
  },
  {
    key: 'queso_rallado',
    name: 'Queso rallado',
    aliases: ['queso duro', 'queso de rallar', 'parmesano', 'reggianito', 'sardo'],
    emoji: '🧀',
    group: 'huevo_lacteos',
    fromMonths: 6,
    allergens: ['leche'],
    color: 'amarillo',
    puree: 'Una pizca espolvoreada sobre el puré o los fideos, para dar sabor.',
    blw: 'Una pizca sobre verduras o fideos: además ayuda a que no resbalen.',
    caution: 'Tiene mucha sal: solo una pizca para dar sabor, nunca como porción.',
  },
  {
    key: 'manteca',
    name: 'Manteca',
    aliases: ['mantequilla'],
    emoji: '🧈',
    group: 'huevo_lacteos',
    fromMonths: 6,
    allergens: ['leche'],
    color: 'amarillo',
    puree:
      'Un poquito de manteca derretida sobre el puré tibio. Para el día a día, mejor aceite de oliva.',
    blw: 'Untada finita sobre tostada o derretida sobre verduras cocidas.',
    caution: 'Sin sal y con moderación. Tiene proteína de leche: cuenta como alérgeno.',
  },

  // ─── Legumbres ───────────────────────────────────────────────────────────
  {
    key: 'lentejas',
    name: 'Lentejas',
    aliases: ['lentejas rojas'],
    emoji: '🫘',
    group: 'legumbres',
    fromMonths: 6,
    iron: 'high',
    color: 'marron',
    puree:
      'Remojalas, cocinalas hasta que se deshagan y procesalas (si molesta la piel, colalas). Las rojas no necesitan remojo y quedan muy suaves.',
    blw: 'Bien cocidas y pisadas en medallones o hamburguesitas con verduras, o espesas para precargar la cuchara.',
    caution:
      'Pueden dar gases: empezá de a poco. Sumá tomate o morrón en la misma comida para absorber mejor el hierro.',
  },
  {
    key: 'garbanzos',
    name: 'Garbanzos',
    emoji: '🫘',
    group: 'legumbres',
    fromMonths: 6,
    iron: 'high',
    color: 'amarillo',
    puree:
      'Remojados y bien cocidos, procesados con un chorrito de aceite de oliva. Si molesta la piel, pelalos o colalos.',
    blw: 'Aplastados, en medallones al horno o en hummus casero sin sal untado en tostada (si lleva tahini, también es sésamo).',
    caution:
      'Enteros tienen riesgo de atragantamiento: siempre aplastados o procesados. Los de lata, enjuagados (tienen sal).',
  },
  {
    key: 'porotos',
    name: 'Porotos',
    aliases: ['frijoles', 'alubias', 'judías'],
    emoji: '🫘',
    group: 'legumbres',
    fromMonths: 6,
    iron: 'high',
    color: 'marron',
    puree:
      'Remojalos varias horas, cocinalos hasta que se deshagan y procesalos. Si la piel molesta, colalos.',
    blw: 'Aplastados uno por uno, o pisados en medallones con verduras. También untados en tostada.',
    caution:
      'Siempre bien cocidos: crudos o a medio cocer pueden ser tóxicos. Enteros tienen riesgo de atragantamiento: aplastalos. Los de lata, enjuagados.',
  },
  {
    key: 'arvejas_partidas',
    name: 'Arvejas partidas',
    aliases: ['arvejas secas'],
    emoji: '🫛',
    group: 'legumbres',
    fromMonths: 6,
    iron: 'medium',
    color: 'verde',
    puree:
      'Cocinalas en agua hasta que se deshagan: quedan como un puré espeso y suave. Sumale zanahoria o zapallo.',
    blw: 'Puré espeso para precargar la cuchara, o en medallones con papa o verduras.',
    caution: 'Pueden dar gases: empezá con poquito.',
  },
  {
    key: 'tofu',
    name: 'Tofu',
    aliases: ['soja', 'porotos de soja', 'queso de soja'],
    emoji: '⬜',
    group: 'legumbres',
    fromMonths: 6,
    allergens: ['soja'],
    iron: 'medium',
    color: 'blanco',
    puree:
      'Firme o sedoso, pisado o procesado con fruta o verduras. Ya viene cocido, pero podés calentarlo.',
    blw: 'Tofu firme en bastones del largo de un dedo, salteados o al horno sin sal, o desmenuzado en medallones.',
    caution: 'Es alérgeno (soja): empezá con poquito. Elegilo sin sal ni salsas agregadas.',
  },

  // ─── Grasas buenas y semillas ────────────────────────────────────────────
  {
    key: 'aceite_oliva',
    name: 'Aceite de oliva',
    aliases: ['oliva', 'aceite de oliva extra virgen'],
    emoji: '🫒',
    group: 'grasas',
    fromMonths: 6,
    color: 'verde',
    puree: 'Un chorrito crudo sobre el puré ya servido: suma energía y grasas buenas.',
    blw: 'Un chorrito sobre las verduras cocidas, o para pintar los bastones antes de llevarlos al horno.',
  },
  {
    key: 'pasta_mani',
    name: 'Pasta de maní',
    aliases: ['mantequilla de maní', 'manteca de maní', 'crema de maní'],
    emoji: '🥜',
    group: 'grasas',
    fromMonths: 6,
    allergens: ['mani'],
    color: 'marron',
    puree:
      'Solo 100% maní, lisa, sin azúcar ni sal. Diluí un poquito con agua tibia o leche materna, o mezclala en el puré, el yogur o la avena.',
    blw: 'Untada muy finita sobre una tira de tostada, o mezclada en la avena. Nunca a cucharadas ni en bocados espesos.',
    caution:
      'Es alérgeno: conviene ofrecerla temprano, de día y de a poquito. Si tiene eczema severo o alergia al huevo, consultá antes con la pediatra.',
  },
  {
    key: 'mani_molido',
    name: 'Maní molido',
    aliases: ['maní', 'harina de maní', 'maní en polvo', 'cacahuate', 'cacahuete'],
    emoji: '🥜',
    group: 'grasas',
    fromMonths: 6,
    allergens: ['mani'],
    color: 'marron',
    puree: 'Maní sin sal molido bien fino, como polvo, mezclado en el puré, el yogur o la avena.',
    blw: 'Molido como polvo fino para rebozar fruta resbaladiza (banana, palta, mango). Nunca entero ni en trozos.',
    caution:
      'Entero o en trozos tiene alto riesgo de atragantamiento. Es alérgeno: la primera vez, poquito y de día.',
  },
  {
    key: 'almendras',
    name: 'Almendras molidas',
    aliases: ['almendras', 'harina de almendras', 'pasta de almendras', 'crema de almendras'],
    emoji: '🌰',
    group: 'grasas',
    fromMonths: 6,
    allergens: ['frutos_secos'],
    color: 'marron',
    puree:
      'Molidas bien finas (harina de almendras) y mezcladas en el puré, el yogur o la avena. La pasta de almendras, lisa y diluida.',
    blw: 'Como polvo fino para rebozar fruta resbaladiza, o en pasta lisa untada muy finita sobre tostada.',
    caution:
      'Nunca enteras ni en trozos: riesgo de atragantamiento por varios años. Es alérgeno: de a un fruto seco nuevo por vez.',
  },
  {
    key: 'nueces',
    name: 'Nueces molidas',
    aliases: ['nueces'],
    emoji: '🌰',
    group: 'grasas',
    fromMonths: 6,
    allergens: ['frutos_secos'],
    color: 'marron',
    puree: 'Molidas bien finas, como harina, y mezcladas en el puré, el yogur o la avena.',
    blw: 'Como polvo fino para rebozar fruta resbaladiza, o mezcladas en medallones. Nunca enteras ni en trozos.',
    caution:
      'Enteras o en trozos tienen alto riesgo de atragantamiento. Es alérgeno: de a un fruto seco nuevo por vez.',
  },
  {
    key: 'tahini',
    name: 'Tahini',
    aliases: ['tahina', 'pasta de sésamo', 'sésamo', 'semillas de sésamo', 'ajonjolí'],
    emoji: '🫙',
    group: 'grasas',
    fromMonths: 6,
    allergens: ['sesamo'],
    color: 'marron',
    puree:
      'Unas gotas mezcladas en el puré, el yogur o la papilla de cereal. Si está muy espeso, diluilo con agua tibia.',
    blw: 'Untado muy finito sobre una tira de tostada, o dentro de un hummus casero sin sal.',
    caution:
      'Es alérgeno: la primera vez, poquito y de día. Es espeso y pegajoso: nunca a cucharadas.',
  },
  {
    key: 'chia',
    name: 'Semillas de chía',
    aliases: ['chía'],
    emoji: '🌱',
    group: 'grasas',
    fromMonths: 6,
    color: 'marron',
    puree:
      'Molidas, o hidratadas antes en agua (quedan como un gel), y mezcladas en poca cantidad en el puré, el yogur o la avena.',
    blw: 'Molidas, para rebozar fruta resbaladiza, o hidratadas dentro de medallones.',
    caution:
      'Nunca secas a cucharadas: absorben agua y se hinchan. Siempre molidas o bien hidratadas.',
  },
  {
    key: 'lino',
    name: 'Semillas de lino',
    aliases: ['lino', 'linaza'],
    emoji: '🌾',
    group: 'grasas',
    fromMonths: 6,
    color: 'marron',
    puree:
      'Siempre molidas (enteras pasan sin digerirse), en poca cantidad, mezcladas en el puré, el yogur o la avena.',
    blw: 'Molidas, para rebozar fruta resbaladiza o dentro de medallones.',
  },
];

export const FOOD_BY_KEY: ReadonlyMap<string, Food> = new Map(
  FOODS.map((food) => [food.key, food]),
);

/** Con qué alimento del catálogo conviene presentar cada alérgeno por primera vez. */
export const ALLERGEN_FIRST_FOOD: Record<AllergenKey, string> = {
  leche: 'yogur',
  huevo: 'huevo',
  trigo: 'fideos',
  mani: 'pasta_mani',
  frutos_secos: 'almendras',
  pescado: 'merluza',
  mariscos: 'langostinos',
  soja: 'tofu',
  sesamo: 'tahini',
};

/** Lo que no va antes del año (no son alimentos del catálogo). */
export const AVOID_UNDER_12: readonly { name: string; why: string }[] = [
  {
    name: 'Miel',
    why: 'Puede tener esporas de botulismo, peligrosas antes del año. Ni sola, ni cocida, ni en preparaciones.',
  },
  {
    name: 'Leche de vaca como bebida principal',
    why: 'Tiene poco hierro y no reemplaza la leche materna ni la fórmula. Sí se puede usar en yogur, quesos y preparaciones.',
  },
  {
    name: 'Sal y caldos en cubo',
    why: 'Sus riñones todavía no manejan bien el sodio. Condimentá con hierbas, ajo, cebolla o aceite de oliva.',
  },
  {
    name: 'Azúcar, dulces y golosinas',
    why: 'No aportan nada y acostumbran a lo dulce. Incluye dulce de leche, galletitas, postrecitos, gaseosas y edulcorantes.',
  },
  {
    name: 'Jugos, aunque sean naturales',
    why: 'Concentran el azúcar de la fruta y desplazan comida y leche. Mejor la fruta entera, y agua para tomar.',
  },
  {
    name: 'Té, mate e infusiones',
    why: 'Dificultan absorber el hierro, algunos tienen cafeína y ciertos yuyos, como el anís estrellado, pueden ser tóxicos.',
  },
  {
    name: 'Fiambres, embutidos y ultraprocesados',
    why: 'Mucha sal, grasa y aditivos: jamón, salame, salchichas, chorizo, nuggets, snacks y sopas instantáneas.',
  },
  {
    name: 'Frutos secos enteros, pochoclo y caramelos',
    why: 'Alto riesgo de atragantamiento. El maní y los frutos secos, solo molidos bien finos o en pasta lisa diluida.',
  },
  {
    name: 'Uvas, arándanos y tomates cherry enteros',
    why: 'Por su forma redonda pueden tapar la vía aérea: siempre cortados en cuartos a lo largo o aplastados.',
  },
  {
    name: 'Pescados grandes con mercurio',
    why: 'Pez espada, tiburón, atún rojo y similares acumulan mercurio. Elegí merluza, salmón, trucha o sardinas.',
  },
  {
    name: 'Acelga, espinaca y remolacha',
    why: 'Hasta el año, salvo indicación de la pediatra: pueden acumular nitratos, que en bebés son riesgosos.',
  },
  {
    name: 'Bebidas vegetales como reemplazo de la leche',
    why: 'Las de almendra, arroz, avena o soja no reemplazan la leche materna ni la fórmula: les faltan nutrientes clave.',
  },
  {
    name: 'Huevo crudo o poco cocido',
    why: 'Riesgo de salmonela. Nada de yema blanda, mayonesa casera, merengue crudo ni mousse.',
  },
  {
    name: 'Carnes y pescados crudos o poco cocidos',
    why: 'Riesgo de infecciones como el SUH. La carne picada, bien cocida por dentro. Nada de sushi, ceviche ni carpaccio.',
  },
  {
    name: 'Leche y quesos sin pasteurizar',
    why: 'Pueden transmitir listeria, brucelosis y otras infecciones. Nada de leche cruda ni quesos de campo sin pasteurizar.',
  },
];

/** Minúsculas, sin tildes ni diacríticos (ñ → n), espacios colapsados y recortados. */
export function normalizeFoodName(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// ─── Búsqueda por texto libre ──────────────────────────────────────────────

/**
 * Forma "suelta" de una palabra para que singular y plural coincidan:
 * banana/bananas, melón/melones, tomate/tomates, nuez/nueces.
 * Se aplica igual al catálogo y a lo que escribe la familia.
 */
function looseWord(word: string): string {
  if (word.length <= 2) return word;
  let w = word.endsWith('s') ? word.slice(0, -1) : word;
  if (w.length > 2 && w.endsWith('e')) w = w.slice(0, -1);
  if (w.endsWith('z')) w = `${w.slice(0, -1)}c`;
  return w;
}

/** Palabras sueltas de un texto ya normalizado (sin signos de puntuación). */
function looseWords(normalized: string): string[] {
  return normalized
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((word) => word.length > 0)
    .map(looseWord);
}

/** ¿`needle` aparece en `haystack` como secuencia de palabras completas? */
function containsWords(haystack: readonly string[], needle: readonly string[]): boolean {
  if (needle.length === 0) return false;
  for (let i = 0; i + needle.length <= haystack.length; i++) {
    if (needle.every((word, j) => haystack[i + j] === word)) return true;
  }
  return false;
}

interface SearchTerm {
  readonly words: readonly string[];
  /** Largo del nombre normalizado: a igualdad de coincidencia gana el más largo. */
  readonly length: number;
  readonly food: Food;
}

const EXACT_INDEX = new Map<string, Food>();
const LOOSE_INDEX = new Map<string, Food>();
const SEARCH_TERMS: SearchTerm[] = [];

for (const food of FOODS) {
  for (const term of [food.name, ...(food.aliases ?? [])]) {
    const normalized = normalizeFoodName(term);
    const words = looseWords(normalized);
    if (!EXACT_INDEX.has(normalized)) EXACT_INDEX.set(normalized, food);
    const loose = words.join(' ');
    if (!LOOSE_INDEX.has(loose)) LOOSE_INDEX.set(loose, food);
    SEARCH_TERMS.push({ words, length: normalized.length, food });
  }
}

/**
 * Busca el alimento que escribió la familia ("Zapallos", "papilla de zapallo",
 * "pasta de maní"). Primero exacto (nombre o alias), después tolerante a
 * plurales y a texto alrededor, prefiriendo el nombre más largo que aparezca
 * como palabras completas. Devuelve null si no reconoce nada.
 */
export function matchFood(input: string): Food | null {
  const normalized = normalizeFoodName(input);
  if (normalized === '') return null;

  const exact = EXACT_INDEX.get(normalized);
  if (exact) return exact;

  const words = looseWords(normalized);
  if (words.length === 0) return null;

  const loose = LOOSE_INDEX.get(words.join(' '));
  if (loose) return loose;

  let best: SearchTerm | null = null;
  for (const term of SEARCH_TERMS) {
    if ((best === null || term.length > best.length) && containsWords(words, term.words)) {
      best = term;
    }
  }
  return best?.food ?? null;
}
