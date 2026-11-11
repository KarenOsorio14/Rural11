// HU-29: avance en línea, y HU-23 / HU-24: tabla de posiciones y comparación.
// Atiende POST /api/progreso con una "accion" y el token de sesión:
//   subir        { token, intentos: [...] }  -> { ok, guardados }   guarda o actualiza actividades terminadas
//   bajar        { token }                   -> { ok, intentos }    todas las actividades del estudiante
//   ranking      { token }                   -> { ok, tabla, yo, participantes }          (HU-23)
//   comparacion  { token }                   -> { ok, miPromedio, promedioGeneral, ... }  (HU-24)

import { responder, mismoSitio, leerJson, servidorListo, usuarioDeSesion } from './comun.js';

const PUNTOS_POR_ACIERTO = 10; // el mismo valor de HU-20 en la app
const MAX_INTENTOS_POR_LLAMADA = 100;
const MAX_BYTES_INTENTO = 100_000;
const TAMANO_TABLA = 50;
const PATRON_ID = /^[A-Za-z0-9_.:-]{1,80}$/;

const numero = (valor) => (Number.isFinite(Number(valor)) ? Number(valor) : 0);

/** "Karen Osorio" -> "Karen O." (HU-23: nombre + inicial, sin datos sensibles). */
function nombreCorto(nombres, apellidos) {
  const primero = String(nombres || '').trim().split(/\s+/)[0] || 'Estudiante';
  const inicial = String(apellidos || '').trim().charAt(0).toUpperCase();
  return inicial ? `${primero} ${inicial}.` : primero;
}

async function subir(env, usuarioId, datos) {
  const lista = Array.isArray(datos.intentos) ? datos.intentos : null;
  if (!lista || lista.length > MAX_INTENTOS_POR_LLAMADA) return responder(400, { ok: false, motivo: 'datos' });

  const sentencias = [];
  for (const intento of lista) {
    if (!intento || typeof intento !== 'object' || !PATRON_ID.test(String(intento.id || ''))) continue;
    // El intento siempre queda a nombre de quien tiene la sesión.
    const limpio = { ...intento, userId: usuarioId };
    const texto = JSON.stringify(limpio);
    if (texto.length > MAX_BYTES_INTENTO) continue;
    const aciertos = Math.max(0, Math.floor(numero(intento.correctCount)));
    const porcentaje = Math.max(0, Math.min(100, Math.round(numero(intento.percentage))));
    const creado = String(intento.createdAt || new Date().toISOString()).slice(0, 40);
    // Si el id ya existe y es de otro estudiante, no se toca.
    sentencias.push(env.DB.prepare(
      `INSERT INTO intentos (id, usuario_id, datos, puntos, porcentaje, creado) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
       ON CONFLICT(id) DO UPDATE SET datos = excluded.datos, puntos = excluded.puntos,
         porcentaje = excluded.porcentaje, creado = excluded.creado
       WHERE intentos.usuario_id = excluded.usuario_id`
    ).bind(String(intento.id), usuarioId, texto, aciertos * PUNTOS_POR_ACIERTO, porcentaje, creado));
  }
  if (sentencias.length) await env.DB.batch(sentencias);
  return responder(200, { ok: true, guardados: sentencias.length });
}

async function bajar(env, usuarioId) {
  const { results } = await env.DB.prepare('SELECT datos FROM intentos WHERE usuario_id = ?1 ORDER BY creado').bind(usuarioId).all();
  const intentos = [];
  for (const fila of results || []) {
    try { intentos.push(JSON.parse(fila.datos)); } catch { /* se ignora una fila dañada */ }
  }
  return responder(200, { ok: true, intentos });
}

async function ranking(env, usuarioId) {
  const { results } = await env.DB.prepare(
    `SELECT u.id, u.nombres, u.apellidos, u.oculto, COALESCE(SUM(i.puntos), 0) AS puntos
     FROM usuarios u LEFT JOIN intentos i ON i.usuario_id = u.id
     GROUP BY u.id`
  ).all();
  const filas = results || [];
  // Participan quienes ya tienen puntos y no pidieron ocultarse (HU-24). El propio estudiante
  // siempre conoce su posición, aunque esté oculto para los demás.
  const participan = filas
    .filter((f) => numero(f.puntos) > 0 && (!f.oculto || f.id === usuarioId))
    .sort((a, b) => numero(b.puntos) - numero(a.puntos) || String(a.nombres).localeCompare(String(b.nombres), 'es'));

  // Posición tipo competencia: empates comparten puesto (1, 2, 2, 4).
  let puesto = 0;
  let anterior = null;
  const conPuesto = participan.map((f, i) => {
    if (numero(f.puntos) !== anterior) { puesto = i + 1; anterior = numero(f.puntos); }
    return { ...f, puesto };
  });

  const visibles = conPuesto.filter((f) => !f.oculto || f.id === usuarioId);
  const tabla = visibles.slice(0, TAMANO_TABLA).map((f) => ({
    posicion: f.puesto,
    nombre: nombreCorto(f.nombres, f.apellidos),
    puntos: numero(f.puntos),
    soyYo: f.id === usuarioId,
  }));
  const mio = conPuesto.find((f) => f.id === usuarioId);
  const yo = mio
    ? { posicion: mio.puesto, puntos: numero(mio.puntos), oculto: Boolean(mio.oculto) }
    : { posicion: null, puntos: 0, oculto: Boolean((filas.find((f) => f.id === usuarioId) || {}).oculto) };
  if (mio && !tabla.some((f) => f.soyYo)) {
    // Si el estudiante no alcanza a salir en las primeras filas, se agrega al final para que se vea.
    tabla.push({ posicion: mio.puesto, nombre: nombreCorto(mio.nombres, mio.apellidos), puntos: numero(mio.puntos), soyYo: true });
  }
  return responder(200, { ok: true, tabla, yo, participantes: conPuesto.length });
}

async function comparacion(env, usuarioId) {
  const { results } = await env.DB.prepare(
    `SELECT u.id, u.oculto, AVG(i.porcentaje) AS promedio, COUNT(i.id) AS actividades
     FROM usuarios u JOIN intentos i ON i.usuario_id = u.id
     GROUP BY u.id`
  ).all();
  const filas = results || [];
  const mia = filas.find((f) => f.id === usuarioId);
  // El promedio general es el de cada estudiante visible, para que nadie pese más por hacer más actividades.
  const publicas = filas.filter((f) => !f.oculto);
  const promedioGeneral = publicas.length
    ? Math.round(publicas.reduce((suma, f) => suma + numero(f.promedio), 0) / publicas.length)
    : null;
  const yoOculto = await env.DB.prepare('SELECT oculto FROM usuarios WHERE id = ?1').bind(usuarioId).first();
  return responder(200, {
    ok: true,
    miPromedio: mia ? Math.round(numero(mia.promedio)) : null,
    misActividades: mia ? numero(mia.actividades) : 0,
    promedioGeneral,
    estudiantes: publicas.length,
    oculto: Boolean(yoOculto && yoOculto.oculto),
  });
}

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return responder(405, { ok: false, motivo: 'metodo' });
  if (!mismoSitio(request)) return responder(403, { ok: false, motivo: 'origen' });
  if (!servidorListo(env)) return responder(503, { ok: false, motivo: 'sin-configurar' });
  const datos = await leerJson(request, MAX_INTENTOS_POR_LLAMADA * MAX_BYTES_INTENTO);
  if (!datos || typeof datos !== 'object') return responder(400, { ok: false, motivo: 'datos' });

  const usuarioId = await usuarioDeSesion(env, datos.token);
  if (!usuarioId) return responder(401, { ok: false, motivo: 'sesion' });
  const existe = await env.DB.prepare('SELECT 1 FROM usuarios WHERE id = ?1').bind(usuarioId).first();
  if (!existe) return responder(401, { ok: false, motivo: 'sesion' });

  try {
    if (datos.accion === 'subir') return await subir(env, usuarioId, datos);
    if (datos.accion === 'bajar') return await bajar(env, usuarioId);
    if (datos.accion === 'ranking') return await ranking(env, usuarioId);
    if (datos.accion === 'comparacion') return await comparacion(env, usuarioId);
    return responder(400, { ok: false, motivo: 'accion' });
  } catch (error) {
    console.error('Error en /api/progreso:', datos.accion, error && error.message);
    return responder(500, { ok: false, motivo: 'servidor' });
  }
}
