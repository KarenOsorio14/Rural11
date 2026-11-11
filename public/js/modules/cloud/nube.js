'use strict';
// HU-29: conexión con la base de datos en línea (Worker de Cloudflare + D1).
// Todas las llamadas devuelven { red, status, datos } y nunca lanzan: si no hay internet, red = false.

import { dbPut } from '../../core/db.js';
import { getAttemptsByUser } from '../questionnaires/questionnaires.repository.js';
import * as sessions from '../auth/session.js';

const ESPERA_MAX_MS = 15000;

export async function llamar(ruta, cuerpo) {
  const control = new AbortController();
  const temporizador = setTimeout(() => control.abort(), ESPERA_MAX_MS);
  try {
    const respuesta = await fetch(ruta, {
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

/** true si el servidor todavía no tiene la base en línea conectada (la app sigue en modo local). */
export const sinServidor = (r) => !r.red || r.status === 503 || r.status === 404 || r.status === 405;

// ---------- Avance (intentos) ----------

const claveSubidos = (userId) => `rural11:subidos:${userId}`;

function leerSubidos(userId) {
  try {
    return new Set(JSON.parse(localStorage.getItem(claveSubidos(userId)) || '[]'));
  } catch {
    return new Set();
  }
}

function guardarSubidos(userId, ids) {
  try {
    localStorage.setItem(claveSubidos(userId), JSON.stringify([...ids]));
  } catch { /* sin almacenamiento: se volverá a subir la próxima vez (el servidor no duplica) */ }
}

let subiendo = null;

/**
 * Sube al servidor las actividades de este dispositivo que todavía no están en línea.
 * Se puede llamar muchas veces: si ya hay una subida en curso, espera esa misma.
 */
export function sincronizarAvance(userId) {
  if (!userId) return Promise.resolve({ subidos: 0 });
  if (!subiendo) {
    subiendo = (async () => {
      const token = await sessions.token();
      if (!token) return { subidos: 0 };
      const subidos = leerSubidos(userId);
      const pendientes = (await getAttemptsByUser(userId)).filter((a) => !subidos.has(a.id));
      let total = 0;
      for (let i = 0; i < pendientes.length; i += 50) {
        const grupo = pendientes.slice(i, i + 50);
        const r = await llamar('/api/progreso', { accion: 'subir', token, intentos: grupo });
        if (!(r.status === 200 && r.datos && r.datos.ok)) break; // sin internet: se reintenta más tarde
        grupo.forEach((a) => subidos.add(a.id));
        guardarSubidos(userId, subidos);
        total += grupo.length;
      }
      return { subidos: total };
    })().finally(() => { subiendo = null; });
  }
  return subiendo;
}

/** Trae del servidor todas las actividades del estudiante y las guarda en este dispositivo. */
export async function descargarAvance(userId, token) {
  const r = await llamar('/api/progreso', { accion: 'bajar', token });
  if (!(r.status === 200 && r.datos && Array.isArray(r.datos.intentos))) return 0;
  const subidos = leerSubidos(userId);
  for (const intento of r.datos.intentos) {
    if (!intento || !intento.id) continue;
    await dbPut('questionnaire_attempts', { ...intento, userId });
    subidos.add(intento.id); // ya está en línea: no hace falta volver a subirla
  }
  guardarSubidos(userId, subidos);
  return r.datos.intentos.length;
}

// ---------- HU-23 y HU-24 ----------

/** { estado: 'ok', ...datos } | { estado: 'sin-conexion' } | { estado: 'sin-sesion' } | { estado: 'sin-servidor' } */
async function consultar(accion, extra = {}) {
  const token = await sessions.token();
  if (!token) return { estado: 'sin-sesion' };
  const r = await llamar(accion === 'ocultar' ? '/api/cuentas' : '/api/progreso', { accion, token, ...extra });
  if (!r.red) return { estado: 'sin-conexion' };
  if (r.status === 503) return { estado: 'sin-servidor' };
  if (r.status === 401) return { estado: 'sin-sesion' };
  if (!(r.status === 200 && r.datos && r.datos.ok)) return { estado: 'error' };
  return { estado: 'ok', ...r.datos };
}

export const obtenerRanking = () => consultar('ranking');
export const obtenerComparacion = () => consultar('comparacion');
export const cambiarOculto = (oculto) => consultar('ocultar', { oculto: Boolean(oculto) });
