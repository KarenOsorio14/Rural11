'use strict';
// Simulacros completos tipo ICFES.
//
// Cada simulacro se arma de forma determinista a partir del banco de preguntas de los
// cuestionarios (incluidas las lecturas). Se reparten las preguntas entre las 4 áreas
// para que todos los simulacros sean completos y mantengan el mismo nivel de exigencia.

import { QUESTIONNAIRES, TOPICS } from './questionnaires.data.js';

export const SIMULACRO_PASSING_PERCENTAGE = 60;
// Mismo mínimo de aprobación que los cuestionarios y la práctica libre.

const DISTRIBUTION = {
  // 25 preguntas en total: 6 + 6 + 6 + 7.
  historia: 6,
  geografia: 6,
  constitucion: 6,
  sociedad: 7
};

const SIMULACRO_BASE = [
  {
    id: 'simulacro-1',
    title: 'Simulacro 1 · Diagnóstico',
    shortTitle: 'Diagnóstico',
    badge: 'Punto de partida',
    description: 'Mide tu nivel actual con preguntas de las cuatro áreas de Ciencias Sociales.',
    durationMinutes: 50,
    seed: 1101
  },
  {
    id: 'simulacro-2',
    title: 'Simulacro 2 · Refuerzo',
    shortTitle: 'Refuerzo',
    badge: 'Entrenamiento',
    description: 'Una segunda prueba completa para afianzar lo aprendido y mejorar tu ritmo.',
    durationMinutes: 50,
    seed: 2202
  },
  {
    id: 'simulacro-3',
    title: 'Simulacro 3 · Saber 11',
    shortTitle: 'Saber 11',
    badge: 'Recta final',
    description: 'Simulación final con mezcla de todas las áreas, lecturas y preguntas de análisis.',
    durationMinutes: 50,
    seed: 3303
  }
];

/** Hash sencillo y estable para usar como semilla del generador aleatorio. */
function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Generador pseudoaleatorio determinista (mulberry32). */
function mulberry32(seed) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) | 0;
    let result = Math.imul(state ^ (state >>> 15), 1 | state);
    result = (result + Math.imul(result ^ (result >>> 7), 61 | result)) ^ result;
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

/** Baraja una copia de la lista sin modificar el arreglo original. */
function shuffle(list, random) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Banco de preguntas de un área, con los datos del tema y del cuestionario de origen. */
function questionPool(topic) {
  return QUESTIONNAIRES
    .filter((quiz) => quiz.category === topic.category)
    .flatMap((quiz) =>
      quiz.questions.map((question) => ({
        ...question,
        topicId: topic.id,
        topicName: topic.name,
        category: topic.category,
        sourceQuizId: quiz.id,
        sourceQuizTitle: quiz.title
      }))
    );
}

function buildQuestions(simulacro) {
  const selected = [];

  for (const topic of TOPICS) {
    const pool = questionPool(topic);
    const alreadyUsed = new Set(selected.map((question) => question.id));
    const available = pool.filter((question) => !alreadyUsed.has(question.id));
    const random = mulberry32(hashString(`${simulacro.id}:${topic.id}:${simulacro.seed}`));
    const wanted = DISTRIBUTION[topic.id] || 0;

    selected.push(...shuffle(available, random).slice(0, wanted));
  }

  // Mezcla final: las áreas quedan intercaladas, como en una prueba real.
  return shuffle(selected, mulberry32(hashString(`${simulacro.id}:mix:${simulacro.seed}`)));
}

export const SIMULACROS = SIMULACRO_BASE.map((simulacro) => {
  const questions = buildQuestions(simulacro);
  return {
    ...simulacro,
    questions,
    questionCount: questions.length,
    areaCount: TOPICS.length
  };
});

/** Devuelve un simulacro por id o null si no existe. */
export function getSimulacro(id) {
  return SIMULACROS.find((simulacro) => simulacro.id === id) || null;
}

/** Metadatos del simulacro, sin las preguntas (para listados). */
export function simulacroMeta(simulacro) {
  const { questions, ...meta } = simulacro;
  return meta;
}
