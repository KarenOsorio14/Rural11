import { usersRepository } from './users.repository.js';
// Importa el repositorio de usuarios (capa que sabe cómo leer/escribir en IndexedDB).

// API pública del módulo: otros módulos solo deben importar desde aquí.
export const users = {
  // Este objeto es la ÚNICA puerta de entrada al módulo "users" para el resto de la app
  // (patrón de "fachada" o "barrel"): en vez de importar directamente el repositorio,
  // otros archivos importan { users } desde aquí.
  create: usersRepository.add,
  // Alias: users.create(...) en realidad ejecuta usersRepository.add(...).
  findById: usersRepository.findById,
  // Alias directo a la búsqueda por id.
  findByEmail: usersRepository.findByEmail,
  // Alias directo a la búsqueda por email.
  findByDocument: usersRepository.findByDocument,
  // Alias directo a la búsqueda por número de documento.
  findByDocumentOrEmail: usersRepository.findByDocumentOrEmail,
  // Alias directo a la búsqueda combinada (documento o email).

  // Datos que pueden llegar a la interfaz (nunca la contraseña).
  toPublic: ({ id, name, email, documentNumber }) => ({ id, name, email, documentNumber: documentNumber || '' }),
  // Función que recibe un registro de usuario completo (que incluye el hash de la contraseña)
  // y devuelve SOLO los campos seguros para exponer en la UI: id, name, email y documentNumber
  // (con documentNumber por defecto en cadena vacía si no existiera). La contraseña nunca sale de aquí.
};