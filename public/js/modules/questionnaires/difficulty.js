'use strict';
// Nivel de dificultad de las preguntas tipo ICFES. Lo comparten la práctica
// continua (para subir de nivel) y los simulacros (para ponderar el puntaje).

/** Peso de cada nivel en el puntaje de un simulacro: las preguntas difíciles valen más. */
export const LEVEL_WEIGHT = { 1: 1, 2: 2, 3: 3 };

/**
 * Nivel de una pregunta: 1 básico, 2 intermedio, 3 avanzado.
 * Las preguntas directas (sin lectura) son las más sencillas; las de lectura son
 * intermedias y las de inferencia (la última de cada texto o las de un
 * cuestionario avanzado) son avanzadas.
 */
export function questionLevel(quiz, questionIndex) {
  const difficulty = String(quiz.difficulty || '').toLowerCase();
  const isReading = quiz.id.includes('-lectura-');

  if (!isReading) {
    return difficulty.includes('avanzado') ? 2 : 1;
  }
  if (difficulty.includes('avanzado')) return 3;
  if (questionIndex === quiz.questions.length - 1) return 3;
  return 2;
}
