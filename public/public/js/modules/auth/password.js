// Contraseñas con PBKDF2-SHA256 (Web Crypto). Nunca se guarda la contraseña, solo sal + hash.
// Web Crypto requiere HTTPS o localhost.
const ITERATIONS = 210_000;
// Número de iteraciones de PBKDF2. Más iteraciones = más lento de calcular = más resistente
// a ataques de fuerza bruta (210.000 es un valor recomendado actualmente para SHA-256).
const encoder = new TextEncoder();
// TextEncoder convierte strings (la contraseña) en bytes (Uint8Array), que es lo que
// requiere la Web Crypto API para trabajar.

const toBase64 = (bytes) => btoa(String.fromCharCode(...bytes));
// Convierte un array de bytes a texto Base64:
// 1) String.fromCharCode(...bytes) crea un string donde cada carácter representa un byte.
// 2) btoa() codifica ese string binario a Base64 (texto seguro para guardar/transmitir).
const fromBase64 = (text) => Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
// Proceso inverso: atob() decodifica Base64 a string binario, y Uint8Array.from
// convierte cada carácter de vuelta a su valor numérico de byte (0-255).

async function derive(password, salt, iterations) {
  // Función interna que calcula el hash derivado de una contraseña + sal + iteraciones.
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  // Importa la contraseña (convertida a bytes) como una "clave criptográfica" en bruto,
  // indicando que se usará con el algoritmo PBKDF2 y que solo servirá para derivar bits
  // (no se puede exportar ni usar para otra cosa: 'false' = no extraíble).
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  // Deriva 256 bits (32 bytes) a partir de la clave importada, usando SHA-256 como función
  // hash interna, la sal proporcionada y el número de iteraciones indicado.
  return new Uint8Array(bits);
  // Convierte el resultado (un ArrayBuffer) a un array de bytes más fácil de manipular.
}

export async function hashPassword(password) {
  // Genera un nuevo hash (con nueva sal aleatoria) para una contraseña en texto plano.
  const salt = crypto.getRandomValues(new Uint8Array(16));
  // Genera 16 bytes aleatorios criptográficamente seguros como "sal" (salt), única por contraseña,
  // para que dos contraseñas iguales no produzcan el mismo hash.
  const hash = await derive(password, salt, ITERATIONS);
  // Calcula el hash usando la función derive() definida arriba.
  return { salt: toBase64(salt), hash: toBase64(hash), iterations: ITERATIONS };
  // Devuelve un objeto con la sal, el hash (ambos en Base64 para poder guardarlos como texto)
  // y el número de iteraciones usado (se guarda por si en el futuro se cambia ITERATIONS,
  // así los hashes antiguos se siguen pudiendo verificar correctamente).
}

export async function verifyPassword(password, record) {
  // Verifica si una contraseña en texto plano coincide con un registro { salt, hash, iterations } guardado.
  const actual = await derive(password, fromBase64(record.salt), record.iterations);
  // Recalcula el hash de la contraseña ingresada, usando la MISMA sal e iteraciones que se
  // usaron originalmente (decodificando la sal de Base64 a bytes).
  const expected = fromBase64(record.hash);
  // Decodifica el hash guardado (Base64) de vuelta a bytes para poder compararlo.
  if (actual.length !== expected.length) return false;
  // Comprobación de seguridad: si por algún motivo las longitudes no coinciden, no son iguales.

  // Comparación en tiempo constante.
  let difference = 0;
  // Acumulador que irá detectando diferencias byte a byte.
  for (let i = 0; i < actual.length; i += 1) difference |= actual[i] ^ expected[i];
  // Por cada byte, hace XOR entre el byte actual y el esperado (da 0 si son iguales, distinto de 0 si difieren)
  // y lo combina con OR acumulado en "difference". Se recorren TODOS los bytes sin cortar antes
  // (a diferencia de un simple ===), para que el tiempo de ejecución no dependa de en qué byte
  // aparece la primera diferencia. Esto evita "timing attacks" (ataques de temporización).
  return difference === 0;
  // Si "difference" quedó en 0, todos los bytes coincidieron: la contraseña es correcta.
}