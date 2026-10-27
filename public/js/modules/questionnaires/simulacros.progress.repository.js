'use strict';
// Progreso de simulacros pausados. Se guarda un único registro por usuario y
// simulacro para poder retomarlo incluso después de cerrar el navegador.

import { dbDelete, dbGet, dbGetAll, dbGetAllByIndex, dbPut } from '../../core/db.js';

const STORE_NAME = 'simulacro_progress';

/** Clave compuesta: un progreso por usuario y simulacro. */
function progressId(userId, simulacroId) {
  return `${userId}:${simulacroId}`;
}

/** Devuelve el progreso pausado de un simulacro, o null si no existe. */
export async function getProgress(userId, simulacroId) {
  try {
    return (await dbGet(STORE_NAME, progressId(userId, simulacroId))) || null;
  } catch (error) {
    if (error && error.name === 'NotFoundError') return null;
    throw error;
  }
}

/** Devuelve todos los progresos pausados del usuario. */
export async function getAllProgress(userId) {
  try {
    return (await dbGetAllByIndex(STORE_NAME, 'userId', userId)) || [];
  } catch (error) {
    // Si el índice no existe (base antigua), se filtra el almacén completo.
    if (error && (error.name === 'NotFoundError' || error.name === 'InvalidStateError')) {
      try {
        const all = await dbGetAll(STORE_NAME);
        return (all || []).filter((progress) => progress.userId === userId);
      } catch (fallbackError) {
        if (fallbackError && fallbackError.name === 'NotFoundError') return [];
        throw fallbackError;
      }
    }
    throw error;
  }
}

/** Crea o reemplaza el progreso pausado. */
export async function saveProgress(progress) {
  const record = {
    ...progress,
    id: progressId(progress.userId, progress.simulacroId),
    updatedAt: new Date().toISOString()
  };

  await dbPut(STORE_NAME, record);
  return record;
}

/** Elimina el progreso guardado de un simulacro. */
export function deleteProgress(userId, simulacroId) {
  return dbDelete(STORE_NAME, progressId(userId, simulacroId));
}
