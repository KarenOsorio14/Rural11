'use strict';
// Estadísticas reales del estudiante, calculadas desde su historial de intentos.

import { calculatePoints } from '../points/points.service.js';

export const SEGUIDAS_ID = 'preguntas-seguidas';

function dayKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** Racha actual: días seguidos con actividad, contando hacia atrás desde hoy (o ayer). */
export function currentStreak(attempts, now = new Date()) {
  const days = new Set(attempts.map((a) => dayKey(new Date(a.createdAt))));
  const cursor = new Date(now);
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Mejor racha histórica de días consecutivos con actividad. */
export function bestStreak(attempts) {
  const ordered = [...new Set(attempts.map((a) => {
    const d = new Date(a.createdAt);
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  }))].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let prev = null;
  for (const day of ordered) {
    run = prev !== null && day - prev === 86400000 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = day;
  }
  return best;
}

/** Reúne todas las métricas que usan las insignias y recompensas. */
export function buildStats(attempts, now = new Date()) {
  const list = (attempts || []).filter(Boolean);
  const topicPassedCount = {};
  // Los cuestionarios por tema son los únicos que tienen una sola categoría y no son especiales.
  for (const a of list) {
    if (a.passed && !a.isSimulacro && !a.isSeguida && a.questionnaireId !== 'practica-libre') {
      topicPassedCount[a.category] = (topicPassedCount[a.category] || 0) + 1;
    }
  }
  const simulacros = list.filter((a) => a.isSimulacro);

  return {
    attempts: list.length,
    passed: list.filter((a) => a.passed).length,
    perfect: list.filter((a) => a.percentage === 100).length,
    correct: list.reduce((sum, a) => sum + (Number(a.correctCount) || 0), 0),
    points: calculatePoints(list),
    streak: currentStreak(list, now),
    bestStreak: bestStreak(list),
    topicPassedCount,
    topicsPassed: Object.keys(topicPassedCount).length,
    simulacros: simulacros.length,
    simulacrosPassed: simulacros.filter((a) => a.passed).length,
    seguidasLevel: list
      .filter((a) => a.isSeguida || a.questionnaireId === SEGUIDAS_ID)
      .reduce((max, a) => Math.max(max, Number(a.levelReached) || 0), 0)
  };
}
