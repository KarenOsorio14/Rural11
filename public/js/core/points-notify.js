'use strict';
// HU_20: después de cada actividad el estudiante ve cuántos puntos ganó y su total.
// Se usa en práctica de cuestionarios, práctica libre, "Practica tus conocimientos" y simulacros.
// Nunca interrumpe el flujo: si no se puede calcular el total, solo se muestra lo ganado.

import { notify } from './notifications.js';
import { POINTS_PER_CORRECT, getUserPoints } from '../modules/points/points.service.js';

/** Puntos que da una actividad con `correctCount` respuestas correctas. */
export function pointsFor(correctCount) {
  return (Number(correctCount) || 0) * POINTS_PER_CORRECT;
}

/**
 * Avisa los puntos ganados en la actividad recién guardada y devuelve { earned, total }.
 * `total` es null si no se pudo leer el acumulado.
 */
export async function announcePoints(userId, correctCount) {
  const earned = pointsFor(correctCount);
  let total = null;
  try {
    total = await getUserPoints(userId);
  } catch (error) {
    console.warn('No se pudo leer el total de puntos:', error);
  }

  if (earned > 0) {
    notify({
      type: 'success',
      title: `+${earned} puntos`,
      message: total !== null
        ? `Ahora tienes ${total} puntos. Cada respuesta correcta vale ${POINTS_PER_CORRECT}.`
        : `Cada respuesta correcta vale ${POINTS_PER_CORRECT} puntos.`
    });
  } else {
    notify({
      type: 'info',
      title: 'Esta vez no sumaste puntos',
      message: `Solo las respuestas correctas suman: cada una vale ${POINTS_PER_CORRECT} puntos.`
    });
  }
  return { earned, total };
}
