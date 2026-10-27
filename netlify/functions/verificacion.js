'use strict';
// Verificación del correo (HU-00).
//
// Una sola función con dos acciones:
//   { accion: 'enviar', email, nombre }  -> manda al correo un enlace firmado que dura 48 horas.
//   { accion: 'validar', token }         -> comprueba la firma y la fecha del enlace.
//
// El enlace lleva el correo y la fecha de vencimiento firmados con HMAC-SHA256, así que no hace
// falta base de datos: nadie puede fabricar ni cambiar un enlace sin conocer VERIFY_SECRET.
//
// Variables de entorno (se crean en Netlify > Site configuration > Environment variables):
//   VERIFY_SECRET       texto largo y aleatorio (firma los enlaces)
//   GMAIL_USER          cuenta de Gmail desde la que salen los correos
//   GMAIL_APP_PASSWORD  contraseña de aplicación de esa cuenta (no la contraseña normal)
//   SITE_URL            opcional; dirección pública de la app (si falta se usa la de Netlify)

const crypto = require('crypto');

const VIGENCIA_MS = 48 * 60 * 60 * 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const respuesta = (status, cuerpo) => ({
  statusCode: status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  body: JSON.stringify(cuerpo),
});

const b64 = (valor) => Buffer.from(valor).toString('base64url');

function firmar(carga, secreto) {
  const cuerpo = b64(JSON.stringify(carga));
  const firma = crypto.createHmac('sha256', secreto).update(cuerpo).digest('base64url');
  return `${cuerpo}.${firma}`;
}

function leerToken(token, secreto, ahora) {
  const partes = String(token || '').split('.');
  if (partes.length !== 2) return { ok: false, motivo: 'invalido' };
  const [cuerpo, firma] = partes;
  const esperada = crypto.createHmac('sha256', secreto).update(cuerpo).digest('base64url');
  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, motivo: 'invalido' };
  let carga;
  try {
    carga = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, motivo: 'invalido' };
  }
  if (!carga || typeof carga.e !== 'string' || typeof carga.exp !== 'number') return { ok: false, motivo: 'invalido' };
  if (ahora > carga.exp) return { ok: false, motivo: 'expirado' };
  return { ok: true, email: carga.e };
}

const escapar = (texto) => String(texto).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

function correo({ nombre, enlace }) {
  const saludo = nombre ? `Hola, ${nombre}` : 'Hola';
  return {
    subject: 'Verifica tu correo en Rural 11',
    text: `${saludo}.\n\nPara terminar de crear tu cuenta en Rural 11, verifica tu correo abriendo este enlace (vale 48 horas):\n${enlace}\n\nÁbrelo en el mismo navegador donde te registraste.\nSi no creaste la cuenta, ignora este mensaje.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#2B2118">
<h2 style="margin:0 0 12px">${escapar(saludo)}</h2>
<p>Para terminar de crear tu cuenta en <strong>Rural 11</strong>, verifica tu correo (el enlace vale 48 horas):</p>
<p><a href="${escapar(enlace)}" style="display:inline-block;padding:12px 20px;background:#C4532D;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold">Verificar mi correo</a></p>
<p style="font-size:13px;color:#6A5946">Ábrelo en el mismo navegador donde te registraste. Si no creaste la cuenta, ignora este mensaje.</p>
</div>`,
  };
}

function baseUrl(event, entorno) {
  const configurada = entorno.SITE_URL || entorno.URL;
  if (configurada) return configurada.replace(/\/+$/, '');
  const origen = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
  return origen.replace(/\/+$/, '');
}

// Solo se acepta la llamada si viene de la propia página (mismo sitio).
function mismoSitio(event) {
  const h = event.headers || {};
  const origen = h.origin || h.Origin;
  const host = h.host || h.Host;
  if (!origen) return true;
  try {
    return new URL(origen).host === host;
  } catch {
    return false;
  }
}

function crearHandler({ entorno = process.env, ahora = () => Date.now(), crearTransporte } = {}) {
  return async function handler(event) {
    if (event.httpMethod !== 'POST') return respuesta(405, { ok: false, motivo: 'metodo' });
    if (!mismoSitio(event)) return respuesta(403, { ok: false, motivo: 'origen' });

    const secreto = entorno.VERIFY_SECRET;
    if (!secreto || secreto.length < 16) return respuesta(503, { ok: false, motivo: 'sin-configurar' });

    let datos;
    try {
      datos = JSON.parse(event.body || '{}');
    } catch {
      return respuesta(400, { ok: false, motivo: 'datos' });
    }

    if (datos.accion === 'validar') {
      const lectura = leerToken(datos.token, secreto, ahora());
      return respuesta(lectura.ok ? 200 : 400, lectura);
    }

    if (datos.accion === 'enviar') {
      const email = String(datos.email || '').trim().toLowerCase();
      if (!EMAIL_PATTERN.test(email) || email.length > 254) return respuesta(400, { ok: false, motivo: 'correo' });
      const nombre = String(datos.nombre || '').trim().slice(0, 80);

      if (!entorno.GMAIL_USER || !entorno.GMAIL_APP_PASSWORD) {
        return respuesta(503, { ok: false, motivo: 'sin-configurar' });
      }
      const base = baseUrl(event, entorno);
      if (!base) return respuesta(503, { ok: false, motivo: 'sin-configurar' });

      const token = firmar({ e: email, exp: ahora() + VIGENCIA_MS }, secreto);
      const enlace = `${base}/verificar.html?token=${encodeURIComponent(token)}`;
      try {
        const transporte = crearTransporte
          ? crearTransporte()
          : require('nodemailer').createTransport({
              service: 'gmail',
              auth: { user: entorno.GMAIL_USER, pass: entorno.GMAIL_APP_PASSWORD },
            });
        await transporte.sendMail({
          from: `Rural 11 <${entorno.GMAIL_USER}>`,
          to: email,
          ...correo({ nombre, enlace }),
        });
      } catch (error) {
        console.error('No se pudo enviar el correo de verificación:', error && error.message);
        return respuesta(502, { ok: false, motivo: 'envio' });
      }
      return respuesta(200, { ok: true });
    }

    return respuesta(400, { ok: false, motivo: 'accion' });
  };
}

exports.handler = crearHandler();
exports.crearHandler = crearHandler;
