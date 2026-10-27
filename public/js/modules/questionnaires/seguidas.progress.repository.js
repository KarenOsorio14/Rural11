'use strict';
// Progreso de «Preguntas seguidas». Solo hay una sesión activa por usuario:
// se guarda después de cada respuesta para poder continuar otro día.

import { dbDelete, dbGet, dbPut } from '../../core/db.js';

const STORE_NAME = 'seguidas_progress';

/** Devuelve la sesión guardada del usuario, o null si no existe. */
export async function getProgress(userId) {
  try {
    return (await dbGet(STORE_NAME, userId)) || null;
  } catch (error) {
    if (error && error.name === 'NotFoundError') return null;
    throw error;
  }
}

/** Crea o reemplaza la sesión guardada del usuario. */
export async function saveProgress(progress) {
  const record = {
    ...progress,
    id: progress.userId,
    updatedAt: new Date().toISOString()
  };

  await dbPut(STORE_NAME, record);
  return record;
}

/** Elimina la sesión guardada del usuario. */
export function deleteProgress(userId) {
  return dbDelete(STORE_NAME, userId);
}
