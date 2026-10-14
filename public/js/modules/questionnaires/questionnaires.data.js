'use strict';
// Modo estricto.
//
// NOTA GENERAL SOBRE ESTE ARCHIVO:
// Este archivo es puramente de DATOS (no tiene lógica/funciones). Contiene el catálogo
// fijo de temas y cuestionarios de la app. Por eso, en vez de comentar línea por línea
// cada pregunta (sería una repetición sin valor añadido), se documenta aquí la ESTRUCTURA
// de cada objeto, y luego el contenido se deja tal cual para que puedas leerlo como texto.
//
// Estructura de TOPICS (temas / módulos principales):
//   id          -> identificador corto usado en la URL (?topic=historia)
//   name        -> nombre completo mostrado en la UI
//   category    -> debe coincidir EXACTAMENTE con "category" de los cuestionarios de este tema
//   icon        -> emoji usado como ícono visual
//   description -> texto descriptivo corto
//   badge       -> etiqueta pequeña mostrada en la tarjeta del tema
//
// Estructura de QUESTIONNAIRES (cuestionarios, cada uno pertenece a un tema por "category"):
//   id              -> identificador único del cuestionario
//   title           -> título mostrado en la UI
//   description     -> descripción corta
//   category        -> debe coincidir con "category" de un TOPIC
//   difficulty      -> texto libre (Básico/Intermedio/Avanzado)
//   durationMinutes -> minutos estimados para completarlo
//   icon            -> emoji del cuestionario
//   questions       -> arreglo de preguntas, cada una con:
//       id            -> identificador corto de la pregunta
//       text          -> enunciado de la pregunta
//       options       -> arreglo de 4 posibles respuestas (texto)
//       correctIndex  -> índice (0-based) de la opción correcta dentro de "options"
//       explanation   -> texto que se muestra en la revisión, explicando la respuesta correcta

export const TOPICS = [
  {
    id: 'historia',
    name: 'Historia de Colombia y Universal',
    category: 'Historia',
    icon: '🏛️',
    description: 'Emancipación, culturas precolombinas, época republicana y acontecimientos del siglo XX.',
    badge: 'Procesos Históricos'
  },
  {
    id: 'geografia',
    name: 'Geografía y Territorio Nacional',
    category: 'Geografía',
    icon: '🌍',
    description: '6 regiones naturales, sistema andino de 3 cordilleras, páramos, biodiversidad y geopolítica.',
    badge: 'Espacio y Territorio'
  },
  {
    id: 'constitucion',
    name: 'Constitución y Competencias Ciudadanas',
    category: 'Constitución y Ciudadanía',
    icon: '⚖️',
    description: 'Estado Social de Derecho, derechos fundamentales, Acción de Tutela y mecanismos de participación.',
    badge: 'Democracia y Leyes'
  },
  {
    id: 'sociedad',
    name: 'Sociedad, Cultura y Diversidad Étnica',
    category: 'Sociedad y Cultura',
    icon: '🏺',
    description: 'Pluriculturalismo nacional, Declaración Universal de los DD.HH., sociología y pensamiento crítico.',
    badge: 'Cultura y Derechos'
  }
];
// Fin de TOPICS: 4 temas, cada uno enlazado por "category" a uno o más cuestionarios abajo.

export const QUESTIONNAIRES = [
  {
    id: 'historia-colombia-latam',
    title: 'Historia de Colombia y Procesos de Independencia',
    description: 'Comprende la emancipación nacional, culturas precolombinas y periodos clave del siglo XIX y XX.',
    category: 'Historia', // <- coincide con TOPICS[0].category
    difficulty: 'Intermedio',
    durationMinutes: 6,
    icon: '🏛️',
    questions: [
      // Cada pregunta: 4 opciones (índices 0-3) y correctIndex apunta a la respuesta válida.
      {
        id: 'h1',
        text: '¿Qué acontecimiento selló de forma definitiva la independencia de la Nueva Granada el 7 de agosto de 1819?',
        options: [
          'El Grito de Independencia del 20 de julio en Bogotá.',
          'La Batalla del Puente de Boyacá liderada por Simón Bolívar.',
          'La firma del Tratado de Versalles.',
          'El Asedio de Cartagena por Pablo Morillo.'
        ],
        correctIndex: 1, // -> "La Batalla del Puente de Boyacá..."
        explanation: 'La Batalla de Boyacá (7 de agosto de 1819) culminó la campaña libertadora y garantizó la retirada de las fuerzas realistas de la capital.'
      },
      {
        id: 'h2',
        text: '¿Cuáles fueron dos de las principales culturas precolombinas destacadas en el territorio colombiano por su orfebrería e ingeniería?',
        options: [
          'Los Aztecas y los Guaraníes.',
          'Los Muiscas (Confederación Chibcha) y los Tayronas.',
          'Los Mapuches y los Olmecas.',
          'Los Sioux y los Mayas.'
        ],
        correctIndex: 1,
        explanation: 'Los Muiscas en el altiplano cundiboyacense y los Tayronas en la Sierra Nevada de Santa Marta desarrollaron avanzados sistemas agrícolas y orfebres.'
      },
      {
        id: 'h3',
        text: '¿Qué proyecto de unión política integró a los territorios de las actuales Colombia, Venezuela, Ecuador y Panamá entre 1819 y 1830?',
        options: [
          'La Confederación Granadina.',
          'La Gran Colombia (República de Colombia).',
          'Los Estados Unidos de Colombia.',
          'El Virreinato del Río de la Plata.'
        ],
        correctIndex: 1,
        explanation: 'La Gran Colombia fue la república creada por el Congreso de Angostura y formalizada en Cúcuta en 1821, impulsada por Simón Bolívar.'
      },
      {
        id: 'h4',
        text: '¿Qué pacto político acordó la alternancia del poder presidencial entre los partidos Liberal y Conservador entre 1958 y 1974 en Colombia?',
        options: [
          'El Frente Nacional.',
          'El Pacto de San José.',
          'La Regeneración Republicana.',
          'El Plan Colombia.'
        ],
        correctIndex: 0, // -> "El Frente Nacional." (única pregunta de este bloque con respuesta en índice 0)
        explanation: 'El Frente Nacional fue un acuerdo que buscaba poner fin a la violencia bipartidista mediante la alternancia presidencial durante 16 años.'
      }
    ]
  },
  {
    id: 'geografia-territorio',
    title: 'Geografía y Territorio Nacional',
    description: 'Explora la riqueza geográfica, regiones naturales, biodiversidad y gestión ambiental de Colombia.',
    category: 'Geografía', // <- coincide con TOPICS[1].category
    difficulty: 'Básico / Intermedio',
    durationMinutes: 5,
    icon: '🌍',
    questions: [
      {
        id: 'g1',
        text: '¿Cuántas regiones naturales continentales e insulares componen el territorio colombiano?',
        options: [
          '4 regiones: Norte, Sur, Centro y Oriente.',
          '6 regiones: Caribe, Pacífica, Andina, Orinoquía, Amazonía e Insular.',
          '8 regiones biogeográficas.',
          '3 regiones: Costa, Cordillera y Llanura.'
        ],
        correctIndex: 1,
        explanation: 'Colombia cuenta con 6 regiones naturales diferenciadas por relieve, clima, vegetación y dinámica sociocultural.'
      },
      {
        id: 'g2',
        text: '¿En cuántas cordilleras principales se divide el sistema montañoso andino al ingresar a Colombia por el Nudo de los Pastos?',
        options: [
          'Dos: Cordillera Norte y Cordillera Sur.',
          'Tres: Cordillera Occidental, Central y Oriental.',
          'Cuatro ramales montañosos.',
          'Una sola cordillera continua.'
        ],
        correctIndex: 1,
        explanation: 'Los Andes colombianos se trifurcan en la Cordillera Occidental, Central (la más volcánica y alta) y Oriental (la más extensa).'
      },
      {
        id: 'g3',
        text: '¿Qué ecosistema de alta montaña andino es considerado la principal fábrica natural de agua dulce en Colombia?',
        options: [
          'El bosque seco tropical.',
          'El páramo.',
          'La sabana inundable.',
          'El manglar costero.'
        ],
        correctIndex: 1,
        explanation: 'Los páramos (como Sumapaz y Chingaza) retienen y regulan el agua que abastece a la mayoría de la población colombiana.'
      },
      {
        id: 'g4',
        text: '¿Por qué Colombia es clasificada como un país con posición geoestratégica privilegiada?',
        options: [
          'Por tener costas en dos océanos (Atlántico y Pacífico) y servir de puente natural entre Centro y Suramérica.',
          'Por encontrarse en el círculo polar ártico.',
          'Por carecer de zonas montañosas.',
          'Por tener una sola estación climática al año.'
        ],
        correctIndex: 0,
        explanation: 'La bioceanidad y su ubicación en la esquina noroccidental de Suramérica le otorgan ventajas comerciales, ecológicas y de conectividad global.'
      }
    ]
  },
  {
    id: 'constitucion-ciudadania',
    title: 'Constitución Política y Competencias Ciudadanas',
    description: 'Aprende sobre derechos fundamentales, ramas del poder público y mecanismos de participación democrática.',
    category: 'Constitución y Ciudadanía', // <- coincide con TOPICS[2].category
    difficulty: 'Avanzado',
    durationMinutes: 7,
    icon: '⚖️',
    questions: [
      {
        id: 'c1',
        text: '¿Cuál es el mecanismo constitucional expedito para la protección inmediata de los derechos fundamentales vulnerados o amenazados?',
        options: [
          'La Acción de Grupo.',
          'La Acción de Tutela (Artículo 86 de la Constitución de 1991).',
          'El Recurso de Casación penal.',
          'La Demanda de Inconstitucionalidad.'
        ],
        correctIndex: 1,
        explanation: 'La Acción de Tutela permite a cualquier ciudadano reclamar ante los jueces la protección inmediata de derechos fundamentales como la salud, vida o debido proceso.'
      },
      {
        id: 'c2',
        text: '¿Cuáles son las tres ramas del poder público en el Estado colombiano?',
        options: [
          'Presidencia, Policía y Ejército.',
          'Rama Ejecutiva, Rama Legislativa y Rama Judicial.',
          'Alcaldías, Gobernaciones y Ministerios.',
          'Fiscalía, Procuraduría y Contraloría.'
        ],
        correctIndex: 1,
        explanation: 'La Rama Ejecutiva administra, la Legislativa crea y reforma leyes (Congreso), y la Judicial administra justicia (Cortes y Tribunales).'
      },
      {
        id: 'c3',
        text: '¿Qué mecanismo de participación permite a los ciudadanos pronunciarse formalmente sobre una decisión de trascendencia nacional convocada por el Presidente?',
        options: [
          'El Cabildo Abierto.',
          'El Plebiscito.',
          'La Consulta Previa.',
          'La Revocatoria de Mandato.'
        ],
        correctIndex: 1,
        explanation: 'El Plebiscito es el pronunciamiento del pueblo convocado por el Presidente para apoyar o rechazar una decisión del ejecutivo.'
      },
      {
        id: 'c4',
        text: 'Según el Artículo 1º de la Constitución de 1991, ¿cómo se define a Colombia?',
        options: [
          'Una Monarquía Parlamentaria.',
          'Un Estado Social de Derecho, organizado en forma de República unitaria, descentralizada y participativa.',
          'Una Confederación de estados independientes.',
          'Una República teocrática centralizada.'
        ],
        correctIndex: 1,
        explanation: 'Ser un Estado Social de Derecho implica que el Estado debe garantizar condiciones materiales de dignidad, justicia y equidad a sus habitantes.'
      }
    ]
  },
  {
    id: 'sociedad-cultura-derechos',
    title: 'Sociedad, Cultura y Diversidad Étnica',
    description: 'Profundiza en la diversidad cultural, derechos humanos universales y sociología comunitaria.',
    category: 'Sociedad y Cultura', // <- coincide con TOPICS[3].category
    difficulty: 'Intermedio',
    durationMinutes: 5,
    icon: '🏺',
    questions: [
      {
        id: 's1',
        text: '¿Qué principio constitucional reconoce que en Colombia conviven múltiples identidades indígenas, afrocolombianas, raizales, rom y mestizas?',
        options: [
          'El principio de Homogeneidad Cultural.',
          'El principio de Diversidad Étnica y Cultural de la Nación (Art. 7º).',
          'El Centralismo Administrativo.',
          'La Doctrina de la Asimilación Obligatoria.'
        ],
        correctIndex: 1,
        explanation: 'La Constitución de 1991 reconoce y protege la diversidad étnica y cultural como patrimonio fundamental de la nación.'
      },
      {
        id: 's2',
        text: '¿Qué documento histórico proclamado por la ONU en 1948 consagró los derechos inalienables de todos los seres humanos?',
        options: [
          'El Código de Hammurabi.',
          'La Declaración Universal de los Derechos Humanos.',
          'El Tratado de Westfalia.',
          'La Carta Magna de 1215.'
        ],
        correctIndex: 1,
        explanation: 'La Declaración Universal de los Derechos Humanos (1948) estableció los estándares universales de dignidad, libertad e igualdad humana.'
      },
      {
        id: 's3',
        text: '¿Qué concepto sociológico describe la capacidad de analizar críticamente los problemas sociales poniéndose en el lugar del otro?',
        options: [
          'Etnocentrismo radical.',
          'Empatía social y pensamiento crítico.',
          'Apatía ciudadana.',
          'Dogmatismo.'
        ],
        correctIndex: 1,
        explanation: 'La empatía social y el pensamiento crítico permiten comprender las realidades ajenas y construir convivencia pacífica en sociedades plurales.'
      }
    ]
  }
];
// Fin de QUESTIONNAIRES: 4 cuestionarios (uno por cada tema), con 3 o 4 preguntas cada uno.