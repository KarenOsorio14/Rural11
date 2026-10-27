import { AppError } from './errors.js';

const DB_NAME = 'mi-pwa';
const DB_VERSION = 5;

// Índices que la aplicación necesita para funcionar. Si una base creada por una
// versión anterior no los tiene, se completan durante la migración.
const REQUIRED_INDEXES = {
  users: ['email', 'documentNumber'],
  questionnaire_attempts: ['userId', 'questionnaireId', 'userId_questionnaireId'],
  simulacro_progress: ['userId'],
  seguidas_progress: ['userId']
};

let dbPromise = null;
let activeDb = null;

/** Crea un error estable para la interfaz y deja el detalle técnico en la consola. */
function unavailable(error) {
  console.error('[db] No se pudo abrir IndexedDB:', error);
  return new AppError(
    'DB_UNAVAILABLE',
    'No se pudo abrir el almacenamiento local del navegador.'
  );
}

/** Error específico para cuando otra pestaña impide una actualización de la base. */
function blocked() {
  return new AppError(
    'DB_BLOCKED',
    'El almacenamiento local está siendo usado por otra pestaña. Cierra las demás pestañas de Rural 11 y vuelve a intentarlo.'
  );
}

/** Crea los almacenes e índices que falten. Se ejecuta dentro de onupgradeneeded. */
function migrateSchema(request) {
  const db = request.result;
  const transaction = request.transaction;

  let usersStore;
  if (!db.objectStoreNames.contains('users')) {
    usersStore = db.createObjectStore('users', { keyPath: 'id' });
    usersStore.createIndex('email', 'email', { unique: true });
    usersStore.createIndex('documentNumber', 'documentNumber', { unique: true });
  } else {
    usersStore = transaction.objectStore('users');
    // En bases antiguas puede haber datos repetidos. Creamos los índices sin
    // "unique" para poder abrir la base; el registro comprueba duplicados antes
    // de insertar y evita crear cuentas repetidas.
    if (!usersStore.indexNames.contains('email')) {
      usersStore.createIndex('email', 'email', { unique: false });
    }
    if (!usersStore.indexNames.contains('documentNumber')) {
      usersStore.createIndex('documentNumber', 'documentNumber', { unique: false });
    }
  }

  if (!db.objectStoreNames.contains('session')) {
    db.createObjectStore('session', { keyPath: 'key' });
  }

  let attemptsStore;
  if (!db.objectStoreNames.contains('questionnaire_attempts')) {
    attemptsStore = db.createObjectStore('questionnaire_attempts', { keyPath: 'id' });
    attemptsStore.createIndex('userId', 'userId', { unique: false });
    attemptsStore.createIndex('questionnaireId', 'questionnaireId', { unique: false });
    attemptsStore.createIndex('userId_questionnaireId', ['userId', 'questionnaireId'], { unique: false });
  } else {
    attemptsStore = transaction.objectStore('questionnaire_attempts');
    if (!attemptsStore.indexNames.contains('userId')) {
      attemptsStore.createIndex('userId', 'userId', { unique: false });
    }
    if (!attemptsStore.indexNames.contains('questionnaireId')) {
      attemptsStore.createIndex('questionnaireId', 'questionnaireId', { unique: false });
    }
    if (!attemptsStore.indexNames.contains('userId_questionnaireId')) {
      attemptsStore.createIndex('userId_questionnaireId', ['userId', 'questionnaireId'], { unique: false });
    }
  }

  // Progreso de simulacros pausados: un registro por usuario y simulacro.
  if (!db.objectStoreNames.contains('simulacro_progress')) {
    const progressStore = db.createObjectStore('simulacro_progress', { keyPath: 'id' });
    progressStore.createIndex('userId', 'userId', { unique: false });
  } else {
    const progressStore = transaction.objectStore('simulacro_progress');
    if (!progressStore.indexNames.contains('userId')) {
      progressStore.createIndex('userId', 'userId', { unique: false });
    }
  }

  // Progreso de «Preguntas seguidas»: una sesión activa por usuario.
  if (!db.objectStoreNames.contains('seguidas_progress')) {
    const seguidaStore = db.createObjectStore('seguidas_progress', { keyPath: 'id' });
    seguidaStore.createIndex('userId', 'userId', { unique: false });
  } else {
    const seguidaStore = transaction.objectStore('seguidas_progress');
    if (!seguidaStore.indexNames.contains('userId')) {
      seguidaStore.createIndex('userId', 'userId', { unique: false });
    }
  }
}

/** Comprueba si una base ya tiene todo lo que necesita la app. */
function hasRequiredSchema(db) {
  const stores = new Set(db.objectStoreNames);

  for (const [storeName, indexes] of Object.entries(REQUIRED_INDEXES)) {
    if (!stores.has(storeName)) return false;

    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    if (indexes.some((index) => !store.indexNames.contains(index))) return false;
  }

  return stores.has('session');
}

/**
 * Abre (o crea) la base de datos.
 * - Si no se indica versión, solo se consulta la versión actual.
 * - Si se indica, se ejecuta la migración cuando haga falta.
 */
function requestOpen(version, { migrate = true } = {}) {
  return new Promise((resolve, reject) => {
    let request;

    try {
      request = version === undefined
        ? indexedDB.open(DB_NAME)
        : indexedDB.open(DB_NAME, version);
    } catch (error) {
      reject(unavailable(error));
      return;
    }

    let settled = false;

    request.onupgradeneeded = migrate ? () => migrateSchema(request) : null;

    request.onsuccess = () => {
      const db = request.result;

      // La petición pudo considerarse bloqueada antes de terminar. En ese caso
      // cerramos la conexión que llegó tarde para no dejarla abierta.
      if (settled) {
        db.close();
        return;
      }

      settled = true;
      activeDb = db;

      // Si otra pestaña pide actualizar la base, liberamos la conexión para no
      // bloquearla. La página volverá a abrirla en la siguiente operación.
      db.onversionchange = () => {
        try {
          db.close();
        } catch {
          // La conexión ya estaba cerrada.
        }
        if (activeDb === db) activeDb = null;
      };

      resolve(db);
    };

    request.onerror = () => {
      if (settled) return;
      settled = true;
      reject(unavailable(request.error));
    };

    request.onblocked = () => {
      if (settled) return;
      settled = true;
      reject(blocked());
    };
  });
}

/**
 * Abre la base con la versión adecuada, sin fallar si otra versión del proyecto
 * ya la había creado con un número mayor. Esto evita el error "VersionError",
 * que es una de las causas de que la app no pueda arrancar.
 */
async function openDatabase() {
  if (!('indexedDB' in window)) {
    throw new AppError(
      'DB_UNAVAILABLE',
      'Tu navegador no permite guardar datos locales. Prueba con otro navegador o sal del modo privado.'
    );
  }

  // Primero consultamos la versión actual. Si la base no existe, IndexedDB crea
  // una vacía en la versión 1; después la abrimos en la versión de la app.
  const probe = await requestOpen(undefined, { migrate: false });
  let currentVersion;
  let schemaComplete;

  try {
    currentVersion = probe.version;
    schemaComplete = hasRequiredSchema(probe);
  } finally {
    // La conexión de sondeo se cierra siempre, incluso si la comprobación falla,
    // para no bloquear la apertura definitiva ni futuras migraciones.
    probe.close();
    if (activeDb === probe) activeDb = null;
  }

  let targetVersion;

  if (schemaComplete) {
    // Si la base ya está completa, respetamos una versión superior a la nuestra.
    targetVersion = Math.max(currentVersion, DB_VERSION);
  } else if (currentVersion < DB_VERSION) {
    targetVersion = DB_VERSION;
  } else {
    // La versión es igual o mayor, pero falta estructura: subimos una versión
    // para poder ejecutar la migración sin retroceder nunca la base.
    targetVersion = currentVersion + 1;
  }

  return requestOpen(targetVersion);
}

export function openDb() {
  if (dbPromise) return dbPromise;

  dbPromise = openDatabase();

  // Si falla la apertura, el siguiente intento vuelve a probar.
  dbPromise.catch(() => {
    dbPromise = null;
  });

  return dbPromise;
}

/** Cierra la conexión actual (necesario antes de borrar la base). */
function closeDb() {
  if (activeDb) {
    try {
      activeDb.close();
    } catch {
      // Ya estaba cerrada.
    }
    activeDb = null;
  }
  dbPromise = null;
}

/** Borra por completo la base local. Se usa solo desde la pantalla de recuperación. */
export function resetLocalDatabase() {
  closeDb();

  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(unavailable(request.error));
    request.onblocked = () => reject(blocked());
  });
}

/** Ejecuta una operación en una transacción y resuelve cuando ésta se confirma. */
async function run(storeName, mode, operation) {
  let db = await openDb();

  const execute = () => new Promise((resolve, reject) => {
    let transaction;

    try {
      transaction = db.transaction(storeName, mode);
    } catch (error) {
      reject(error);
      return;
    }

    const request = operation(transaction.objectStore(storeName));

    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = () => reject(transaction.error || request.error);
    transaction.onabort = () => reject(transaction.error || request.error);
  });

  try {
    return await execute();
  } catch (error) {
    // Si otra pestaña cerró la conexión para actualizar la base, se reabre una
    // vez y se repite la operación.
    if (error && error.name === 'InvalidStateError') {
      closeDb();
      db = await openDb();
      return execute();
    }
    throw error;
  }
}

export const dbAdd = (store, value) => run(store, 'readwrite', (s) => s.add(value)); // falla si la clave ya existe
export const dbPut = (store, value) => run(store, 'readwrite', (s) => s.put(value)); // crea o reemplaza
export const dbGet = (store, key) => run(store, 'readonly', (s) => s.get(key));
export const dbGetAll = (store) => run(store, 'readonly', (s) => s.getAll());
export const dbDelete = (store, key) => run(store, 'readwrite', (s) => s.delete(key));
export const dbGetByIndex = (store, index, value) => run(store, 'readonly', (s) => s.index(index).get(value));
export const dbGetAllByIndex = (store, index, value) => run(store, 'readonly', (s) => s.index(index).getAll(value));
