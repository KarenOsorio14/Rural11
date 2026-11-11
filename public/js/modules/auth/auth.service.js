'use strict';
// 'use strict' activa el modo estricto de JS: evita variables globales accidentales,
// asignaciones a propiedades de solo lectura, etc. Ayuda a detectar errores antes.

import { AppError } from '../../core/errors.js';
// Importa la clase de error personalizada de la app (código + mensaje + campo).
import { users } from '../users/index.js';
// Importa el objeto público del módulo "users" (capa de acceso a usuarios).
import { hashPassword, verifyPassword } from './password.js';
// Importa las funciones para crear y verificar hashes de contraseña (PBKDF2).
import * as sessions from './session.js';
// Importa TODO el módulo de sesiones como un objeto "sessions" (sessions.start, sessions.end, sessions.current).
import { llamar, sinServidor, descargarAvance, sincronizarAvance } from '../cloud/nube.js';
import { dbGetAllByIndex, dbPut, dbDelete } from '../../core/db.js';
// HU-29: las cuentas viven en la base de datos en línea. En este navegador se guarda una copia
// (con su propio hash de la contraseña) para poder entrar sin conexión.

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_RECOMMENDED_LENGTH = 12;
// Constante exportada: longitud mínima exigida para la contraseña (se usa aquí y en la UI).
const NAME_MIN_LENGTH = 2;
// Constante exportada: longitud mínima exigida para el nombre.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Expresión regular para validar formato de correo (definida pero no se usa en este archivo actualmente).
const NUMERIC_PATTERN = /^\d+$/;
// Expresión regular: la cadena completa debe ser solo dígitos (para el número de identidad).

const MAX_FAILED_ATTEMPTS = 3;
// Máximo de intentos fallidos de login permitidos antes de bloquear.
const LOCKOUT_DURATION_MS = 60 * 1000; // 60 segundos de bloqueo tras 3 intentos fallidos
// Duración del bloqueo en milisegundos: 60 segundos * 1000 = 60000 ms.

const STORAGE_KEYS = {
  // Objeto con las claves usadas en localStorage, centralizadas para evitar strings sueltos.
  FAILED_ATTEMPTS: 'pwa:failed_attempts_count',
  // Clave donde se guarda el contador de intentos fallidos.
  LOCKOUT_UNTIL: 'pwa:lockout_until_timestamp',
  // Clave donde se guarda el timestamp (ms) hasta el cual el login está bloqueado.
  REMEMBERED_DOC: 'pwa:remembered_identity_doc'
  // Clave donde se guarda el número de documento recordado (checkbox "Recordarme").
};

/** Normaliza cadenas para comparaciones seguras */
const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
// Convierte a string (por si viene undefined/null), quita espacios y pasa a minúsculas.
const normalizeDoc = (doc) => String(doc || '').trim();
// Igual pero sin forzar minúsculas, porque el documento es numérico.

// -------------------------------------------------------------
// Control de Intentos Fallidos y Bloqueo Temporal (HU_01)
// -------------------------------------------------------------
export function getLockoutStatus() {
  // Devuelve si el login está bloqueado actualmente y cuántos segundos faltan.
  try {
    // Se envuelve en try/catch porque localStorage puede fallar (modo privado, cuotas, etc.).
    const lockoutUntil = Number(localStorage.getItem(STORAGE_KEYS.LOCKOUT_UNTIL) || 0);
    // Lee el timestamp de bloqueo guardado; si no existe, usa 0 (nunca bloqueado).
    const now = Date.now();
    // Marca de tiempo actual en milisegundos.
    if (lockoutUntil > now) {
      // Si el timestamp de bloqueo es futuro, todavía estamos bloqueados.
      const remainingSeconds = Math.ceil((lockoutUntil - now) / 1000);
      // Calcula segundos restantes, redondeando hacia arriba para no mostrar "0s" con tiempo restante.
      return { isLocked: true, remainingSeconds };
      // Devuelve el estado de bloqueo activo.
    }
    if (lockoutUntil > 0) resetFailedAttempts();
    // Si había un bloqueo pero ya expiró, limpia los contadores para empezar de cero.
  } catch {}
  // Si algo falla al leer localStorage, se ignora silenciosamente (fallback abajo).
  return { isLocked: false, remainingSeconds: 0 };
  // Por defecto: no bloqueado.
}

function recordFailedAttempt() {
  // Incrementa el contador de intentos fallidos y activa el bloqueo si se supera el máximo.
  try {
    const currentCount = Number(localStorage.getItem(STORAGE_KEYS.FAILED_ATTEMPTS) || 0) + 1;
    // Lee el contador actual (o 0) y le suma 1.
    localStorage.setItem(STORAGE_KEYS.FAILED_ATTEMPTS, String(currentCount));
    // Guarda el nuevo contador como string (localStorage solo almacena strings).

    if (currentCount >= MAX_FAILED_ATTEMPTS) {
      // Si se alcanzó o superó el máximo de intentos permitidos...
      const lockUntil = Date.now() + LOCKOUT_DURATION_MS;
      // Calcula el timestamp futuro hasta el cual estará bloqueado.
      localStorage.setItem(STORAGE_KEYS.LOCKOUT_UNTIL, String(lockUntil));
      // Guarda ese timestamp de bloqueo.
    }
  } catch {}
  // Si localStorage falla, no se rompe la app; simplemente no se registra el intento.
}

/** HU-29: aplica en esta página el bloqueo que decidió el servidor. */
function lockFor(seconds) {
  try {
    localStorage.setItem(STORAGE_KEYS.FAILED_ATTEMPTS, String(MAX_FAILED_ATTEMPTS));
    localStorage.setItem(STORAGE_KEYS.LOCKOUT_UNTIL, String(Date.now() + Math.max(1, Number(seconds) || 60) * 1000));
  } catch {}
}

function resetFailedAttempts() {
  // Limpia el contador de intentos fallidos y el bloqueo (login exitoso o expiración).
  try {
    localStorage.removeItem(STORAGE_KEYS.FAILED_ATTEMPTS);
    // Borra el contador de intentos fallidos.
    localStorage.removeItem(STORAGE_KEYS.LOCKOUT_UNTIL);
    // Borra el timestamp de bloqueo.
  } catch {}
}

// -------------------------------------------------------------
// Recordar Credenciales (HU_01 - Escenario 5)
// -------------------------------------------------------------
export function getRememberedIdentity() {
  // Devuelve el número de documento recordado (o cadena vacía si no hay ninguno).
  try {
    return localStorage.getItem(STORAGE_KEYS.REMEMBERED_DOC) || '';
    // Lee el valor guardado; si es null, devuelve string vacío.
  } catch {
    return '';
    // Si localStorage falla, se comporta como si no hubiera nada recordado.
  }
}

export function setRememberedIdentity(documentNumber, remember) {
  // Guarda o borra el documento recordado según el checkbox "Recordarme".
  try {
    if (remember && documentNumber) {
      // Si el usuario marcó "recordar" y hay un número de documento válido...
      localStorage.setItem(STORAGE_KEYS.REMEMBERED_DOC, String(documentNumber).trim());
      // Lo guarda como texto limpio (sin espacios).
    } else {
      localStorage.removeItem(STORAGE_KEYS.REMEMBERED_DOC);
      // Si no quiere recordar (o no hay documento), borra cualquier valor previo.
    }
  } catch {}
}

const NAME_PATTERN = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s]+$/;

/** Reglas de contraseña compartidas por el registro y el restablecimiento. */
function assertPasswordRules(password, field = 'password') {
  const value = String(password || '');
  if (!value.trim()) {
    throw new AppError('VALIDATION', 'Campo obligatorio.', field);
  }
  if (value.length < PASSWORD_MIN_LENGTH) {
    throw new AppError('VALIDATION', `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`, field);
  }
  if (value.length > PASSWORD_MAX_LENGTH) {
    throw new AppError('VALIDATION', `La contraseña debe tener máximo ${PASSWORD_MAX_LENGTH} caracteres.`, field);
  }
  if (!/[A-Z]/.test(value)) {
    throw new AppError('VALIDATION', 'La contraseña debe contener al menos una letra mayúscula.', field);
  }
  if (!/[a-z]/.test(value)) {
    throw new AppError('VALIDATION', 'La contraseña debe contener al menos una letra minúscula.', field);
  }
  if (!/[0-9]/.test(value)) {
    throw new AppError('VALIDATION', 'La contraseña debe contener al menos un número.', field);
  }
  if (!/[^A-Za-z0-9]/.test(value)) {
    throw new AppError('VALIDATION', 'La contraseña debe contener al menos un carácter especial.', field);
  }
}

/** Valida un nombre o apellido: obligatorio y solo letras. */
function assertPersonName(value, field) {
  const clean = String(value || '').trim();
  if (!clean) throw new AppError('VALIDATION', 'Campo obligatorio.', field);
  if (!NAME_PATTERN.test(clean)) {
    throw new AppError('VALIDATION', 'Solo se permiten letras.', field);
  }
  return clean.replace(/\s+/g, ' ');
}

export async function register({ documentNumber, email, firstName, lastName, password }) {
  // HU_00: nombres y apellidos van en campos separados; "name" se guarda unido para mostrarlo en la app.
  const cleanDoc = normalizeDoc(documentNumber);
  const cleanEmail = String(email || '').trim().toLowerCase();

  const cleanFirst = assertPersonName(firstName, 'firstName');
  const cleanLast = assertPersonName(lastName, 'lastName');

  if (!cleanDoc) {
    throw new AppError('VALIDATION', 'Campo obligatorio.', 'documentNumber');
  }
  if (!NUMERIC_PATTERN.test(cleanDoc)) {
    throw new AppError('VALIDATION', 'El número de identidad solo debe contener números.', 'documentNumber');
  }
  if (!cleanEmail) {
    throw new AppError('VALIDATION', 'Campo obligatorio.', 'email');
  }
  if (!EMAIL_PATTERN.test(cleanEmail)) {
    throw new AppError('VALIDATION', 'Correo electrónico inválido.', 'email');
  }
  assertPasswordRules(password, 'password');

  // Comprobación explícita de duplicados en este navegador (cuentas viejas que solo existían aquí).
  const existing = await users.findByDocument(cleanDoc) || await users.findByEmail(cleanEmail);
  if (existing) {
    throw new AppError('EMAIL_TAKEN', 'Ya existe una cuenta con este número de identidad o correo.', 'documentNumber');
  }

  // HU-29: la cuenta se crea en la base de datos en línea.
  const r = await llamar('/api/cuentas', {
    accion: 'registro', documento: cleanDoc, correo: cleanEmail, nombres: cleanFirst, apellidos: cleanLast, clave: password,
  });
  let id = crypto.randomUUID();
  if (r.status === 201 && r.datos && r.datos.ok) {
    id = r.datos.usuario.id;
  } else if (r.status === 409) {
    throw new AppError('EMAIL_TAKEN', 'Ya existe una cuenta con este número de identidad o correo.', 'documentNumber');
  } else if (r.status === 400 && r.datos && r.datos.motivo === 'validacion') {
    throw new AppError('VALIDATION', r.datos.mensaje, r.datos.campo);
  } else if (!r.red) {
    throw new AppError('OFFLINE', 'Necesitas conexión a internet para crear tu cuenta.');
  } else if (!sinServidor(r)) {
    throw new AppError('SERVER', 'No se pudo crear la cuenta en este momento. Inténtalo de nuevo.');
  }
  // Si el sitio todavía no tiene la base en línea conectada (503), la cuenta queda solo en este navegador.

  const record = {
    id,
    email: cleanEmail,
    documentNumber: cleanDoc,
    firstName: cleanFirst,
    lastName: cleanLast,
    name: `${cleanFirst} ${cleanLast}`,
    password: await hashPassword(password),
    createdAt: new Date().toISOString(),
  };

  try {
    await users.create(record);
  } catch (error) {
    if (error && error.name === 'ConstraintError') {
      throw new AppError('EMAIL_TAKEN', 'Ya existe una cuenta con este número de identidad o correo.', 'documentNumber');
    }
    throw error;
  }
  return users.toPublic(record);
}

/**
 * Restablece la contraseña comprobando que el documento y el correo pertenezcan a la misma cuenta.
 * (Prototipo sin servidor de correo: cuando exista la API, aquí se enviará un enlace por correo.)
 */
export async function resetPassword({ documentNumber, email, newPassword }) {
  const cleanDoc = normalizeDoc(documentNumber);
  const cleanEmail = normalizeEmail(email);

  if (!cleanDoc) throw new AppError('VALIDATION', 'Campo obligatorio.', 'documentNumber');
  if (!NUMERIC_PATTERN.test(cleanDoc)) {
    throw new AppError('VALIDATION', 'El número de identidad solo debe contener números.', 'documentNumber');
  }
  if (!cleanEmail) throw new AppError('VALIDATION', 'Campo obligatorio.', 'email');
  if (!EMAIL_PATTERN.test(cleanEmail)) {
    throw new AppError('VALIDATION', 'Correo electrónico inválido.', 'email');
  }
  assertPasswordRules(newPassword, 'newPassword');

  // HU-29: la contraseña se cambia en la cuenta en línea.
  const r = await llamar('/api/cuentas', { accion: 'restablecer', documento: cleanDoc, correo: cleanEmail, clave: newPassword });
  if (r.status === 404) throw new AppError('NO_MATCH', 'Los datos no coinciden con ninguna cuenta.');
  if (r.status === 400 && r.datos && r.datos.motivo === 'validacion') {
    throw new AppError('VALIDATION', r.datos.mensaje, r.datos.campo);
  }
  if (!r.red) throw new AppError('OFFLINE', 'Necesitas conexión a internet para cambiar tu contraseña.');
  const enLinea = r.status === 200;
  if (!enLinea && !sinServidor(r)) throw new AppError('SERVER', 'No se pudo cambiar la contraseña en este momento.');

  const user = await users.findByDocument(cleanDoc);
  if (!enLinea) {
    // Sitio sin base en línea: solo existe la copia de este navegador.
    // Mensaje genérico: no se revela si el documento existe o si fue el correo el que no coincide.
    if (!user || normalizeEmail(user.email) !== cleanEmail) {
      throw new AppError('NO_MATCH', 'Los datos no coinciden con ninguna cuenta.');
    }
  }
  if (user && normalizeEmail(user.email) === cleanEmail) {
    await users.update({ ...user, password: await hashPassword(newPassword) });
  }
  resetFailedAttempts(); // si estaba bloqueado por intentos fallidos, queda libre
  await sessions.end(); // se cierra cualquier sesión abierta con la contraseña anterior
}

/**
 * HU-29: guarda en este navegador la copia de la cuenta que respondió el servidor.
 * Si aquí existía una cuenta vieja con el mismo documento pero otro id, su avance pasa a la cuenta en línea.
 */
async function saveLocalCopy(remote, password) {
  const viejo = await users.findByDocument(remote.documentNumber) || await users.findByEmail(remote.email);
  if (viejo && viejo.id !== remote.id) {
    const intentos = await dbGetAllByIndex('questionnaire_attempts', 'userId', viejo.id).catch(() => []);
    for (const intento of intentos || []) await dbPut('questionnaire_attempts', { ...intento, userId: remote.id });
    await dbDelete('users', viejo.id);
  }
  const actual = await users.findById(remote.id);
  const record = {
    ...(actual || {}),
    id: remote.id,
    email: remote.email,
    documentNumber: remote.documentNumber,
    firstName: remote.firstName,
    lastName: remote.lastName,
    name: remote.name,
    emailVerified: Boolean(remote.emailVerified),
    password: await hashPassword(password),
    createdAt: (actual && actual.createdAt) || new Date().toISOString(),
  };
  await users.update(record);
  return record;
}

/** Abre la sesión con el token del servidor y deja el avance igual en el servidor y en este dispositivo. */
async function startOnlineSession(record, token, remember) {
  resetFailedAttempts();
  setRememberedIdentity(record.documentNumber, remember);
  await sessions.start(record.id, Boolean(remember), token);
  await descargarAvance(record.id, token);
  await sincronizarAvance(record.id);
  return users.toPublic(record);
}

/** Login sin la base en línea: igual que antes, con la copia de este navegador. */
async function localLogin(cleanDoc, password, remember) {
  const user = await users.findByDocument(cleanDoc);
  const valid = user ? await verifyPassword(password, user.password) : false;
  if (!valid) failLogin();
  resetFailedAttempts();
  setRememberedIdentity(cleanDoc, remember);
  await sessions.start(user.id, Boolean(remember));
  return users.toPublic(user);
}

/** Cuenta un intento fallido y lanza el error que corresponde (bloqueo o credenciales). */
function failLogin() {
  recordFailedAttempt();
  const newLock = getLockoutStatus();
  if (newLock.isLocked) {
    throw new AppError(
      'ACCOUNT_LOCKED',
      `Has superado el límite de intentos fallidos. Acceso bloqueado por ${newLock.remainingSeconds} segundos.`
    );
  }
  // Mismo mensaje si el número no existe o si la contraseña no coincide (HU-03).
  throw new AppError('INVALID_CREDENTIALS', 'Credenciales incorrectas.');
}

export async function login({ documentNumber, password, remember }) {
  // Intenta iniciar sesión con documento + contraseña, y si "remember" es true, recuerda el documento.
  // 1. Verificar si la cuenta está bloqueada temporalmente
  const lockStatus = getLockoutStatus();
  // Consulta si actualmente hay un bloqueo activo por intentos fallidos.
  if (lockStatus.isLocked) {
    // Si está bloqueado...
    throw new AppError(
      'ACCOUNT_LOCKED',
      `Acceso bloqueado temporalmente por intentos fallidos. Inténtalo de nuevo en ${lockStatus.remainingSeconds} segundos.`
    );
    // Corta el flujo inmediatamente sin siquiera validar las credenciales.
  }

  const cleanDoc = normalizeDoc(documentNumber);
  // Normaliza el documento recibido.

  // 2. Validación de campos obligatorios
  if (!cleanDoc) {
    // Si el documento está vacío tras limpiarlo...
    throw new AppError('VALIDATION', 'Campo obligatorio.', 'documentNumber');
  }

  // 3. Validación de formato numérico estricto
  if (!NUMERIC_PATTERN.test(cleanDoc)) {
    // Si no es puramente numérico...
    throw new AppError('VALIDATION', 'El número de identidad solo debe contener números.', 'documentNumber');
  }

  if (!password) {
    // Si no se envió contraseña...
    throw new AppError('VALIDATION', 'Campo obligatorio.', 'password');
  }

  // 4. HU-29: se valida contra la cuenta en línea.
  const r = await llamar('/api/cuentas', { accion: 'login', documento: cleanDoc, clave: password });

  if (r.status === 200 && r.datos && r.datos.ok) {
    const record = await saveLocalCopy(r.datos.usuario, password);
    return startOnlineSession(record, r.datos.token, remember);
  }

  if (r.status === 429 && r.datos) {
    lockFor(r.datos.segundos);
    throw new AppError(
      'ACCOUNT_LOCKED',
      `Has superado el límite de intentos fallidos. Acceso bloqueado por ${getLockoutStatus().remainingSeconds} segundos.`
    );
  }

  if (r.status === 400 && r.datos && r.datos.motivo === 'validacion') {
    throw new AppError('VALIDATION', r.datos.mensaje, r.datos.campo);
  }

  if (r.status === 401) {
    // La cuenta pudo haberse creado antes de HU-29 y existir solo en este navegador: si la contraseña
    // coincide con esa copia, se sube al servidor con el mismo id (y su avance la acompaña).
    const local = await users.findByDocument(cleanDoc);
    if (local && await verifyPassword(password, local.password)) {
      const [nombres, ...resto] = String(local.firstName ? local.firstName : local.name || '').split(' ');
      const subida = await llamar('/api/cuentas', {
        accion: 'registro',
        id: local.id,
        documento: cleanDoc,
        correo: local.email,
        nombres: local.firstName || nombres,
        apellidos: local.lastName || resto.join(' ') || nombres,
        clave: password,
      });
      if (subida.status === 201 && subida.datos && subida.datos.ok) {
        const record = await saveLocalCopy(subida.datos.usuario, password);
        return startOnlineSession(record, subida.datos.token, remember);
      }
    }
    failLogin();
  }

  // 5. Sin conexión o sitio sin base en línea: se entra con la copia de este navegador.
  if (sinServidor(r)) return localLogin(cleanDoc, password, remember);

  throw new AppError('SERVER', 'No se pudo iniciar sesión en este momento. Inténtalo de nuevo.');
}

export async function logout() {
  // Cierra la sesión actual.
  await sessions.end();
  // Delegado al módulo de sesiones: borra el registro de sesión activa.
}

/** { status: 'active', user, session } | { status: 'expired' } | { status: 'none' } */
export async function getSession() {
  // Obtiene el estado actual de sesión, combinando datos de sesión + usuario.
  const result = await sessions.current();
  // Consulta el módulo de sesiones: puede devolver 'active', 'expired' o 'none'.
  if (result.status !== 'active') return result;
  // Si no está activa, se devuelve tal cual (no hay usuario que resolver).

  const user = await users.findById(result.record.userId);
  // Si está activa, busca el usuario asociado a esa sesión por su ID.
  if (!user) {
    // Caso raro: la sesión apunta a un usuario que ya no existe (fue borrado, por ejemplo).
    await sessions.end();
    // Se limpia la sesión huérfana.
    return { status: 'none' };
    // Se informa que no hay sesión válida.
  }

  return {
    // Devuelve el paquete completo: estado, usuario público y metadatos de sesión.
    status: 'active',
    user: users.toPublic(user),
    // Usuario sin datos sensibles.
    session: { persistent: result.record.remember, expiresAt: result.record.expiresAt },
    // Si la sesión es "recordada" (persistente) y cuándo expira.
  };
}

/** HU-29: actualiza la copia local con los datos de la cuenta en línea (por ejemplo, si ya verificó el correo). */
export async function refreshAccount() {
  const token = await sessions.token();
  if (!token) return null;
  const r = await llamar('/api/cuentas', { accion: 'yo', token });
  if (!(r.status === 200 && r.datos && r.datos.ok)) return null;
  const remote = r.datos.usuario;
  const local = await users.findById(remote.id);
  if (!local) return null;
  const record = { ...local, email: remote.email, name: remote.name, firstName: remote.firstName, lastName: remote.lastName, emailVerified: remote.emailVerified };
  await users.update(record);
  return users.toPublic(record);
}
