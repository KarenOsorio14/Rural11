'use strict';
// Cuestionarios de LECTURA: cada pregunta va acompañada de un texto ("passage") que el
// estudiante debe leer antes de responder, como en la prueba Saber 11 de Ciencias Sociales.
//
// Estructura extra respecto a questionnaires.data.js:
//   shortTitle      -> nombre corto que se muestra en la ruta
//   question.passage -> { title, text, source? }  (el texto se reparte en párrafos con "\n")
// Varias preguntas pueden compartir el mismo texto (se declara una vez y se reutiliza).

// ---------- Historia ----------
const H_COMUNEROS = {
  title: 'Los Comuneros, 1781',
  text:
    'En 1781, en la provincia del Socorro, miles de campesinos, artesanos y pequeños comerciantes se levantaron contra los nuevos impuestos que la Corona española había creado para financiar sus guerras. Los rebeldes, conocidos como los Comuneros, marcharon hacia Santafé de Bogotá y lograron que las autoridades firmaran unas capitulaciones que reducían los tributos.\n' +
    'Sin embargo, las autoridades no cumplieron lo pactado y los principales líderes fueron castigados. Aun así, el movimiento mostró que el descontento contra el gobierno colonial era grande y que el pueblo podía organizarse para exigir cambios.'
};

const H_VIENTRES = {
  title: 'La esclavitud en la naciente república',
  text:
    'En 1821, el Congreso reunido en la Villa del Rosario de Cúcuta expidió la Ley de libertad de vientres, según la cual los hijos de las mujeres esclavizadas nacerían libres, aunque debían trabajar para los dueños de sus madres hasta los 18 años.\n' +
    'La medida no acabó de inmediato con la esclavitud: las personas que ya eran esclavizadas siguieron siéndolo, y la esclavitud solo fue abolida de manera definitiva en 1851, bajo el gobierno de José Hilario López.'
};

const H_1886 = {
  title: 'La Constitución de 1886',
  text:
    'Tras años de guerras civiles y de cambios constantes de constituciones, en 1886 se expidió una nueva Constitución impulsada por Rafael Núñez y Miguel Antonio Caro. Esta Carta cambió el modelo federal por una república centralista: el presidente nombraba a los gobernadores y el poder se concentró en Bogotá.\n' +
    'Además, reconoció a la religión católica como la de la Nación y le dio un papel importante a la Iglesia en la educación. La Constitución de 1886 estuvo vigente más de cien años, hasta 1991.'
};

const H_SIGLO_XX = {
  title: 'Dos hechos del siglo XX',
  text:
    'El 9 de abril de 1948 fue asesinado en Bogotá Jorge Eliécer Gaitán, líder del Partido Liberal y candidato presidencial, muy querido por los sectores populares. Su muerte provocó disturbios en la capital, conocidos como el Bogotazo, y marcó el inicio de una época de violencia entre liberales y conservadores.\n' +
    'Más de cuarenta años después, en 1990, estudiantes y ciudadanos impulsaron la "séptima papeleta" para pedir una Asamblea Nacional Constituyente, que redactó la Constitución de 1991.'
};

// ---------- Geografía ----------
const G_MACIZO = {
  title: 'El Macizo Colombiano',
  text:
    'En el suroccidente del país, principalmente en el departamento del Cauca, se levanta el Macizo Colombiano, también llamado Nudo de Almaguer. Desde allí la cordillera de los Andes se ramifica en las cordilleras que atraviesan el territorio.\n' +
    'En el Macizo nacen los ríos Magdalena, Cauca, Caquetá y Patía, por lo que se le conoce como "la estrella fluvial colombiana".'
};

const G_PISOS = {
  title: 'Pisos térmicos y café',
  text:
    'En Colombia la temperatura cambia con la altura: a mayor altura, menor temperatura. Por eso se distinguen los pisos térmicos: cálido (hasta unos 1.000 metros sobre el nivel del mar), templado (entre 1.000 y 2.000), frío (entre 2.000 y 3.000), páramo (por encima de 3.000) y nieves perpetuas (desde unos 4.700).\n' +
    'El café se cultiva principalmente en el piso templado, donde la temperatura moderada y las lluvias favorecen a la planta. El Paisaje Cultural Cafetero fue declarado Patrimonio Mundial por la UNESCO en 2011.'
};

const G_PACIFICO = {
  title: 'El Pacífico lluvioso',
  text:
    'La región Pacífica colombiana, que se extiende entre la cordillera Occidental y el océano Pacífico, es una de las más lluviosas del planeta. Allí hay selvas húmedas muy biodiversas y ríos caudalosos que sirven como vías de transporte.\n' +
    'Gran parte de su población es afrocolombiana e indígena, y muchas comunidades viven de la pesca, la agricultura y la minería artesanal.'
};

const G_PARAMOS = {
  title: 'Los páramos',
  text:
    'Los páramos son ecosistemas de alta montaña, ubicados por encima de los 3.000 metros aproximadamente, donde la vegetación almacena y libera lentamente el agua de la lluvia y la neblina. Por eso se dice que "producen" agua para millones de personas.\n' +
    'Colombia tiene la mayor extensión de páramos del mundo, y el de Sumapaz, cerca de Bogotá, es considerado el más grande.'
};

// ---------- Constitución ----------
const C_ART1 = {
  title: 'Artículo 1 de la Constitución',
  text:
    'Colombia es un Estado social de derecho, organizado en forma de República unitaria, descentralizada, con autonomía de sus entidades territoriales, democrática, participativa y pluralista, fundada en el respeto de la dignidad humana, en el trabajo y la solidaridad de las personas que la integran y en la prevalencia del interés general.',
  source: 'Constitución Política de Colombia de 1991, artículo 1'
};

const C_ART86 = {
  title: 'Artículo 86 de la Constitución (fragmento)',
  text:
    'Toda persona tendrá acción de tutela para reclamar ante los jueces, en todo momento y lugar, mediante un procedimiento preferente y sumario, por sí misma o por quien actúe a su nombre, la protección inmediata de sus derechos constitucionales fundamentales, cuando quiera que éstos resulten vulnerados o amenazados por la acción o la omisión de cualquier autoridad pública.',
  source: 'Constitución Política de Colombia de 1991, artículo 86'
};

const C_PARTICIPACION = {
  title: 'Participar es un derecho',
  text:
    'La Constitución de 1991 reconoce que los ciudadanos no solo participan votando para elegir a sus gobernantes. También pueden usar otros mecanismos: el plebiscito, el referendo y la consulta popular, para pronunciarse sobre decisiones importantes; el cabildo abierto, para discutir en una sesión pública asuntos de su municipio; la iniciativa popular, para proponer leyes; y la revocatoria del mandato, para retirar a un alcalde o gobernador que incumpla su programa de gobierno.'
};

const C_ESCOLAR = {
  title: 'El gobierno escolar',
  text:
    'En los colegios colombianos, la Ley 115 de 1994 establece un gobierno escolar en el que participan distintos actores: el rector, el consejo directivo, el consejo académico y, además, el personero estudiantil.\n' +
    'El personero es un estudiante del último grado que ofrece el colegio, elegido por el voto de sus compañeros para promover el cumplimiento de sus derechos y deberes.'
};

// ---------- Sociedad ----------
const S_ART7 = {
  title: 'Diversidad y lenguas en la Constitución',
  text:
    'Artículo 7. El Estado reconoce y protege la diversidad étnica y cultural de la Nación colombiana.\n' +
    'Artículo 10. El castellano es el idioma oficial de Colombia. Las lenguas y dialectos de los grupos étnicos son también oficiales en sus territorios. La enseñanza que se imparta en las comunidades con tradiciones lingüísticas propias será bilingüe.',
  source: 'Constitución Política de Colombia de 1991'
};

const S_CAUCA = {
  title: 'Cauca: un territorio de varios pueblos',
  text:
    'El departamento del Cauca es hogar de pueblos indígenas como los nasa, los misak y los yanaconas, de comunidades afrodescendientes en la costa Pacífica y de población campesina y mestiza. Esta mezcla se refleja en sus fiestas, su música y su comida.\n' +
    'Por ejemplo, las procesiones de la Semana Santa de Popayán fueron reconocidas por la UNESCO como Patrimonio Cultural Inmaterial de la Humanidad en 2009.'
};

const S_DUDH = {
  title: 'La Declaración Universal de los Derechos Humanos',
  text:
    'La Declaración Universal de los Derechos Humanos fue aprobada por la Asamblea General de las Naciones Unidas el 10 de diciembre de 1948, después de los horrores de la Segunda Guerra Mundial. Su artículo 1 dice: "Todos los seres humanos nacen libres e iguales en dignidad y derechos y, dotados como están de razón y conciencia, deben comportarse fraternalmente los unos con los otros".',
  source: 'Naciones Unidas, 1948'
};

const S_CAMPO = {
  title: 'Del campo a la ciudad',
  text:
    'Un informe local afirma: "En los últimos veinte años muchos jóvenes han dejado el campo para irse a la ciudad".\n' +
    'Un vecino opina: "Eso pasa porque a los jóvenes ya no les gusta trabajar la tierra". Otro vecino responde: "Se van porque en el campo hay pocas oportunidades de estudio y de empleo bien pagado".'
};

const LECTURAS_BASE = [
  // ===================== HISTORIA =====================
  {
    id: 'historia-lectura-colonia',
    shortTitle: 'De la Colonia a la República',
    title: 'Lectura: de la Colonia a la República',
    description: 'Lee dos textos sobre los Comuneros y la abolición de la esclavitud y responde.',
    category: 'Historia',
    difficulty: 'Lectura · Intermedio',
    durationMinutes: 7,
    questions: [
      {
        id: 'hl1', passage: H_COMUNEROS,
        text: 'Según el texto, ¿cuál fue la causa principal del levantamiento de los Comuneros?',
        options: [
          'La prohibición de hablar castellano.',
          'Los nuevos impuestos creados por la Corona española.',
          'La invasión de Napoleón a España.',
          'La abolición de la esclavitud.'
        ],
        correctIndex: 1,
        explanation: 'El texto dice que los rebeldes se levantaron contra los nuevos impuestos que la Corona había creado para financiar sus guerras.'
      },
      {
        id: 'hl2', passage: H_COMUNEROS,
        text: '¿Qué se puede concluir del texto sobre el movimiento comunero?',
        options: [
          'Logró de inmediato la independencia de la Nueva Granada.',
          'Fue un movimiento sin apoyo del pueblo.',
          'Mostró el descontento contra el gobierno colonial, aunque lo pactado no se cumplió.',
          'Terminó con un acuerdo que la Corona respetó por completo.'
        ],
        correctIndex: 2,
        explanation: 'Las autoridades incumplieron las capitulaciones, pero el movimiento demostró el descontento y la capacidad de organización del pueblo.'
      },
      {
        id: 'hl3', passage: H_VIENTRES,
        text: '¿Por qué la ley de 1821 no terminó de inmediato con la esclavitud?',
        options: [
          'Porque fue rechazada por el Congreso de Cúcuta.',
          'Porque solo se aplicó en Venezuela.',
          'Porque prohibía comprar esclavos, pero no mantenerlos.',
          'Porque solo daba libertad a los hijos de las mujeres esclavizadas; quienes ya eran esclavizados seguían siéndolo.'
        ],
        correctIndex: 3,
        explanation: 'La Ley de libertad de vientres liberaba a quienes nacieran después, pero no a las personas que ya estaban esclavizadas.'
      },
      {
        id: 'hl4', passage: H_VIENTRES, fixedOrder: true,
        text: 'Según el texto, ¿cuántos años pasaron entre la Ley de libertad de vientres y la abolición definitiva de la esclavitud?',
        options: ['10 años.', '20 años.', '30 años.', '40 años.'],
        correctIndex: 2,
        explanation: 'De 1821 a 1851 pasaron 30 años.'
      }
    ]
  },
  {
    id: 'historia-lectura-siglo-xx',
    shortTitle: 'Del siglo XIX al XX',
    title: 'Lectura: del siglo XIX al siglo XX',
    description: 'Lee sobre la Constitución de 1886, el Bogotazo y la séptima papeleta.',
    category: 'Historia',
    difficulty: 'Lectura · Intermedio',
    durationMinutes: 7,
    questions: [
      {
        id: 'hl5', passage: H_1886,
        text: '¿Qué cambio principal introdujo la Constitución de 1886?',
        options: [
          'Pasó de un modelo federal a una república centralista.',
          'Separó la Iglesia del Estado.',
          'Dio el voto a las mujeres.',
          'Creó la Acción de Tutela.'
        ],
        correctIndex: 0,
        explanation: 'El texto explica que cambió el modelo federal por una república centralista, con el poder concentrado en Bogotá.'
      },
      {
        id: 'hl6', passage: H_1886,
        text: 'Según el texto, ¿cuánto tiempo estuvo vigente aproximadamente la Constitución de 1886?',
        options: [
          'Menos de veinte años.',
          'Unos cincuenta años.',
          'Más de cien años.',
          'Solo durante el Frente Nacional.'
        ],
        correctIndex: 2,
        explanation: 'Estuvo vigente desde 1886 hasta 1991, más de cien años.'
      },
      {
        id: 'hl7', passage: H_SIGLO_XX,
        text: '¿Qué consecuencia tuvo el asesinato de Jorge Eliécer Gaitán según el texto?',
        options: [
          'El fin de la violencia entre liberales y conservadores.',
          'Disturbios en Bogotá y el inicio de una época de violencia bipartidista.',
          'La creación de la Asamblea Nacional Constituyente.',
          'La independencia de Colombia.'
        ],
        correctIndex: 1,
        explanation: 'Su muerte provocó el Bogotazo y marcó el comienzo de una época de violencia entre liberales y conservadores.'
      },
      {
        id: 'hl8', passage: H_SIGLO_XX,
        text: '¿Qué fue la "séptima papeleta" según el texto?',
        options: [
          'Un impuesto creado en 1990.',
          'Una ley del Congreso de 1948.',
          'Un partido político liberal.',
          'Una iniciativa de estudiantes y ciudadanos para pedir una Asamblea Nacional Constituyente.'
        ],
        correctIndex: 3,
        explanation: 'Fue un movimiento ciudadano que pidió una Asamblea Nacional Constituyente, la cual redactó la Constitución de 1991.'
      }
    ]
  },

  // ===================== GEOGRAFÍA =====================
  {
    id: 'geografia-lectura-relieve',
    shortTitle: 'Relieve, ríos y café',
    title: 'Lectura: relieve, ríos y pisos térmicos',
    description: 'Lee sobre el Macizo Colombiano y los pisos térmicos donde crece el café.',
    category: 'Geografía',
    difficulty: 'Lectura · Intermedio',
    durationMinutes: 6,
    questions: [
      {
        id: 'gl1', passage: G_MACIZO,
        text: 'Según el texto, ¿por qué el Macizo Colombiano se conoce como "la estrella fluvial colombiana"?',
        options: [
          'Porque allí nacen varios de los ríos más importantes del país.',
          'Porque tiene forma de estrella.',
          'Porque allí desembocan todos los ríos.',
          'Porque está cerca del mar Caribe.'
        ],
        correctIndex: 0,
        explanation: 'En el Macizo nacen los ríos Magdalena, Cauca, Caquetá y Patía, de ahí que se le llame estrella fluvial.'
      },
      {
        id: 'gl2', passage: G_MACIZO,
        text: '¿Cuál de estos ríos NO se menciona en el texto como nacido en el Macizo Colombiano?',
        options: ['Magdalena.', 'Cauca.', 'Atrato.', 'Patía.'],
        correctIndex: 2,
        explanation: 'El texto menciona el Magdalena, el Cauca, el Caquetá y el Patía. El Atrato no aparece en la lista (nace en el Chocó).'
      },
      {
        id: 'gl3', passage: G_PISOS,
        text: 'Un pueblo ubicado a 1.500 metros sobre el nivel del mar pertenece al piso térmico:',
        options: ['Cálido.', 'Frío.', 'Páramo.', 'Templado.'],
        correctIndex: 3,
        explanation: 'El piso templado va aproximadamente de los 1.000 a los 2.000 metros.'
      },
      {
        id: 'gl4', passage: G_PISOS,
        text: '¿Por qué el café se cultiva principalmente en el piso templado?',
        options: [
          'Porque allí no llueve.',
          'Porque la temperatura moderada y las lluvias favorecen a la planta.',
          'Porque es el piso más caliente.',
          'Porque solo allí hay nieves perpetuas.'
        ],
        correctIndex: 1,
        explanation: 'Según el texto, la temperatura moderada y las lluvias del piso templado favorecen el cultivo del café.'
      }
    ]
  },
  {
    id: 'geografia-lectura-regiones',
    shortTitle: 'Pacífico y páramos',
    title: 'Lectura: el Pacífico y los páramos',
    description: 'Lee sobre la región Pacífica y la importancia de los páramos para el agua.',
    category: 'Geografía',
    difficulty: 'Lectura · Intermedio',
    durationMinutes: 6,
    questions: [
      {
        id: 'gl5', passage: G_PACIFICO,
        text: '¿Qué consecuencia de las lluvias abundantes en la región Pacífica menciona el texto?',
        options: [
          'Falta de ríos.',
          'Desiertos extensos.',
          'Selvas húmedas muy biodiversas y ríos caudalosos usados como vías de transporte.',
          'Nieves perpetuas en toda la región.'
        ],
        correctIndex: 2,
        explanation: 'El texto dice que allí hay selvas húmedas muy biodiversas y ríos caudalosos que sirven de vías de transporte.'
      },
      {
        id: 'gl6', passage: G_PACIFICO,
        text: 'Según el texto, ¿entre qué límites se extiende la región Pacífica?',
        options: [
          'La cordillera Oriental y el mar Caribe.',
          'La cordillera Occidental y el océano Pacífico.',
          'La Amazonía y la Orinoquía.',
          'El río Magdalena y el río Cauca.'
        ],
        correctIndex: 1,
        explanation: 'La región se extiende entre la cordillera Occidental y el océano Pacífico.'
      },
      {
        id: 'gl7', passage: G_PARAMOS,
        text: '¿Por qué son tan importantes los páramos según el texto?',
        options: [
          'Porque almacenan y liberan lentamente el agua, que usan millones de personas.',
          'Porque en ellos se cultiva la mayor parte del café.',
          'Porque son el lugar más caliente del país.',
          'Porque allí desembocan los ríos.'
        ],
        correctIndex: 0,
        explanation: 'La vegetación del páramo almacena y libera el agua poco a poco; por eso "produce" agua para millones de personas.'
      },
      {
        id: 'gl8', passage: G_PARAMOS,
        text: 'Si se destruyera la vegetación de un páramo, ¿qué sería lo más probable?',
        options: [
          'Aumentaría la capacidad de guardar agua.',
          'Mejoraría el abastecimiento de agua.',
          'No cambiaría nada.',
          'Disminuiría su capacidad de regular el agua y podrían aparecer problemas de abastecimiento.'
        ],
        correctIndex: 3,
        explanation: 'Si la vegetación desaparece, el páramo pierde su capacidad de almacenar y regular el agua, y las poblaciones que dependen de ella se afectan.'
      }
    ]
  },

  // ===================== CONSTITUCIÓN =====================
  {
    id: 'constitucion-lectura-derechos',
    shortTitle: 'Derechos y tutela',
    title: 'Lectura: derechos y acción de tutela',
    description: 'Lee los artículos 1 y 86 de la Constitución y aplícalos a casos de la vida diaria.',
    category: 'Constitución y Ciudadanía',
    difficulty: 'Lectura · Avanzado',
    durationMinutes: 7,
    questions: [
      {
        id: 'cl1', passage: C_ART1,
        text: 'Según el artículo 1, ¿en qué está fundada Colombia?',
        options: [
          'En la riqueza, la tradición religiosa y la fuerza militar.',
          'En el respeto de la dignidad humana, el trabajo, la solidaridad y la prevalencia del interés general.',
          'En el federalismo y la monarquía.',
          'En la autonomía total de cada región para hacer sus propias leyes.'
        ],
        correctIndex: 1,
        explanation: 'El artículo 1 la funda en el respeto de la dignidad humana, en el trabajo y la solidaridad y en la prevalencia del interés general.'
      },
      {
        id: 'cl2', passage: C_ART1,
        text: 'Si Colombia es un Estado "pluralista", esto significa que:',
        options: [
          'Solo reconoce una religión y una cultura.',
          'Reconoce y acepta la diversidad de ideas, culturas y creencias.',
          'Tiene varios presidentes al mismo tiempo.',
          'Cada persona hace lo que quiere sin respetar a los demás.'
        ],
        correctIndex: 1,
        explanation: 'El pluralismo reconoce que en la sociedad conviven personas con ideas, culturas y creencias distintas, y las respeta.'
      },
      {
        id: 'cl3', passage: C_ART86,
        text: 'Un hospital público le niega la atención de urgencias a un niño con un problema grave de salud. ¿Qué mecanismo establece el texto para proteger su derecho de manera inmediata?',
        options: [
          'El plebiscito.',
          'La revocatoria del mandato.',
          'La acción de tutela.',
          'El cabildo abierto.'
        ],
        correctIndex: 2,
        explanation: 'La acción de tutela protege de manera inmediata los derechos fundamentales cuando una autoridad pública los vulnera o amenaza.'
      },
      {
        id: 'cl4', passage: C_ART86,
        text: '¿Qué característica tiene el procedimiento de la acción de tutela según el texto?',
        options: [
          'Es lento y solo se puede hacer una vez al año.',
          'Solo puede presentarla un abogado.',
          'Es preferente y sumario, es decir, prioritario y rápido.',
          'Solo procede contra particulares.'
        ],
        correctIndex: 2,
        explanation: 'El texto dice que se tramita mediante un procedimiento preferente y sumario: se atiende primero y de forma rápida.'
      }
    ]
  },
  {
    id: 'constitucion-lectura-participacion',
    shortTitle: 'Participación y colegio',
    title: 'Lectura: participación ciudadana y gobierno escolar',
    description: 'Lee sobre los mecanismos de participación y el personero estudiantil.',
    category: 'Constitución y Ciudadanía',
    difficulty: 'Lectura · Intermedio',
    durationMinutes: 6,
    questions: [
      {
        id: 'cl5', passage: C_PARTICIPACION,
        text: '¿Qué mecanismo permite retirar a un alcalde que incumple su programa de gobierno?',
        options: [
          'La iniciativa popular.',
          'La revocatoria del mandato.',
          'El cabildo abierto.',
          'El plebiscito.'
        ],
        correctIndex: 1,
        explanation: 'El texto dice que la revocatoria del mandato sirve para retirar a un alcalde o gobernador que incumpla su programa.'
      },
      {
        id: 'cl6', passage: C_PARTICIPACION,
        text: 'Un grupo de vecinos quiere discutir en una sesión pública un problema del barrio con el concejo municipal. ¿Qué mecanismo usarían?',
        options: [
          'El cabildo abierto.',
          'La revocatoria del mandato.',
          'La iniciativa popular.',
          'El referendo.'
        ],
        correctIndex: 0,
        explanation: 'El cabildo abierto permite discutir en una sesión pública asuntos del municipio.'
      },
      {
        id: 'cl7', passage: C_ESCOLAR,
        text: '¿Quién elige al personero estudiantil según el texto?',
        options: [
          'El rector.',
          'El consejo académico.',
          'Los profesores.',
          'Sus compañeros, mediante el voto.'
        ],
        correctIndex: 3,
        explanation: 'El personero es elegido por el voto de los estudiantes.'
      },
      {
        id: 'cl8', passage: C_ESCOLAR,
        text: '¿Por qué la elección del personero es un ejemplo de participación democrática?',
        options: [
          'Porque el rector decide quién lo será.',
          'Porque los estudiantes eligen a un representante que defiende sus derechos y deberes.',
          'Porque todos los estudiantes deben ser personeros.',
          'Porque no se vota, se sortea.'
        ],
        correctIndex: 1,
        explanation: 'En una democracia las personas eligen con su voto a quienes las representan, y el personero representa a los estudiantes.'
      }
    ]
  },

  // ===================== SOCIEDAD =====================
  {
    id: 'sociedad-lectura-diversidad',
    shortTitle: 'Diversidad y Cauca',
    title: 'Lectura: diversidad étnica y cultural',
    description: 'Lee la Constitución sobre la diversidad y un texto sobre los pueblos del Cauca.',
    category: 'Sociedad y Cultura',
    difficulty: 'Lectura · Intermedio',
    durationMinutes: 6,
    questions: [
      {
        id: 'sl1', passage: S_ART7,
        text: 'Según el texto, ¿en qué territorios son oficiales las lenguas de los grupos étnicos?',
        options: [
          'En todo el país, en lugar del castellano.',
          'Solo en las capitales.',
          'En los territorios de esos grupos étnicos.',
          'Solo en los colegios.'
        ],
        correctIndex: 2,
        explanation: 'El artículo 10 dice que las lenguas y dialectos de los grupos étnicos son oficiales en sus territorios.'
      },
      {
        id: 'sl2', passage: S_ART7,
        text: '¿Qué obligación tiene el Estado frente a la diversidad étnica y cultural según el artículo 7?',
        options: [
          'Eliminarla para unificar al país.',
          'Ignorarla.',
          'Reconocerla y protegerla.',
          'Limitarla a las zonas rurales.'
        ],
        correctIndex: 2,
        explanation: 'El artículo 7 dice que el Estado reconoce y protege la diversidad étnica y cultural de la Nación.'
      },
      {
        id: 'sl3', passage: S_CAUCA,
        text: '¿Cuál es la idea principal del texto sobre el Cauca?',
        options: [
          'El Cauca solo tiene población indígena.',
          'El Cauca es un territorio culturalmente diverso, con varios pueblos cuya mezcla se ve en sus expresiones culturales.',
          'La Semana Santa es la única fiesta del Cauca.',
          'La UNESCO administra los pueblos indígenas del Cauca.'
        ],
        correctIndex: 1,
        explanation: 'El texto muestra que en el Cauca conviven pueblos indígenas, afrodescendientes, campesinos y mestizos, y que eso se refleja en sus fiestas, música y comida.'
      },
      {
        id: 'sl4', passage: S_CAUCA,
        text: 'Las procesiones de la Semana Santa de Popayán son Patrimonio Cultural Inmaterial. ¿Qué significa "inmaterial"?',
        options: [
          'Que son tradiciones, fiestas y saberes que se transmiten de generación en generación, no solo edificios u objetos.',
          'Que ya no existen.',
          'Que solo se pueden ver en fotografías.',
          'Que pertenecen a un solo edificio.'
        ],
        correctIndex: 0,
        explanation: 'El patrimonio inmaterial incluye prácticas, fiestas, música y saberes que las comunidades transmiten con el tiempo.'
      }
    ]
  },
  {
    id: 'sociedad-lectura-pensamiento',
    shortTitle: 'Derechos y mirada crítica',
    title: 'Lectura: derechos humanos y pensamiento crítico',
    description: 'Lee la Declaración Universal y aprende a distinguir hechos de opiniones.',
    category: 'Sociedad y Cultura',
    difficulty: 'Lectura · Intermedio',
    durationMinutes: 6,
    questions: [
      {
        id: 'sl5', passage: S_DUDH,
        text: '¿Cuándo y por quién fue aprobada la Declaración Universal de los Derechos Humanos?',
        options: [
          'En 1991, por el Congreso de Colombia.',
          'En 1948, por la Asamblea General de las Naciones Unidas.',
          'En 1810, por la Corona española.',
          'En 1886, por la Corte Constitucional.'
        ],
        correctIndex: 1,
        explanation: 'Fue aprobada el 10 de diciembre de 1948 por la Asamblea General de las Naciones Unidas.'
      },
      {
        id: 'sl6', passage: S_DUDH,
        text: '¿Qué significa que "todos los seres humanos nacen libres e iguales en dignidad y derechos"?',
        options: [
          'Que todos tienen el mismo dinero.',
          'Que algunos tienen más derechos según su origen.',
          'Que todas las personas tienen el mismo valor y los mismos derechos desde que nacen, sin importar su origen.',
          'Que los derechos solo se adquieren al ser adulto.'
        ],
        correctIndex: 2,
        explanation: 'La igualdad en dignidad y derechos significa que nadie vale más que otro ni tiene más derechos por su origen, sexo, cultura o condición.'
      },
      {
        id: 'sl7', passage: S_CAMPO,
        text: '¿Cuál de estas afirmaciones es un hecho y no una opinión?',
        options: [
          'A los jóvenes ya no les gusta trabajar la tierra.',
          'La ciudad es mejor que el campo.',
          'Muchos jóvenes han dejado el campo para irse a la ciudad en los últimos veinte años.',
          'Los jóvenes se van por pereza.'
        ],
        correctIndex: 2,
        explanation: 'El hecho es lo que se puede comprobar con datos (un informe sobre la migración); lo demás son opiniones o explicaciones sin comprobar.'
      },
      {
        id: 'sl8', passage: S_CAMPO,
        text: '¿Qué haría una persona con pensamiento crítico ante las dos explicaciones de los vecinos?',
        options: [
          'Aceptar la primera porque la dijo un vecino.',
          'Elegir la que le parezca más cómoda.',
          'Ignorar el tema.',
          'Buscar datos y evidencias, como encuestas o cifras, para ver cuál explicación se sostiene mejor.'
        ],
        correctIndex: 3,
        explanation: 'El pensamiento crítico no acepta ideas sin revisar: contrasta las explicaciones con datos y evidencias.'
      }
    ]
  }
];

// Para que la respuesta correcta no quede casi siempre en la misma letra, las opciones se rotan
// de forma fija (siempre igual) hasta que la correcta caiga en la posición que toca.
// Las preguntas con opciones numéricas ordenadas (fixedOrder) no se rotan.
const TARGETS = [0, 2, 3, 1, 2, 0, 1, 3];
let counter = 0;
export const LECTURAS = LECTURAS_BASE.map((quiz) => ({
  ...quiz,
  questions: quiz.questions.map((question) => {
    const target = TARGETS[counter % TARGETS.length];
    counter += 1;
    if (question.fixedOrder) return question;
    const n = question.options.length;
    const shift = (target - question.correctIndex + n) % n;
    const options = question.options.map((_, i) => question.options[(i - shift + n) % n]);
    return { ...question, options, correctIndex: target };
  })
}));
