import { AppError } from './errors.js';

const DB_NAME = 'mi-pwa';
const DB_VERSION = 3;

let dbPromise = null;

/**
 * Abre la base de datos (una sola vez). Aquí se declaran los "almacenes" (equivalentes a tablas).
 * Si cambias la estructura, sube DB_VERSION y añade la migración dentro de onupgradeneeded.
 */
export function openDb() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new AppError('DB_UNAVAILABLE', 'Tu navegador no permite guardar datos locales. Prueba con otro navegador o sal del modo privado.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const transaction = request.transaction;

      if (!db.objectStoreNames.contains('users')) {
        const users = db.createObjectStore('users', { keyPath: 'id' });
        users.createIndex('email', 'email', { unique: true });
        users.createIndex('documentNumber', 'documentNumber', { unique: true });
      } else {
        const usersStore = transaction.objectStore('users');
        if (!usersStore.indexNames.contains('documentNumber')) {
          usersStore.createIndex('documentNumber', 'documentNumber', { unique: false });
        }
      }

      if (!db.objectStoreNames.contains('session')) {
        db.createObjectStore('session', { keyPath: 'key' });
      }

      if (!db.objectStoreNames.contains('questionnaire_attempts')) {
        const attempts = db.createObjectStore('questionnaire_attempts', { keyPath: 'id' });
        attempts.createIndex('userId', 'userId', { unique: false });
        attempts.createIndex('questionnaireId', 'questionnaireId', { unique: false });
        attempts.createIndex('userId_questionnaireId', ['userId', 'questionnaireId'], { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new AppError('DB_UNAVAILABLE', 'No se pudo abrir el almacenamiento local del navegador.'));
    request.onblocked = () => reject(new AppError('DB_BLOCKED', 'Cierra las otras pestañas de la app e inténtalo de nuevo.'));
  });

  // Si falla la apertura, el siguiente intento vuelve a probar.
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

/** Ejecuta una operación en una transacción y resuelve cuando ésta se confirma. */
async function run(storeName, mode, operation) {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const request = operation(transaction.objectStore(storeName));

    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = () => reject(transaction.error || request.error);
    transaction.onabort = () => reject(transaction.error || request.error);
  });
}

export const dbAdd = (store, value) => run(store, 'readwrite', (s) => s.add(value)); // falla si la clave ya existe
export const dbPut = (store, value) => run(store, 'readwrite', (s) => s.put(value)); // crea o reemplaza
export const dbGet = (store, key) => run(store, 'readonly', (s) => s.get(key));
export const dbGetAll = (store) => run(store, 'readonly', (s) => s.getAll());
export const dbDelete = (store, key) => run(store, 'readwrite', (s) => s.delete(key));
export const dbGetByIndex = (store, index, value) => run(store, 'readonly', (s) => s.index(index).get(value));
export const dbGetAllByIndex = (store, index, value) => run(store, 'readonly', (s) => s.index(index).getAll(value));
