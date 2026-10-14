'use strict';
// Modo estricto.

import { dbAdd, dbGetAll, dbGetAllByIndex } from '../../core/db.js';
// Importa funciones genéricas de acceso a IndexedDB desde el core.

const STORE_NAME = 'questionnaire_attempts';
// Nombre del almacén (object store) de IndexedDB donde se guardan los intentos de cuestionarios.

/**
 * Guarda un intento de cuestionario en IndexedDB.
 */
export async function saveAttempt(attempt) {
  // Recibe un objeto "attempt" (intento) ya evaluado y lo persiste.
  const record = {
    // Construye el registro final a guardar, partiendo de los datos recibidos.
    ...attempt,
    // Copia todas las propiedades del intento original (spread).
    id: attempt.id || `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    // Si el intento ya trae un id, lo respeta; si no, genera uno único combinando
    // el timestamp actual con una cadena aleatoria en base36 (letras+números).
    createdAt: attempt.createdAt || new Date().toISOString()
    // Si ya trae fecha de creación la respeta; si no, usa la fecha/hora actual en formato ISO.
  };

  await dbAdd(STORE_NAME, record);
  // Inserta el registro en el almacén (dbAdd falla si ya existe una clave igual, por eso
  // el id generado arriba intenta ser único).
  return record;
  // Devuelve el registro final (con id y fecha ya resueltos) por si el llamador lo necesita.
}

/**
 * Obtiene todos los intentos de un usuario ordenados por fecha descendente.
 */
export async function getAttemptsByUser(userId) {
  // Devuelve el historial de intentos de un usuario específico, del más reciente al más antiguo.
  try {
    let attempts;
    // Variable donde se guardará la lista de intentos encontrados.
    try {
      attempts = await dbGetAllByIndex(STORE_NAME, 'userId', userId);
      // Intenta usar el índice 'userId' (más eficiente) para traer solo los intentos de ese usuario.
    } catch {
      // Si el índice no existe o falla por algún motivo (por ejemplo, una versión antigua de la BD)...
      const all = await dbGetAll(STORE_NAME);
      // Como respaldo, trae TODOS los intentos de todos los usuarios.
      attempts = (all || []).filter((item) => item.userId === userId);
      // Y filtra manualmente en JavaScript los que pertenecen a este usuario.
    }

    return (attempts || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    // Ordena la lista de más reciente a más antiguo: al restar fechas, un resultado positivo
    // significa que "b" es más reciente que "a", lo que Array.sort interpreta como "b va antes".
  } catch (error) {
    // Si algo falla en todo el proceso (por ejemplo, la base de datos ni siquiera abre)...
    console.warn('No se pudieron cargar los intentos de cuestionarios:', error);
    // Registra una advertencia en consola para depuración.
    return [];
    // Devuelve una lista vacía en vez de romper la aplicación.
  }
}

/**
 * Obtiene el mejor puntaje de un usuario en un cuestionario específico.
 */
export async function getBestAttempt(userId, questionnaireId) {
  // Busca, entre todos los intentos de un usuario, el mejor resultado para un cuestionario dado.
  const userAttempts = await getAttemptsByUser(userId);
  // Reutiliza la función anterior para traer todo el historial del usuario.
  const matches = userAttempts.filter((a) => a.questionnaireId === questionnaireId);
  // Filtra solo los intentos que corresponden a ese cuestionario en particular.
  if (!matches.length) return null;
  // Si no hay ningún intento para ese cuestionario, no hay "mejor" que devolver.

  return matches.reduce((best, curr) => (curr.percentage > best.percentage ? curr : best), matches[0]);
  // Recorre todos los intentos coincidentes y se queda con el que tenga mayor porcentaje.
  // Empieza comparando desde el primer elemento (matches[0]) como valor inicial "best".
}