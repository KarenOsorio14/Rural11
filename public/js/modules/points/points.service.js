'use strict';
// Sistema de puntos (HU_20): 10 puntos por cada respuesta correcta en cualquier
// cuestionario, práctica libre, "Practica tus conocimientos" o simulacro.
// Es la única fuente de puntos: el inicio, las insignias y las recompensas la reutilizan.

import { getAttemptsByUser } from '../questionnaires/questionnaires.repository.js';

export const POINTS_PER_CORRECT = 10;

/** Puntos que suman los intentos recibidos. */
export function calculatePoints(attempts) {
  return (attempts || []).reduce((total, attempt) => total + (Number(attempt.correctCount) || 0) * POINTS_PER_CORRECT, 0);
}

/** Puntos acumulados por un estudiante. */
export async function getUserPoints(userId) {
  return calculatePoints(await getAttemptsByUser(userId));
}
