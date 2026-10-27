'use strict';
// Ejemplos resueltos paso a paso para «Ver ejemplo resuelto» (HU-17).
//
// Cada ejemplo pertenece a un tema (la misma categoría que usan las preguntas) y
// muestra cómo razonar una pregunta parecida: qué pista buscar, qué opciones
// descartar y por qué la respuesta correcta lo es. Para agregar más ejemplos basta
// con sumar un objeto al arreglo del tema correspondiente.

export const EJEMPLOS_RESUELTOS = {
  Historia: [
    {
      id: 'ej-historia-boyaca',
      enunciado: 'La batalla del 7 de agosto de 1819 abrió el camino de las tropas patriotas hacia Santafé de Bogotá. ¿Cuál fue?',
      opciones: ['Batalla de Carabobo', 'Batalla de Boyacá', 'Batalla de Pichincha', 'Batalla de Ayacucho'],
      correcta: 1,
      pasos: [
        'Busca las pistas del enunciado: la fecha (7 de agosto de 1819) y el destino de las tropas (Santafé de Bogotá).',
        'Ubica cada batalla en su lugar y su año: Carabobo fue en Venezuela (1821), Pichincha en Quito (1822) y Ayacucho en Perú (1824). Ninguna coincide con la fecha ni con el territorio de la Nueva Granada.',
        'Boyacá se libró en 1819 en el centro del país y dejó libre el camino hacia Bogotá.'
      ],
      conclusion: 'La respuesta correcta es «Batalla de Boyacá».'
    },
    {
      id: 'ej-historia-frente-nacional',
      enunciado: 'El Frente Nacional (1958-1974) fue un acuerdo entre liberales y conservadores. ¿Cuál era su rasgo central?',
      opciones: [
        'Suprimir los partidos políticos',
        'Alternar la presidencia entre los dos partidos y repartir los cargos por mitades',
        'Establecer un gobierno militar permanente',
        'Crear por primera vez elecciones libres'
      ],
      correcta: 1,
      pasos: [
        'Lee la pista clave: fue un acuerdo «entre liberales y conservadores», es decir, entre los dos partidos tradicionales.',
        'Descarta lo que contradice esa pista: los partidos no se suprimieron, se repartían el poder; y el Frente Nacional vino después del gobierno militar de Rojas Pinilla, no lo estableció.',
        'Su característica fue la alternancia: cada partido ocupaba la presidencia por turnos y los cargos públicos se repartían por mitades.'
      ],
      conclusion: 'La respuesta correcta es «Alternar la presidencia entre los dos partidos y repartir los cargos por mitades».'
    }
  ],

  Geografía: [
    {
      id: 'ej-geografia-orinoquia',
      enunciado: '¿Qué región natural de Colombia se caracteriza por sus llanuras abiertas, dedicadas sobre todo a la ganadería, y limita con Venezuela?',
      opciones: ['Amazonía', 'Región Pacífica', 'Orinoquía', 'Región Insular'],
      correcta: 2,
      pasos: [
        'Subraya las pistas: llanuras abiertas, ganadería y límite con Venezuela.',
        'Descarta por contraste: la Amazonía es selva; la región Pacífica es selva húmeda junto al océano; la Insular son islas en los mares.',
        'La región de llanuras extensas al oriente del país, que comparte frontera con Venezuela, es la Orinoquía (Llanos Orientales).'
      ],
      conclusion: 'La respuesta correcta es «Orinoquía».'
    },
    {
      id: 'ej-geografia-paramos',
      enunciado: 'Los páramos son ecosistemas de alta montaña. ¿Por qué son tan importantes para las personas?',
      opciones: [
        'Porque allí se extrae la mayor parte del petróleo',
        'Porque regulan y almacenan el agua que llega a ríos y acueductos',
        'Porque son las zonas de playa más visitadas',
        'Porque allí se cultiva la mayor parte del café'
      ],
      correcta: 1,
      pasos: [
        'Identifica de qué trata la pregunta: la importancia de un ecosistema de alta montaña para las personas.',
        'Descarta las opciones que no corresponden al ambiente de montaña: no hay playas en un páramo, y el café y el petróleo se producen en otras zonas.',
        'El páramo funciona como una esponja: capta la humedad y la libera poco a poco, y de allí nacen muchos ríos que abastecen a ciudades y campos.'
      ],
      conclusion: 'La respuesta correcta es «Porque regulan y almacenan el agua que llega a ríos y acueductos».'
    }
  ],

  'Constitución y Ciudadanía': [
    {
      id: 'ej-constitucion-tutela',
      enunciado: 'Una persona necesita un medicamento urgente y su EPS se lo niega, poniendo en riesgo su derecho a la salud. ¿Qué mecanismo puede usar para pedir protección inmediata?',
      opciones: ['Referendo', 'Revocatoria del mandato', 'Acción de tutela', 'Cabildo abierto'],
      correcta: 2,
      pasos: [
        'Identifica la situación: un derecho fundamental está en riesgo y hace falta una respuesta rápida.',
        'Descarta los mecanismos de participación política: el referendo, la revocatoria del mandato y el cabildo abierto sirven para decidir o controlar asuntos públicos, no para proteger el derecho de una persona.',
        'La acción de tutela (artículo 86 de la Constitución de 1991) permite pedir a un juez la protección inmediata de un derecho fundamental, y el juez debe responder en un plazo corto.'
      ],
      conclusion: 'La respuesta correcta es «Acción de tutela».'
    },
    {
      id: 'ej-constitucion-estado-social',
      enunciado: '¿Qué significa que Colombia sea un «Estado social de derecho»?',
      opciones: [
        'Que solo los jueces toman las decisiones del país',
        'Que las autoridades deben respetar la ley y garantizar condiciones dignas y derechos a las personas',
        'Que el mercado decide todo y el Estado no interviene',
        'Que el presidente puede cambiar las leyes cuando quiera'
      ],
      correcta: 1,
      pasos: [
        'Separa las dos partes de la expresión: «de derecho» (el poder se ejerce bajo la ley) y «social» (el Estado debe procurar el bienestar y la dignidad de las personas).',
        'Descarta lo que contradice alguna de las dos partes: un presidente que cambia las leyes a su gusto va contra «de derecho»; un Estado que no interviene va contra «social».',
        'La opción que une las dos ideas es la que habla de respetar la ley y garantizar derechos y condiciones dignas.'
      ],
      conclusion: 'La respuesta correcta es «Que las autoridades deben respetar la ley y garantizar condiciones dignas y derechos a las personas».'
    }
  ],

  'Sociedad y Cultura': [
    {
      id: 'ej-sociedad-pluriet',
      enunciado: 'Colombia se reconoce como un país pluriétnico y multicultural. ¿Qué implica esto en la vida diaria?',
      opciones: [
        'Que todos deben adoptar una sola cultura',
        'Que solo se reconoce la cultura de la mayoría',
        'Que los pueblos indígenas, afrodescendientes y otras comunidades tienen derecho a conservar su cultura y a ser respetados',
        'Que las comunidades deben ocultar sus costumbres en público'
      ],
      correcta: 2,
      pasos: [
        'Entiende las palabras clave: «pluriétnico» significa que conviven varios pueblos y «multicultural», que conviven varias culturas.',
        'Descarta las opciones que niegan esa convivencia: imponer una sola cultura, reconocer solo la mayoritaria u ocultar costumbres van contra la idea de diversidad.',
        'La Constitución de 1991 (artículo 7) reconoce y protege la diversidad étnica y cultural; por eso cada comunidad tiene derecho a conservar su cultura.'
      ],
      conclusion: 'La respuesta correcta es la que reconoce el derecho de las comunidades a conservar su cultura y a ser respetadas.'
    },
    {
      id: 'ej-sociedad-respeto',
      enunciado: 'Un grupo de estudiantes se burla de un compañero por su acento regional. ¿Cuál acción refleja respeto por la diversidad?',
      opciones: [
        'Reírse con el grupo para no quedar mal',
        'Pedirle al compañero que cambie su forma de hablar',
        'Valorar las distintas formas de hablar y pedir que se detengan las burlas',
        'Ignorar la situación porque no es asunto propio'
      ],
      correcta: 2,
      pasos: [
        'Identifica el problema: una burla basada en una diferencia cultural (el acento).',
        'Revisa cada opción con una pregunta: ¿esta acción reconoce al compañero como igual? Reírse, exigirle que cambie o ignorar lo dejan solo frente a la burla.',
        'Respetar la diversidad es valorar las diferencias como parte de la riqueza cultural y actuar para que no se conviertan en motivo de burla.'
      ],
      conclusion: 'La respuesta correcta es «Valorar las distintas formas de hablar y pedir que se detengan las burlas».'
    }
  ]
};
