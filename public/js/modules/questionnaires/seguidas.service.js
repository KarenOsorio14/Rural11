'use strict';
// «Practica tus conocimientos»: sesiones de 20 preguntas tipo ICFES al azar,
// con dificultad creciente, retroalimentación inmediata y progreso guardado.

import { AppError } from '../../core/errors.js';
import { QUESTIONNAIRES, TOPICS } from './questionnaires.data.js';
import { getAttemptsByUser, saveAttempt } from './questionnaires.repository.js';
import {
  deleteProgress as deleteProgressRecord,
  getProgress as getProgressRecord,
  saveProgress as saveProgressRecord
} from './seguidas.progress.repository.js';

export const SEGUIDAS_ID = 'preguntas-seguidas';
export const SEGUIDAS_SESSION_SIZE = 20;
export const SEGUIDAS_PASSING_PERCENTAGE = 60;

// La sesión avanza por tres bloques: primero preguntas directas, luego lecturas
// de aplicación y al final preguntas de inferencia. Los conteos suman 20.
export const SEGUIDAS_PLAN = [
  { level: 1, name: 'Básico', count: 6, description: 'Preguntas directas de repaso.' },
  { level: 2, name: 'Intermedio', count: 8, description: 'Lecturas y preguntas de aplicación.' },
  { level: 3, name: 'Avanzado', count: 6, description: 'Inferencias y casos de mayor exigencia.' }
];

const LEVEL_NAMES = Object.fromEntries(SEGUIDAS_PLAN.map((step) => [step.level, step.name]));
const TOPIC_BY_CATEGORY = new Map(TOPICS.map((topic) => [topic.category, topic]));

const EXAMPLE_TIPS = {
  Historia: 'Fíjate en el hecho, la fecha y su consecuencia.',
  Geografía: 'Relaciona el lugar o fenómeno con su causa y su efecto.',
  'Constitución y Ciudadanía': 'Identifica el derecho o mecanismo y explica a quién protege.',
  'Sociedad y Cultura': 'Distingue hechos, derechos y opiniones, y busca un ejemplo.'
};

/**
 * Nivel de una pregunta tipo ICFES.
 * Las preguntas directas (sin lectura) abren la sesión; después vienen las
 * lecturas y, al final, las preguntas de inferencia de cada texto.
 */
function questionLevel(quiz, questionIndex) {
  const difficulty = String(quiz.difficulty || '').toLowerCase();
  const isReading = quiz.id.includes('-lectura-');

  if (!isReading) {
    return difficulty.includes('avanzado') ? 2 : 1;
  }
  if (difficulty.includes('avanzado')) return 3;
  if (questionIndex === quiz.questions.length - 1) return 3;
  return 2;
}

/** Añade a cada pregunta los datos que necesita la sesión y la evaluación. */
function enrichQuestion(question, quiz, questionIndex) {
  const topic = TOPIC_BY_CATEGORY.get(quiz.category);
  const level = questionLevel(quiz, questionIndex);

  return {
    ...question,
    tema: topic ? topic.id : null,
    topicId: topic ? topic.id : null,
    topicName: topic ? topic.name : 'Ciencias Sociales',
    category: topic ? topic.category : quiz.category,
    level,
    levelName: LEVEL_NAMES[level] || 'Intermedio',
    quizId: quiz.id,
    quizTitle: quiz.title
  };
}

// Banco completo: únicamente preguntas de selección múltiple tipo ICFES.
export const SEGUIDAS_BANK = QUESTIONNAIRES.flatMap((quiz) =>
  quiz.questions.map((question, index) => enrichQuestion(question, quiz, index))
);

const BANK_BY_ID = new Map(SEGUIDAS_BANK.map((question) => [question.id, question]));

function shuffle(list) {
  const result = [...list];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Elige preguntas repartiendo turnos entre los temas. Así una misma sesión no
 * se llena de preguntas de una sola área.
 */
function pickBalanced(pool, count) {
  const byTopic = new Map();

  for (const question of shuffle(pool)) {
    const key = question.topicId || 'otros';
    if (!byTopic.has(key)) byTopic.set(key, []);
    byTopic.get(key).push(question);
  }

  const topics = shuffle([...byTopic.keys()]);
  const picked = [];

  while (picked.length < count && topics.length) {
    let added = false;

    for (const topic of topics) {
      if (picked.length >= count) break;
      const questions = byTopic.get(topic);
      if (questions.length) {
        picked.push(questions.pop());
        added = true;
      }
    }

    if (!added) break;
  }

  return picked;
}

/** Crea el orden aleatorio de una sesión nueva. */
export function createSeguidaSession() {
  const selected = [];
  const used = new Set();

  for (const step of SEGUIDAS_PLAN) {
    const pool = SEGUIDAS_BANK.filter((question) =>
      question.level === step.level && !used.has(question.id)
    );
    const chosen = pickBalanced(pool, step.count);

    for (const question of chosen) {
      if (!used.has(question.id)) {
        selected.push(question);
        used.add(question.id);
      }
    }
  }

  // Si en el futuro el banco cambia y un nivel no tiene suficientes preguntas,
  // se completa la sesión con las que queden disponibles.
  if (selected.length < SEGUIDAS_SESSION_SIZE) {
    const rest = shuffle(
      SEGUIDAS_BANK.filter((question) => !used.has(question.id))
    ).slice(0, SEGUIDAS_SESSION_SIZE - selected.length);
    selected.push(...rest);
  }

  return selected;
}

/** Ejemplo modelo que refuerza la respuesta correcta sin repetir la pregunta. */
export function buildCorrectExample(question) {
  const correct = question.options[question.correctIndex];
  const explanation = String(question.explanation || '').trim();

  return {
    text: `En una pregunta parecida, la respuesta correcta sería «${correct}».${explanation ? ` ${explanation}` : ''}`,
    tip: EXAMPLE_TIPS[question.category] || 'Compara la respuesta con la explicación y con el caso que plantea.'
  };
}

/** Carga y valida la sesión guardada. Si el banco cambió, la descarta. */
export async function getSeguidaProgress(userId) {
  const saved = await getProgressRecord(userId);
  if (!saved) return null;

  const ids = Array.isArray(saved.questionIds) ? saved.questionIds : [];
  if (ids.length !== SEGUIDAS_SESSION_SIZE) {
    await deleteProgressRecord(userId).catch(() => {});
    return null;
  }

  const questions = ids.map((id) => BANK_BY_ID.get(id));
  if (questions.some((question) => !question)) {
    await deleteProgressRecord(userId).catch(() => {});
    return null;
  }

  const answers = {};
  for (const [questionId, rawIndex] of Object.entries(saved.answers || {})) {
    const question = BANK_BY_ID.get(questionId);
    const index = Number(rawIndex);
    if (question && Number.isInteger(index) && index >= 0 && index < question.options.length) {
      answers[questionId] = index;
    }
  }

  const currentIndex = Math.max(
    0,
    Math.min(questions.length - 1, Number(saved.currentIndex) || 0)
  );

  return {
    ...saved,
    questions,
    answers,
    currentIndex,
    total: questions.length,
    answeredCount: Object.keys(answers).length
  };
}

/** Guarda respuestas, pregunta actual y datos mínimos para continuar. */
export async function saveSeguidaProgress(userId, data) {
  const ids = Array.isArray(data.questionIds) ? data.questionIds : [];
  const questions = ids.map((id) => BANK_BY_ID.get(id));

  if (questions.length !== SEGUIDAS_SESSION_SIZE || questions.some((question) => !question)) {
    throw new AppError('INVALID_PROGRESS', 'No se pudo guardar el avance de la sesión.');
  }

  const answers = {};
  for (const [questionId, rawIndex] of Object.entries(data.answers || {})) {
    const question = BANK_BY_ID.get(questionId);
    const index = Number(rawIndex);
    if (
      question &&
      ids.includes(questionId) &&
      Number.isInteger(index) &&
      index >= 0 &&
      index < question.options.length
    ) {
      answers[questionId] = index;
    }
  }

  return saveProgressRecord({
    userId,
    questionIds: ids,
    answers,
    currentIndex: Math.max(
      0,
      Math.min(questions.length - 1, Number(data.currentIndex) || 0)
    ),
    startedAt: data.startedAt || new Date().toISOString()
  });
}

/** Borra el avance cuando la sesión termina o se empieza de nuevo. */
export function clearSeguidaProgress(userId) {
  return deleteProgressRecord(userId);
}

/** Corrige la sesión y prepara el resumen por niveles. */
export function evaluateSeguida(questions, answers) {
  const selectedAnswers = answers || {};
  const byDifficulty = SEGUIDAS_PLAN.map((step) => ({
    level: step.level,
    name: step.name,
    total: 0,
    correct: 0
  }));

  let correctCount = 0;

  const review = questions.map((question) => {
    const raw = selectedAnswers[question.id];
    const selectedIndex = raw === undefined || raw === null ? null : Number(raw);
    const isCorrect = selectedIndex === question.correctIndex;
    if (isCorrect) correctCount += 1;

    const bucket = byDifficulty.find((item) => item.level === question.level);
    if (bucket) {
      bucket.total += 1;
      if (isCorrect) bucket.correct += 1;
    }

    return {
      id: question.id,
      text: question.text,
      options: question.options,
      selectedIndex,
      correctIndex: question.correctIndex,
      isCorrect,
      explanation: question.explanation,
      passage: question.passage || null,
      topicName: question.topicName,
      level: question.level,
      levelName: question.levelName,
      example: buildCorrectExample(question)
    };
  });

  const totalQuestions = questions.length;
  const percentage = totalQuestions ? Math.round((correctCount / totalQuestions) * 100) : 0;

  return {
    correctCount,
    totalQuestions,
    percentage,
    passed: percentage >= SEGUIDAS_PASSING_PERCENTAGE,
    review,
    byDifficulty,
    passingPercentage: SEGUIDAS_PASSING_PERCENTAGE
  };
}

/** Guarda la sesión completada en el historial general de intentos. */
export async function saveSeguidaAttempt(userId, result) {
  const record = await saveAttempt({
    userId,
    questionnaireId: SEGUIDAS_ID,
    questionnaireTitle: 'Practica tus conocimientos',
    category: 'Práctica continua',
    isSeguida: true,
    correctCount: result.correctCount,
    totalQuestions: result.totalQuestions,
    percentage: result.percentage,
    passed: result.passed,
    review: result.review,
    byDifficulty: result.byDifficulty
  });

  return { ...result, ...record };
}

/** Resumen para el inicio y la tarjeta de Práctica. */
export async function getSeguidaSummary(userId) {
  const [attempts, progress] = await Promise.all([
    getAttemptsByUser(userId),
    getSeguidaProgress(userId)
  ]);

  const own = attempts.filter((attempt) =>
    attempt && (attempt.isSeguida === true || attempt.questionnaireId === SEGUIDAS_ID)
  );
  const best = own.reduce(
    (current, attempt) => (!current || attempt.percentage > current.percentage ? attempt : current),
    null
  );

  return {
    attemptsCount: own.length,
    bestScore: best ? best.percentage : null,
    progress
  };
}
