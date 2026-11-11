// Utilidades compartidas por las funciones del Worker (respuestas JSON, origen, firmas y contraseñas).

const codificador = new TextEncoder();

export const responder = (status, cuerpo) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

// Solo se aceptan llamadas que vienen de la propia página (mismo sitio).
export function mismoSitio(request) {
  const origen = request.headers.get('Origin');
  if (!origen) return true;
  try {
    return new URL(origen).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export async function leerJson(request, maxBytes = 1_000_000) {
  const largo = Number(request.headers.get('Content-Length') || 0);
  if (largo > maxBytes) return null;
  const texto = await request.text();
  if (texto.length > maxBytes) return null;
  try {
    return JSON.parse(texto);
  } catch {
    return null;
  }
}

export function aBase64Url(bytes) {
  let texto = '';
  for (const byte of bytes) texto += String.fromCharCode(byte);
  return btoa(texto).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function deBase64Url(texto) {
  const normal = String(texto).replace(/-/g, '+').replace(/_/g, '/');
  const binario = atob(normal + '='.repeat((4 - (normal.length % 4)) % 4));
  return Uint8Array.from(binario, (c) => c.charCodeAt(0));
}

const aBase64 = (bytes) => btoa(String.fromCharCode(...bytes));
const deBase64 = (texto) => Uint8Array.from(atob(texto), (c) => c.charCodeAt(0));

async function llaveHmac(secreto, usos) {
  return crypto.subtle.importKey('raw', codificador.encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, usos);
}

/** Firma una carga JSON con HMAC-SHA256: devuelve "cuerpo.firma". */
export async function firmar(carga, secreto) {
  const cuerpo = aBase64Url(codificador.encode(JSON.stringify(carga)));
  const firma = await crypto.subtle.sign('HMAC', await llaveHmac(secreto, ['sign']), codificador.encode(cuerpo));
  return `${cuerpo}.${aBase64Url(new Uint8Array(firma))}`;
}

/** Comprueba la firma y devuelve la carga, o null si no es válida. No revisa la fecha. */
export async function leerFirmado(token, secreto) {
  const partes = String(token || '').split('.');
  if (partes.length !== 2) return null;
  const [cuerpo, firma] = partes;
  try {
    const valida = await crypto.subtle.verify('HMAC', await llaveHmac(secreto, ['verify']), deBase64Url(firma), codificador.encode(cuerpo));
    if (!valida) return null;
    return JSON.parse(new TextDecoder().decode(deBase64Url(cuerpo)));
  } catch {
    return null;
  }
}

// ---------- Sesiones en línea ----------
// El token de sesión se firma con VERIFY_SECRET más un sufijo, para no mezclarlo con los enlaces del correo.
const DURACION_SESION_MS = 30 * 24 * 60 * 60 * 1000;
const secretoSesion = (env) => `${env.VERIFY_SECRET}:sesion`;

export const servidorListo = (env) => Boolean(env.DB && env.VERIFY_SECRET && env.VERIFY_SECRET.length >= 16);

export async function crearSesion(env, usuarioId) {
  return firmar({ u: usuarioId, exp: Date.now() + DURACION_SESION_MS }, secretoSesion(env));
}

/** Devuelve el id del usuario dueño del token, o null si el token no sirve o venció. */
export async function usuarioDeSesion(env, token) {
  const carga = await leerFirmado(token, secretoSesion(env));
  if (!carga || typeof carga.u !== 'string' || typeof carga.exp !== 'number') return null;
  if (Date.now() > carga.exp) return null;
  return carga.u;
}

// ---------- Contraseñas (PBKDF2-SHA256) ----------
// Cloudflare Workers permite como máximo 100 000 iteraciones de PBKDF2.
const ITERACIONES = 100_000;

async function derivar(clave, sal, iteraciones) {
  const llave = await crypto.subtle.importKey('raw', codificador.encode(clave), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: iteraciones }, llave, 256);
  return new Uint8Array(bits);
}

export async function hashClave(clave) {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivar(clave, sal, ITERACIONES);
  return { sal: aBase64(sal), hash: aBase64(hash), iteraciones: ITERACIONES };
}

export async function verificarClave(clave, { sal, hash, iteraciones }) {
  const actual = await derivar(clave, deBase64(sal), iteraciones);
  const esperado = deBase64(hash);
  if (actual.length !== esperado.length) return false;
  let diferencia = 0;
  for (let i = 0; i < actual.length; i += 1) diferencia |= actual[i] ^ esperado[i];
  return diferencia === 0;
}
