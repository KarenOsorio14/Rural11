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

export const PASSWORD_MIN_LENGTH = 8;
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

export async function register({ documentNumber, email, name, password }) {
  // Registra un nuevo usuario. Recibe un objeto desestructurado con documentNumber, name y password.
  const cleanDoc = normalizeDoc(documentNumber);
  // Normaliza el número de documento (quita espacios).
  const cleanName = String(name || '').trim();
  // Normaliza el nombre (fuerza a string y quita espacios).
  const cleanEmail = String(email || '').trim().toLowerCase();
  // Normaliza el email (fuerza a string y quita espacios).
  const cleanPassword =String(password || '').trim();
  // Normaliza la contraseña (fuerza a string y quita espacios).
  // -------------------------------------------------------------
  //Validaciones de campos obligatorios
  // -------------------------------------------------------------
  
  if (!cleanDoc) {
    // Si tras limpiar el documento queda vacío...
    throw new AppError('VALIDATION', 'Campo obligatorio.', 'documentNumber');
    // Lanza un error de validación indicando el campo afectado.
  }
  if (!cleanName) {
    throw new AppError('VALIDATION', 'Campo obligatorio.', 'name');
    // Lanza un error de validación indicando el campo afectado.
  }
  if (!cleanEmail) {
    throw new AppError('VALIDATION', 'Campo obligatorio.', 'email');
    // Lanza un error de validación indicando el campo afectado.
  }
  if (!cleanPassword) {
    throw new AppError('VALIDATION', 'Campo obligatorio.', 'password');
    // Lanza un error de validación indicando el campo afectado.
  }
  // -------------------------------------------------------------
  // Validación del número de identificación
  // -------------------------------------------------------------

  if (!NUMERIC_PATTERN.test(cleanDoc)) {
    // Si el documento contiene algo que no sea dígitos...
    throw new AppError('VALIDATION', 'El número de identidad solo debe contener números.', 'documentNumber');
  }

  // -------------------------------------------------------------
  // Validación del nombre
  // -------------------------------------------------------------
  const NAME_PATTERN = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s]+$/;

  if(!NAME_PATTERN.test(cleanName)){
    throw new AppError('VALIDATION', 'El nombre solo debe contener letras.', 'name');
  }

  // -------------------------------------------------------------
  // Validación del correo electrónico
  // -------------------------------------------------------------
  if (!EMAIL_PATTERN.test(cleanEmail)) {
    throw new AppError('VALIDATION', 'Correo electrónico inválido.', 'email');
  }

  // -------------------------------------------------------------
  // Validación de la contraseña
  // -------------------------------------------------------------
  if (String(password || '').length < PASSWORD_MIN_LENGTH) {
    // Si la contraseña no alcanza el mínimo de caracteres exigido...
    throw new AppError('VALIDATION', `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`, 'password');
  }

  // -------------------------------------------------------------
  // Validación de complejidad de la contraseña
  // -------------------------------------------------------------
  if (!/[A-Z]/.test(cleanPassword)) {
    throw new AppError('VALIDATION', 'La contraseña debe contener al menos una letra mayúscula.', 'password');
  }
  if (!/[a-z]/.test(cleanPassword)) {
    throw new AppError('VALIDATION', 'La contraseña debe contener al menos una letra minúscula.', 'password');
  }
  if (!/[0-9]/.test(cleanPassword)) {
    throw new AppError('VALIDATION', 'La contraseña debe contener al menos un número.', 'password');
  }
  if (!/[^A-Za-z0-9]/.test(cleanPassword)) {
    throw new AppError('VALIDATION', 'La contraseña debe contener al menos un carácter especial.', 'password');
  }

  const record = {
    // Construye el objeto que se guardará en IndexedDB.
    id: crypto.randomUUID(),
    // Genera un identificador único universal (UUID) usando la Web Crypto API.
    email: cleanEmail,
    // Email ya normalizado.
    documentNumber: cleanDoc,
    // Documento ya normalizado.
    name: cleanName,
    // Nombre ya normalizado.
    password: await hashPassword(password),
    // Espera (await) a que se calcule el hash seguro de la contraseña (nunca se guarda en texto plano).
    createdAt: new Date().toISOString(),
    // Fecha de creación en formato ISO (texto estándar y ordenable).
  };

  try {
    await users.create(record);
    // Intenta insertar el registro en la base de datos de usuarios.
  } catch (error) {
    // Si falla la inserción...
    if (error && error.name === 'ConstraintError') {
      // IndexedDB lanza 'ConstraintError' cuando se viola una restricción de unicidad (índice único).
      throw new AppError('EMAIL_TAKEN', 'Ya existe una cuenta con este número de identidad o correo.', 'documentNumber');
      // Se traduce a un error de dominio más entendible para la UI.
    }
    throw error;
    // Cualquier otro error se vuelve a lanzar tal cual (no se sabe cómo manejarlo aquí).
  }
  return users.toPublic(record);
  // Devuelve una versión "pública" del registro (sin datos sensibles como la contraseña).
}

// -------------------------------------------------------------
// Inicio de Sesión con Número de Identidad (HU_01)
// -------------------------------------------------------------
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

  // 4. Búsqueda de usuario por número de identidad
  const user = await users.findByDocument(cleanDoc);
  // Busca en IndexedDB un usuario que tenga ese documento (o undefined/null si no existe).

  // 5. Verificación de contraseña
  const valid = user ? await verifyPassword(password, user.password) : false;
  // Si el usuario existe, verifica la contraseña contra el hash guardado; si no existe, "valid" es false directamente
  // (esto evita revelar si el documento existe o no, mismo mensaje de error en ambos casos).

  // 6. Si las credenciales son incorrectas (número no registrado O contraseña inválida)
  if (!valid) {
    // Si la validación falló por cualquier motivo...
    recordFailedAttempt();
    // Registra un intento fallido más (puede activar el bloqueo).
    const newLock = getLockoutStatus();
    // Vuelve a consultar el estado de bloqueo (por si este intento activó el bloqueo).
    if (newLock.isLocked) {
      // Si justo con este intento se activó el bloqueo...
      throw new AppError(
        'ACCOUNT_LOCKED',
        `Has superado el límite de intentos fallidos. Acceso bloqueado por ${newLock.remainingSeconds} segundos.`
      );
    }
    throw new AppError('INVALID_CREDENTIALS', 'Credenciales incorrectas.');
    // Si no se bloqueó todavía, informa credenciales incorrectas genéricas.
  }

  // 7. Ingreso exitoso: restablecer intentos, guardar preferencia de recordar y crear sesión
  resetFailedAttempts();
  // Limpia el contador de fallos porque el login fue exitoso.
  setRememberedIdentity(cleanDoc, remember);
  // Guarda o borra el documento recordado según la preferencia del usuario.
  await sessions.start(user.id, Boolean(remember));
  // Crea la sesión en IndexedDB, indicando si debe durar más tiempo (remember=true) o menos.

  return users.toPublic(user);
  // Devuelve los datos públicos del usuario autenticado.
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