'use strict';
// Verificación del correo (HU-00): pide el correo a la función de Netlify y marca la cuenta como verificada.

import { users } from '../users/index.js';

const ENDPOINT = '/.netlify/functions/verificacion';
const ESPERA_MAX_MS = 12000;

async function llamar(cuerpo) {
  const control = new AbortController();
  const temporizador = setTimeout(() => control.abort(), ESPERA_MAX_MS);
  try {
    const respuesta = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
      signal: control.signal,
    });
    let datos = null;
    try { datos = await respuesta.json(); } catch { datos = null; }
    return { red: true, status: respuesta.status, datos };
  } catch {
    return { red: false, status: 0, datos: null };
  } finally {
    clearTimeout(temporizador);
  }
}

/** Pide el envío del correo de verificación. Devuelve { ok, motivo } (nunca lanza). */
export async function solicitarVerificacion({ email, nombre }) {
  const r = await llamar({ accion: 'enviar', email, nombre });
  if (r.status === 200 && r.datos && r.datos.ok) return { ok: true };
  if (!r.red) return { ok: false, motivo: 'sin-conexion' };
  return { ok: false, motivo: (r.datos && r.datos.motivo) || 'envio' };
}

/**
 * Comprueba el enlace del correo y marca la cuenta como verificada en este navegador.
 * Estados: verificado | ya-verificado | sin-cuenta-aqui | invalido | expirado | sin-conexion | error
 */
export async function confirmarVerificacion(token) {
  if (!token) return { estado: 'invalido' };
  const r = await llamar({ accion: 'validar', token });
  if (!r.red) return { estado: 'sin-conexion' };
  if (!(r.status === 200 && r.datos && r.datos.ok)) {
    if (r.datos && r.datos.motivo === 'expirado') return { estado: 'expirado' };
    if (r.datos && r.datos.motivo === 'invalido') return { estado: 'invalido' };
    return { estado: 'error' };
  }
  const email = String(r.datos.email).toLowerCase();
  const cuenta = await users.findByEmail(email);
  if (!cuenta) return { estado: 'sin-cuenta-aqui', email };
  if (cuenta.emailVerified) return { estado: 'ya-verificado', email };
  await users.update({ ...cuenta, emailVerified: true, emailVerifiedAt: new Date().toISOString() });
  return { estado: 'verificado', email };
}

/** Texto para el estudiante según el motivo por el que no se pudo enviar el correo. */
export function motivoLegible(motivo) {
  if (motivo === 'sin-conexion') return 'Parece que no hay conexión con el servidor.';
  if (motivo === 'sin-configurar') return 'El envío de correos todavía no está configurado en este sitio.';
  if (motivo === 'correo') return 'El correo no parece válido.';
  return 'No se pudo enviar el correo en este momento.';
}
