import { dbGet, dbPut, dbDelete } from '../../core/db.js';
// Importa las funciones genéricas de acceso a IndexedDB (get/put/delete) desde el core.

const KEY = 'current';
// Clave fija usada en el almacén "session": solo existe UNA sesión activa a la vez,
// siempre guardada bajo esta misma clave (no hay múltiples sesiones simultáneas).
const HOUR = 60 * 60 * 1000;
// Un helper numérico: cuántos milisegundos tiene una hora (60 min * 60 seg * 1000 ms).

const DURATION = {
  // Objeto con las dos posibles duraciones de sesión, en milisegundos.
  temporary: 12 * HOUR, // Sesión estándar (12 horas)
  // Si el usuario NO marcó "recordarme": la sesión dura 12 horas.
  remembered: 30 * 24 * HOUR, // Con "mantener sesión" (30 días)
  // Si el usuario SÍ marcó "recordarme": la sesión dura 30 días (30 * 24 horas).
};

export async function start(userId, remember) {
  // Crea (o reemplaza) la sesión activa para un usuario dado.
  const duration = remember ? DURATION.remembered : DURATION.temporary;
  // Elige la duración según si se pidió "recordar" o no.
  const expiresAt = Date.now() + duration;
  // Calcula el timestamp exacto (ms) en el que la sesión expirará.
  await dbPut('session', { key: KEY, userId, remember: Boolean(remember), expiresAt });
  // Guarda (o sobrescribe, porque es "put") el registro de sesión en el almacén "session",
  // usando siempre la misma clave KEY ('current'). Incluye el id de usuario, si es
  // persistente (remember) y cuándo expira.
}

export async function end() {
  // Cierra la sesión activa (logout).
  await dbDelete('session', KEY);
  // Elimina el registro con clave 'current' del almacén "session".
}

/** Devuelve { status: 'active', record } | { status: 'expired' } | { status: 'none' }. */
export async function current() {
  // Consulta el estado actual de la sesión.
  const record = await dbGet('session', KEY);
  // Intenta leer el registro de sesión guardado.
  if (!record) return { status: 'none' };
  // Si no existe ningún registro, no hay sesión iniciada.

  const expired = record.expiresAt <= Date.now();
  // Compara la fecha de expiración guardada contra el momento actual.

  if (expired) {
    // Si la sesión ya venció...
    await end();
    // Se elimina automáticamente el registro vencido (limpieza).
    return { status: 'expired' };
    // Se informa que la sesión expiró (distinto de "none", para poder mostrar un mensaje
    // específico al usuario, como "tu sesión expiró").
  }
  // HU-04: renovación por actividad. Cada vez que se consulta una sesión vigente se corre su
  // vencimiento hacia adelante (sin escribir en la base más de una vez por minuto).
  const renewed = Date.now() + (record.remember ? DURATION.remembered : DURATION.temporary);
  if (renewed - record.expiresAt > 60 * 1000) {
    record.expiresAt = renewed;
    await dbPut('session', record);
  }

  return { status: 'active', record };
  // Si sigue vigente, se devuelve el registro completo junto con el estado "active".
}