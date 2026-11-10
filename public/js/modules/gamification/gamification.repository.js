'use strict';
// Persistencia de insignias y recompensas obtenidas (almacén "achievements" de IndexedDB).
// El id del registro es único por estudiante + tipo + logro (+ repetición), así la base de
// datos rechaza cualquier duplicado aunque el código se ejecute dos veces a la vez.

import { dbAdd, dbGetAllByIndex, dbGetAll } from '../../core/db.js';

const STORE_NAME = 'achievements';

export const achievementId = (userId, kind, itemId, occurrence = 1) =>
  `${userId}:${kind}:${itemId}:${occurrence}`;

/** Guarda un logro. Devuelve false si ya existía (duplicado), true si se creó. */
export async function addAchievement(record) {
  try {
    await dbAdd(STORE_NAME, record);
    return true;
  } catch (error) {
    const name = (error && error.name) || (error && error.target && error.target.error && error.target.error.name);
    if (name === 'ConstraintError') return false;
    throw error;
  }
}

/** Logros obtenidos por un estudiante (insignias y recompensas). */
export async function getAchievementsByUser(userId) {
  try {
    return (await dbGetAllByIndex(STORE_NAME, 'userId', userId)) || [];
  } catch {
    return ((await dbGetAll(STORE_NAME)) || []).filter((item) => item.userId === userId);
  }
}
