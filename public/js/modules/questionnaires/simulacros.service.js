'use strict';
// Servicio de simulacros: listado con estadísticas, evaluación y guardado del intento.

import { AppError } from '../../core/errors.js';
import { getAttemptsByUser, saveAttempt } from './questionnaires.repository.js';
import {
  deleteProgress as deleteProgressRecord,
  getAllProgress,
  getProgress as getProgressRecord,
  saveProgress as saveProgressRecord
} from './simulacros.progress.repository.js';
import {
  SIMULACROS,
  SIMULACRO_PASSING_PERCENTAGE,
  getSimulacro,
  simulacroMeta
} from './simulacros.data.js';

const SIMULACRO_CATEGORY = 'Simulacro ICFES';

/** Identifica los intentos que pertenecen a un simulacro. */
function isSimulacroAttempt(attempt) {
  return Boolean(
    attempt &&
    (attempt.isSimulacro === true || SIMULACROS.some((simulacro) => simulacro.id === attempt.questionnaireId))
  );
}

async function getSimulacroAttempts(userId) {
  const attempts = await getAttemptsByUser(userId);
  return attempts.filter(isSimulacroAttempt);
}

/** Resumen del progreso que se muestra en las tarjetas y en las instrucciones. */
function pausedSummary(progress) {
  if (!progress) return null;

  return {
    answeredCount: Object.keys(progress.answers || {}).length,
    current: Math.max(0, Number(progress.current) || 0),
    remainingSeconds: Math.max(0, Number(progress.remainingSeconds) || 0),
    updatedAt: progress.updatedAt || null
  };
}

/** Comprueba que el progreso corresponda al mismo banco de preguntas actual. */
function isCompatibleProgress(progress, simulacro) {
  if (!Array.isArray(progress.questionIds) || progress.questionIds.length === 0) {
    return true;
  }

  if (progress.questionIds.length !== simulacro.questions.length) return false;

  // También se conserva el orden: así la pregunta actual y el mapa siguen
  // apuntando a la misma posición si el banco de preguntas cambia.
  return progress.questionIds.every(
    (id, index) => simulacro.questions[index] && simulacro.questions[index].id === id
  );
}

/** Mapa de progresos pausados válidos, indexado por id de simulacro. */
async function getProgressMap(userId) {
  const progressList = await getAllProgress(userId);
  const map = new Map();

  for (const progress of progressList) {
    const simulacro = getSimulacro(progress.simulacroId);
    if (!simulacro || !isCompatibleProgress(progress, simulacro)) continue;
    map.set(progress.simulacroId, progress);
  }

  return map;
}

function withStats(simulacro, attempts, progress = null) {
  const own = attempts.filter((attempt) => attempt.questionnaireId === simulacro.id);
  const best = own.reduce(
    (current, attempt) => (!current || attempt.percentage > current.percentage ? attempt : current),
    null
  );

  return {
    ...simulacroMeta(simulacro),
    attemptsCount: own.length,
    bestScore: best ? best.percentage : null,
    passed: best ? Boolean(best.passed) : false,
    lastAttempt: own[0] || null,
    paused: pausedSummary(progress)
  };
}

/** Lista de simulacros con el mejor resultado y el progreso pausado del usuario. */
export async function getSimulacrosWithStats(userId) {
  const [attempts, progressMap] = await Promise.all([
    getSimulacroAttempts(userId),
    getProgressMap(userId)
  ]);

  return SIMULACROS.map((simulacro) => withStats(simulacro, attempts, progressMap.get(simulacro.id)));
}

/** Una sola consulta para pintar tanto las tarjetas como el historial en el inicio. */
export async function getSimulacrosDashboard(userId) {
  const [attempts, progressMap] = await Promise.all([
    getSimulacroAttempts(userId),
    getProgressMap(userId)
  ]);

  return {
    list: SIMULACROS.map((simulacro) => withStats(simulacro, attempts, progressMap.get(simulacro.id))),
    history: attempts
  };
}

/** Progreso pausado de un simulacro concreto, o null si no se puede retomar. */
export async function getPausedSimulacro(userId, simulacroId) {
  const simulacro = getSimulacroById(simulacroId);
  const progress = await getProgressRecord(userId, simulacroId);

  if (!progress) return null;

  if (!isCompatibleProgress(progress, simulacro)) {
    await clearSimulacroProgress(userId, simulacroId).catch(() => {});
    return null;
  }

  return { ...progress, ...pausedSummary(progress) };
}

/**
 * Guarda el avance y el tiempo restante de un simulacro pausado.
 * Solo se conservan respuestas y marcas de preguntas que existan en el simulacro.
 */
export async function saveSimulacroProgress(userId, simulacroId, data) {
  const simulacro = getSimulacroById(simulacroId);
  const limitSeconds = simulacro.durationMinutes * 60;
  const validIds = new Set(simulacro.questions.map((question) => question.id));

  const answers = {};
  for (const [questionId, selectedIndex] of Object.entries(data.answers || {})) {
    const index = Number(selectedIndex);
    const question = simulacro.questions.find((item) => item.id === questionId);
    if (question && Number.isInteger(index) && index >= 0 && index < question.options.length) {
      answers[questionId] = index;
    }
  }

  const flags = (Array.isArray(data.flags) ? data.flags : []).filter((id) => validIds.has(id));

  return saveProgressRecord({
    userId,
    simulacroId,
    answers,
    flags,
    current: Math.max(
      0,
      Math.min(simulacro.questions.length - 1, Number(data.current) || 0)
    ),
    remainingSeconds: Math.max(
      0,
      Math.min(limitSeconds, Number(data.remainingSeconds) || 0)
    ),
    limitSeconds,
    questionIds: simulacro.questions.map((question) => question.id)
  });
}

/** Borra el progreso pausado de un simulacro. */
export function clearSimulacroProgress(userId, simulacroId) {
  return deleteProgressRecord(userId, simulacroId);
}

export function getSimulacroById(id) {
  const simulacro = getSimulacro(id);
  if (!simulacro) {
    throw new AppError('NOT_FOUND', 'Simulacro no encontrado.');
  }
  return simulacro;
}

// En el puntaje global del Saber 11 (de 0 a 500) las pruebas pesan así: Lectura
// crítica, Matemáticas, Sociales y ciudadanas y Ciencias naturales 3 cada una, e
// Inglés 1 (13 partes en total). Este simulacro corresponde a Sociales y ciudadanas.
export const MODULE_WEIGHT = { part: 3, of: 13 };

/** Puntos que un puntaje de módulo (0 a 100) aporta al puntaje global (0 a 500). */
function globalContribution(moduleScore) {
  const factor = (5 * MODULE_WEIGHT.part) / MODULE_WEIGHT.of;
  return {
    points: Math.round(moduleScore * factor),
    max: Math.round(100 * factor)
  };
}

/**
 * Corrige un simulacro sin guardarlo. Se separa del guardado para poder mostrar el
 * resultado aunque IndexedDB falle.
 */
export function evaluateSimulacro(simulacroId, userAnswers, { durationSeconds = 0 } = {}) {
  const simulacro = getSimulacroById(simulacroId);
  const answers = userAnswers || {};
  const topicStats = new Map();

  let correctCount = 0;
  let totalWeight = 0;
  let correctWeight = 0;

  const review = simulacro.questions.map((question) => {
    const rawAnswer = answers[question.id];
    const selectedIndex = rawAnswer === undefined || rawAnswer === null ? null : Number(rawAnswer);
    const isCorrect = selectedIndex === question.correctIndex;
    if (isCorrect) correctCount += 1;

    // Ponderación (HU-06): cada pregunta pesa según su dificultad.
    const weight = Number(question.weight) || 1;
    totalWeight += weight;
    if (isCorrect) correctWeight += weight;

    const current = topicStats.get(question.topicId) || {
      id: question.topicId,
      name: question.topicName,
      total: 0,
      correct: 0
    };
    current.total += 1;
    if (isCorrect) current.correct += 1;
    topicStats.set(question.topicId, current);

    return {
      id: question.id,
      text: question.text,
      options: question.options,
      selectedIndex,
      correctIndex: question.correctIndex,
      isCorrect,
      explanation: question.explanation,
      passage: question.passage || null,
      topicId: question.topicId,
      topicName: question.topicName,
      category: question.category,
      level: question.level,
      weight
    };
  });

  const totalQuestions = simulacro.questions.length;
  const rawPercentage = totalQuestions ? Math.round((correctCount / totalQuestions) * 100) : 0;
  // El puntaje del simulacro es el ponderado por dificultad (de 0 a 100).
  const percentage = totalWeight ? Math.round((correctWeight / totalWeight) * 100) : 0;
  const passed = percentage >= SIMULACRO_PASSING_PERCENTAGE;
  const global = globalContribution(percentage);

  return {
    simulacroId: simulacro.id,
    title: simulacro.title,
    shortTitle: simulacro.shortTitle,
    badge: simulacro.badge,
    correctCount,
    totalQuestions,
    percentage,
    rawPercentage,
    correctWeight,
    totalWeight,
    globalContribution: global.points,
    globalMax: global.max,
    moduleWeight: MODULE_WEIGHT,
    passed,
    review,
    byTopic: [...topicStats.values()],
    durationSeconds: Math.max(0, Number(durationSeconds) || 0),
    passingPercentage: SIMULACRO_PASSING_PERCENTAGE
  };
}

/** Guarda el resultado ya calculado como un intento más del historial. */
export async function saveSimulacroAttempt(userId, result) {
  const record = await saveAttempt({
    userId,
    questionnaireId: result.simulacroId,
    questionnaireTitle: result.title,
    category: SIMULACRO_CATEGORY,
    isSimulacro: true,
    correctCount: result.correctCount,
    totalQuestions: result.totalQuestions,
    percentage: result.percentage,
    rawPercentage: result.rawPercentage,
    globalContribution: result.globalContribution,
    passed: result.passed,
    review: result.review,
    byTopic: result.byTopic,
    durationSeconds: result.durationSeconds
  });

  return { ...result, ...record };
}
