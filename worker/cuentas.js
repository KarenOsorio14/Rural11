// HU-29: cuentas en línea. Atiende POST /api/cuentas con una "accion":
//   registro     { documento, correo, nombres, apellidos, clave, id? } -> { ok, usuario, token }
//   login        { documento, clave }                                   -> { ok, usuario, token }
//   yo           { token }                                              -> { ok, usuario }
//   restablecer  { documento, correo, clave }                           -> { ok }
//   ocultar      { token, oculto }                                      -> { ok, oculto }   (HU-24)
// Las validaciones son las mismas de HU-00 / HU-01; el servidor no confía en lo que valida la página.

import { responder, mismoSitio, leerJson, servidorListo, crearSesion, usuarioDeSesion, hashClave, verificarClave } from './comun.js';

const PATRON_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PATRON_NUMERO = /^\d+$/;
const PATRON_NOMBRE = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s]+$/;
const PATRON_ID = /^[A-Za-z0-9-]{8,64}$/;
const MAX_FALLOS = 3;
const BLOQUEO_MS = 60 * 1000;

const limpiarNombre = (texto) => String(texto || '').trim().replace(/\s+/g, ' ');

function errorClave(clave) {
  const valor = String(clave || '');
  if (!valor.trim()) return 'Campo obligatorio.';
  if (valor.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (valor.length > 128) return 'La contraseña debe tener máximo 128 caracteres.';
  if (!/[A-Z]/.test(valor)) return 'La contraseña debe contener al menos una letra mayúscula.';
  if (!/[a-z]/.test(valor)) return 'La contraseña debe contener al menos una letra minúscula.';
  if (!/[0-9]/.test(valor)) return 'La contraseña debe contener al menos un número.';
  if (!/[^A-Za-z0-9]/.test(valor)) return 'La contraseña debe contener al menos un carácter especial.';
  return null;
}

const invalido = (campo, mensaje) => responder(400, { ok: false, motivo: 'validacion', campo, mensaje });

/** Datos del usuario que pueden salir del servidor (nunca la contraseña). */
const publico = (fila) => ({
  id: fila.id,
  documentNumber: fila.documento,
  email: fila.correo,
  firstName: fila.nombres,
  lastName: fila.apellidos,
  name: `${fila.nombres} ${fila.apellidos}`,
  emailVerified: Boolean(fila.verificado),
  hidden: Boolean(fila.oculto),
});

async function registro(env, datos) {
  const documento = String(datos.documento || '').trim();
  const correo = String(datos.correo || '').trim().toLowerCase();
  const nombres = limpiarNombre(datos.nombres);
  const apellidos = limpiarNombre(datos.apellidos);

  if (!nombres) return invalido('firstName', 'Campo obligatorio.');
  if (!PATRON_NOMBRE.test(nombres) || nombres.length > 60) return invalido('firstName', 'Solo se permiten letras.');
  if (!apellidos) return invalido('lastName', 'Campo obligatorio.');
  if (!PATRON_NOMBRE.test(apellidos) || apellidos.length > 60) return invalido('lastName', 'Solo se permiten letras.');
  if (!documento) return invalido('documentNumber', 'Campo obligatorio.');
  if (!PATRON_NUMERO.test(documento) || documento.length > 20) return invalido('documentNumber', 'El número de identidad solo debe contener números.');
  if (!correo) return invalido('email', 'Campo obligatorio.');
  if (!PATRON_CORREO.test(correo) || correo.length > 254) return invalido('email', 'Correo electrónico inválido.');
  const fallaClave = errorClave(datos.clave);
  if (fallaClave) return invalido('password', fallaClave);

  const existe = await env.DB.prepare('SELECT 1 FROM usuarios WHERE documento = ?1 OR correo = ?2').bind(documento, correo).first();
  if (existe) return responder(409, { ok: false, motivo: 'duplicado' });

  // Una cuenta que ya existía solo en un navegador conserva su id, para que su avance siga siendo suyo.
  const id = PATRON_ID.test(String(datos.id || '')) ? String(datos.id) : crypto.randomUUID();
  const clave = await hashClave(String(datos.clave));
  try {
    await env.DB.prepare(
      `INSERT INTO usuarios (id, documento, correo, nombres, apellidos, clave_sal, clave_hash, clave_iteraciones, creado)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
    ).bind(id, documento, correo, nombres, apellidos, clave.sal, clave.hash, clave.iteraciones, new Date().toISOString()).run();
  } catch {
    // Otro registro con los mismos datos entró al mismo tiempo, o el id ya estaba usado.
    return responder(409, { ok: false, motivo: 'duplicado' });
  }
  const fila = await env.DB.prepare('SELECT * FROM usuarios WHERE id = ?1').bind(id).first();
  return responder(201, { ok: true, usuario: publico(fila), token: await crearSesion(env, id) });
}

async function login(env, datos) {
  const documento = String(datos.documento || '').trim();
  const clave = String(datos.clave || '');
  if (!documento) return invalido('documentNumber', 'Campo obligatorio.');
  if (!PATRON_NUMERO.test(documento) || documento.length > 20) return invalido('documentNumber', 'El número de identidad solo debe contener números.');
  if (!clave) return invalido('password', 'Campo obligatorio.');

  const ahora = Date.now();
  const bloqueo = await env.DB.prepare('SELECT fallos, hasta FROM bloqueos WHERE documento = ?1').bind(documento).first();
  if (bloqueo && bloqueo.hasta > ahora) {
    return responder(429, { ok: false, motivo: 'bloqueado', segundos: Math.ceil((bloqueo.hasta - ahora) / 1000) });
  }

  const fila = await env.DB.prepare('SELECT * FROM usuarios WHERE documento = ?1').bind(documento).first();
  const valida = fila
    ? await verificarClave(clave, { sal: fila.clave_sal, hash: fila.clave_hash, iteraciones: fila.clave_iteraciones })
    : false;

  if (!valida) {
    // Si el bloqueo anterior ya venció, se empieza a contar de nuevo.
    const fallos = (bloqueo && bloqueo.hasta && bloqueo.hasta <= ahora ? 0 : (bloqueo ? bloqueo.fallos : 0)) + 1;
    const hasta = fallos >= MAX_FALLOS ? ahora + BLOQUEO_MS : 0;
    await env.DB.prepare(
      `INSERT INTO bloqueos (documento, fallos, hasta) VALUES (?1, ?2, ?3)
       ON CONFLICT(documento) DO UPDATE SET fallos = ?2, hasta = ?3`
    ).bind(documento, hasta ? 0 : fallos, hasta).run();
    if (hasta) return responder(429, { ok: false, motivo: 'bloqueado', segundos: Math.ceil(BLOQUEO_MS / 1000) });
    // Mismo mensaje si el documento no existe o si la contraseña no coincide (HU-03).
    return responder(401, { ok: false, motivo: 'credenciales' });
  }

  await env.DB.prepare('DELETE FROM bloqueos WHERE documento = ?1').bind(documento).run();
  return responder(200, { ok: true, usuario: publico(fila), token: await crearSesion(env, fila.id) });
}

async function yo(env, datos) {
  const usuarioId = await usuarioDeSesion(env, datos.token);
  if (!usuarioId) return responder(401, { ok: false, motivo: 'sesion' });
  const fila = await env.DB.prepare('SELECT * FROM usuarios WHERE id = ?1').bind(usuarioId).first();
  if (!fila) return responder(401, { ok: false, motivo: 'sesion' });
  return responder(200, { ok: true, usuario: publico(fila) });
}

async function restablecer(env, datos) {
  const documento = String(datos.documento || '').trim();
  const correo = String(datos.correo || '').trim().toLowerCase();
  if (!documento || !PATRON_NUMERO.test(documento)) return invalido('documentNumber', 'El número de identidad solo debe contener números.');
  if (!correo || !PATRON_CORREO.test(correo)) return invalido('email', 'Correo electrónico inválido.');
  const fallaClave = errorClave(datos.clave);
  if (fallaClave) return invalido('newPassword', fallaClave);

  const fila = await env.DB.prepare('SELECT id FROM usuarios WHERE documento = ?1 AND correo = ?2').bind(documento, correo).first();
  if (!fila) return responder(404, { ok: false, motivo: 'no-coincide' });
  const clave = await hashClave(String(datos.clave));
  await env.DB.batch([
    env.DB.prepare('UPDATE usuarios SET clave_sal = ?1, clave_hash = ?2, clave_iteraciones = ?3 WHERE id = ?4')
      .bind(clave.sal, clave.hash, clave.iteraciones, fila.id),
    env.DB.prepare('DELETE FROM bloqueos WHERE documento = ?1').bind(documento),
  ]);
  return responder(200, { ok: true });
}

async function ocultar(env, datos) {
  const usuarioId = await usuarioDeSesion(env, datos.token);
  if (!usuarioId) return responder(401, { ok: false, motivo: 'sesion' });
  const oculto = datos.oculto ? 1 : 0;
  await env.DB.prepare('UPDATE usuarios SET oculto = ?1 WHERE id = ?2').bind(oculto, usuarioId).run();
  return responder(200, { ok: true, oculto: Boolean(oculto) });
}

const ACCIONES = { registro, login, yo, restablecer, ocultar };

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return responder(405, { ok: false, motivo: 'metodo' });
  if (!mismoSitio(request)) return responder(403, { ok: false, motivo: 'origen' });
  if (!servidorListo(env)) return responder(503, { ok: false, motivo: 'sin-configurar' });
  const datos = await leerJson(request, 20_000);
  if (!datos || typeof datos !== 'object') return responder(400, { ok: false, motivo: 'datos' });
  const accion = ACCIONES[datos.accion];
  if (!accion) return responder(400, { ok: false, motivo: 'accion' });
  try {
    return await accion(env, datos);
  } catch (error) {
    console.error('Error en /api/cuentas:', datos.accion, error && error.message);
    return responder(500, { ok: false, motivo: 'servidor' });
  }
}
