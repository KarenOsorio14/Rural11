import { dbGet, dbAdd, dbGetByIndex, dbGetAll } from '../../core/db.js';
// Importa las funciones genéricas de acceso a IndexedDB desde el core.
// (Nota: el orden de importación en el archivo original es dbAdd, dbGet, dbGetByIndex, dbGetAll;
// aquí se mantiene el mismo conjunto, solo se documenta que son 4 utilidades genéricas de BD.)

// Único lugar que sabe cómo se guardan los usuarios en IndexedDB.
export const usersRepository = {
  // Objeto que agrupa todas las operaciones de bajo nivel sobre el almacén "users".
  add: (user) => dbAdd('users', user),
  // Inserta un nuevo usuario en el almacén 'users' (falla si ya existe la misma clave/id
  // o si se viola un índice único, como email o documentNumber duplicado).
  findById: (id) => dbGet('users', id),
  // Busca un usuario directamente por su clave primaria (id).
  findByEmail: (email) => dbGetByIndex('users', 'email', email),
  // Busca un usuario usando el índice 'email' (más eficiente que recorrer todos los registros).
  findByDocument: async (documentNumber) => {
    // Busca un usuario por su número de documento. Es async porque intenta dos estrategias.
    try {
      return await dbGetByIndex('users', 'documentNumber', String(documentNumber));
      // Intenta usar el índice 'documentNumber' (rápido), convirtiendo el valor a string
      // por si llega como número.
    } catch {
      // Si el índice no existe (por ejemplo, una base de datos creada con una versión
      // anterior del esquema, antes de que existiera este índice)...
      const all = await dbGetAll('users');
      // Como respaldo, trae TODOS los usuarios.
      return (all || []).find((u) => String(u.documentNumber) === String(documentNumber));
      // Y busca manualmente, comparando como strings para evitar problemas de tipo (number vs string).
    }
  },
  findByDocumentOrEmail: async (identifier) => {
    // Busca un usuario que coincida ya sea por documento o por email, usando un único "identifier".
    const clean = String(identifier || '').trim().toLowerCase();
    // Normaliza el identificador recibido: fuerza a string, quita espacios y pasa a minúsculas.
    let user = await usersRepository.findByDocument(clean);
    // Primero intenta encontrarlo como número de documento.
    if (!user) {
      // Si no se encontró por documento...
      user = await usersRepository.findByEmail(clean);
      // Intenta encontrarlo como email.
    }
    return user;
    // Devuelve el usuario encontrado (por cualquiera de los dos métodos) o undefined/null si no existe.
  }
};
