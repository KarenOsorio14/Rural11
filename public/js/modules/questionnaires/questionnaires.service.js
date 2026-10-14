'use strict';
// Modo estricto.

import { QUESTIONNAIRES, TOPICS } from './questionnaires.data.js';
// Importa los datos "fijos" (catálogo de temas y cuestionarios con sus preguntas).
import { saveAttempt, getAttemptsByUser } from './questionnaires.repository.js';
// Importa las funciones de acceso a datos (persistencia de intentos).
import { AppError } from '../../core/errors.js';
// Importa la clase de error de la aplicación.

export { TOPICS };
// Re-exporta TOPICS para que quien importe este servicio también pueda acceder a los temas
// sin tener que importar directamente del archivo de datos.

const PASSING_PERCENTAGE = 60;
// Porcentaje mínimo de aciertos para considerar "aprobado" un cuestionario.

/**
 * Obtiene la lista de los 4 temas principales con sus métricas para el usuario.
 */
export async function getTopicsWithStats(userId) {
  // Devuelve cada tema enriquecido con estadísticas del usuario (cuántos aprobó, etc.).
  const attempts = await getAttemptsByUser(userId);
  // Trae todo el historial de intentos del usuario una sola vez (para no repetir consultas).

  return TOPICS.map((topic) => {
    // Recorre cada tema del catálogo y construye una versión "enriquecida".
    const topicQuestionnaires = QUESTIONNAIRES.filter((q) => q.category === topic.category);
    // Filtra, de todos los cuestionarios, los que pertenecen a la categoría de este tema.
    const topicQIds = topicQuestionnaires.map((q) => q.id);
    // Extrae solo los IDs de esos cuestionarios (para comparar más rápido después).
    const topicAttempts = attempts.filter((a) => topicQIds.includes(a.questionnaireId));
    // De todos los intentos del usuario, se queda solo con los que pertenecen a este tema.

    const totalQuestions = topicQuestionnaires.reduce((sum, q) => sum + q.questions.length, 0);
    // Suma la cantidad total de preguntas de todos los cuestionarios de este tema.
    const passedAttempts = topicAttempts.filter((a) => a.passed).length;
    // Cuenta cuántos de esos intentos fueron aprobados (a.passed === true).

    return {
      ...topic,
      // Copia todas las propiedades originales del tema (id, name, category, icon, etc.).
      questionnairesCount: topicQuestionnaires.length,
      // Cuántos cuestionarios tiene este tema.
      totalQuestions,
      // Total de preguntas del tema.
      attemptsCount: topicAttempts.length,
      // Cuántas veces el usuario intentó cuestionarios de este tema.
      passedCount: passedAttempts
      // Cuántos de esos intentos aprobó.
    };
  });
}

/**
 * Obtiene la lista de cuestionarios (opcionalmente filtrada por categoría/tema) enriquecida con estadísticas.
 */
export async function getQuestionnairesList(userId, category = null) {
  // Devuelve la lista de cuestionarios (todos, o solo los de una categoría) con datos del usuario.
  const attempts = await getAttemptsByUser(userId);
  // Trae el historial de intentos del usuario.
  const source = category && category !== 'Todos'
    ? QUESTIONNAIRES.filter((q) => q.category.toLowerCase() === category.toLowerCase())
    : QUESTIONNAIRES;
  // Si se pidió una categoría específica (y no es "Todos"), filtra por esa categoría
  // (comparando en minúsculas para evitar problemas de mayúsculas/minúsculas).
  // Si no, usa el catálogo completo de cuestionarios.

  return source.map((q) => {
    // Recorre cada cuestionario y le agrega información calculada.
    const qAttempts = attempts.filter((a) => a.questionnaireId === q.id);
    // Filtra los intentos del usuario que correspondan a este cuestionario específico.
    const bestAttempt = qAttempts.length
      ? qAttempts.reduce((best, curr) => (curr.percentage > best.percentage ? curr : best), qAttempts[0])
      : null;
    // Si hay al menos un intento, busca el de mayor porcentaje (mejor resultado);
    // si no hay ninguno, "bestAttempt" queda en null.

    return {
      ...q,
      // Copia todas las propiedades originales del cuestionario (título, preguntas, etc.).
      questionsCount: q.questions.length,
      // Cantidad de preguntas que tiene.
      attemptsCount: qAttempts.length,
      // Cuántas veces el usuario lo ha intentado.
      bestScore: bestAttempt ? bestAttempt.percentage : null,
      // El mejor porcentaje logrado, o null si nunca lo intentó.
      passed: bestAttempt ? bestAttempt.passed : false
      // Si su mejor intento fue aprobado, o false si nunca lo intentó.
    };
  });
}

/**
 * Obtiene un cuestionario por ID.
 */
export function getQuestionnaireById(id) {
  // Busca un cuestionario específico por su identificador (función síncrona, no usa await).
  const q = QUESTIONNAIRES.find((item) => item.id === id);
  // Busca en el arreglo de datos el primer elemento cuyo id coincida.
  if (!q) {
    // Si no se encontró ningún cuestionario con ese id...
    throw new AppError('NOT_FOUND', 'Cuestionario no encontrado.');
    // Lanza un error de dominio indicando que no existe.
  }
  return q;
  // Si existe, lo devuelve.
}

/**
 * Evalúa las respuestas del usuario y guarda el intento en IndexedDB.
 * @param {string} userId - ID del usuario activo
 * @param {string} questionnaireId - ID del cuestionario
 * @param {Object} userAnswers - Mapa de { [questionId]: selectedOptionIndex }
 */
export async function evaluateAndSaveAttempt(userId, questionnaireId, userAnswers) {
  // Corrige las respuestas del usuario, calcula el resultado y lo guarda como un nuevo intento.
  const questionnaire = getQuestionnaireById(questionnaireId);
  // Obtiene el cuestionario completo (con todas sus preguntas y respuestas correctas).
  const questions = questionnaire.questions;
  // Atajo para la lista de preguntas.

  let correctCount = 0;
  // Contador de respuestas correctas, empieza en 0.
  const review = questions.map((q) => {
    // Recorre cada pregunta para construir el detalle de revisión (qué respondió, si acertó, etc.).
    const selectedIndex = userAnswers[q.id] !== undefined ? Number(userAnswers[q.id]) : null;
    // Busca en el mapa de respuestas del usuario la opción elegida para esta pregunta;
    // si no respondió, queda en null. Se convierte a Number por si llegó como string.
    const isCorrect = selectedIndex === q.correctIndex;
    // Compara el índice elegido contra el índice correcto definido en los datos.
    if (isCorrect) correctCount++;
    // Si acertó, incrementa el contador general de aciertos.

    return {
      // Devuelve un objeto de "revisión" por cada pregunta, útil para mostrar el detalle al final.
      id: q.id,
      text: q.text,
      options: q.options,
      selectedIndex,
      correctIndex: q.correctIndex,
      isCorrect,
      explanation: q.explanation
      // Se incluye la explicación de la respuesta correcta, para el feedback educativo.
    };
  });

  const totalQuestions = questions.length;
  // Cantidad total de preguntas del cuestionario.
  const percentage = Math.round((correctCount / totalQuestions) * 100);
  // Calcula el porcentaje de aciertos, redondeado al entero más cercano.
  const passed = percentage >= PASSING_PERCENTAGE;
  // Determina si se aprobó comparando contra el umbral mínimo (60%).

  const attemptData = {
    // Arma el objeto completo que se va a guardar como "intento" en la base de datos.
    userId,
    questionnaireId,
    questionnaireTitle: questionnaire.title,
    // Se guarda también el título (aunque sea redundante con questionnaireId) para no tener
    // que volver a buscar el cuestionario cada vez que se muestra el historial.
    category: questionnaire.category,
    correctCount,
    totalQuestions,
    percentage,
    passed,
    review
    // Se incluye el detalle completo de revisión, útil si se quiere volver a consultar después.
  };

  const savedRecord = await saveAttempt(attemptData);
  // Persiste el intento en IndexedDB usando el repositorio (le asigna id y createdAt si faltan).

  return {
    ...savedRecord,
    // Copia todo el registro guardado (incluye el id generado y la fecha).
    passingPercentage: PASSING_PERCENTAGE
    // Agrega también el umbral de aprobación, útil para mostrarlo en la pantalla de resultados.
  };
}

/**
 * Obtiene el historial completo de intentos del usuario.
 */
export async function getUserAttempts(userId) {
  // Función de conveniencia que simplemente delega al repositorio.
  return getAttemptsByUser(userId);
}