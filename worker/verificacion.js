// Verificación del correo (HU-00). La usa worker/index.js para responder en /api/verificacion.
//
// Dos acciones (POST con JSON):
//   { accion: 'enviar', email, nombre }  -> manda al correo un enlace firmado que dura 48 horas.
//   { accion: 'validar', token }         -> comprueba la firma y la fecha del enlace.
//
// El enlace lleva el correo y la fecha de vencimiento firmados con HMAC-SHA256, así que no hace
// falta base de datos: nadie puede fabricar ni cambiar un enlace sin conocer VERIFY_SECRET.
// El correo sale por la API de Brevo (plan gratis).
//
// Variables (Cloudflare > Workers y Pages > rural11 > Configuración > Variables y secretos, tipo «Secreto»):
//   VERIFY_SECRET   texto largo y aleatorio (mínimo 16 caracteres). Firma los enlaces.
//   BREVO_API_KEY   clave de API de Brevo.
//   MAIL_FROM       correo remitente, verificado como remitente en Brevo.
//   MAIL_FROM_NAME  opcional; nombre que ve el estudiante (por defecto «Rural 11»).
//   SITE_URL        opcional; dirección pública de la app (si falta se usa la de la petición).

const VIGENCIA_MS = 48 * 60 * 60 * 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const codificador = new TextEncoder();

const responder = (status, cuerpo) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

function aBase64Url(bytes) {
  let texto = '';
  for (const byte of bytes) texto += String.fromCharCode(byte);
  return btoa(texto).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function deBase64Url(texto) {
  const normal = texto.replace(/-/g, '+').replace(/_/g, '/');
  const binario = atob(normal + '='.repeat((4 - (normal.length % 4)) % 4));
  return Uint8Array.from(binario, (c) => c.charCodeAt(0));
}

async function llave(secreto, usos) {
  return crypto.subtle.importKey('raw', codificador.encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, usos);
}

async function firmar(carga, secreto) {
  const cuerpo = aBase64Url(codificador.encode(JSON.stringify(carga)));
  const firma = await crypto.subtle.sign('HMAC', await llave(secreto, ['sign']), codificador.encode(cuerpo));
  return `${cuerpo}.${aBase64Url(new Uint8Array(firma))}`;
}

async function leerToken(token, secreto) {
  const partes = String(token || '').split('.');
  if (partes.length !== 2) return { ok: false, motivo: 'invalido' };
  const [cuerpo, firma] = partes;
  let valida = false;
  try {
    // verify compara en tiempo constante.
    valida = await crypto.subtle.verify('HMAC', await llave(secreto, ['verify']), deBase64Url(firma), codificador.encode(cuerpo));
  } catch {
    valida = false;
  }
  if (!valida) return { ok: false, motivo: 'invalido' };
  let carga;
  try {
    carga = JSON.parse(new TextDecoder().decode(deBase64Url(cuerpo)));
  } catch {
    return { ok: false, motivo: 'invalido' };
  }
  if (!carga || typeof carga.e !== 'string' || typeof carga.exp !== 'number') return { ok: false, motivo: 'invalido' };
  if (Date.now() > carga.exp) return { ok: false, motivo: 'expirado' };
  return { ok: true, email: carga.e };
}

const escapar = (texto) => String(texto).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

function contenidoCorreo({ nombre, enlace }) {
  const saludo = nombre ? `Hola, ${nombre}` : 'Hola';
  return {
    subject: 'Verifica tu correo en Rural 11',
    textContent: `${saludo}.\n\nPara terminar de crear tu cuenta en Rural 11, verifica tu correo abriendo este enlace (vale 48 horas):\n${enlace}\n\nÁbrelo en el mismo navegador donde te registraste.\nSi no creaste la cuenta, ignora este mensaje.`,
    htmlContent: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#2B2118">
<h2 style="margin:0 0 12px">${escapar(saludo)}</h2>
<p>Para terminar de crear tu cuenta en <strong>Rural 11</strong>, verifica tu correo (el enlace vale 48 horas):</p>
<p><a href="${escapar(enlace)}" style="display:inline-block;padding:12px 20px;background:#C4532D;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold">Verificar mi correo</a></p>
<p style="font-size:13px;color:#6A5946">Ábrelo en el mismo navegador donde te registraste. Si no creaste la cuenta, ignora este mensaje.</p>
</div>`,
  };
}

// Solo se acepta la llamada si viene de la propia página (mismo sitio).
function mismoSitio(request) {
  const origen = request.headers.get('Origin');
  if (!origen) return true;
  try {
    return new URL(origen).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return responder(405, { ok: false, motivo: 'metodo' });
  if (!mismoSitio(request)) return responder(403, { ok: false, motivo: 'origen' });

  const secreto = env.VERIFY_SECRET;
  if (!secreto || secreto.length < 16) return responder(503, { ok: false, motivo: 'sin-configurar' });

  let datos;
  try {
    datos = await request.json();
  } catch {
    return responder(400, { ok: false, motivo: 'datos' });
  }

  if (datos.accion === 'validar') {
    const lectura = await leerToken(datos.token, secreto);
    return responder(lectura.ok ? 200 : 400, lectura);
  }

  if (datos.accion === 'enviar') {
    const email = String(datos.email || '').trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email) || email.length > 254) return responder(400, { ok: false, motivo: 'correo' });
    const nombre = String(datos.nombre || '').trim().slice(0, 80);

    if (!env.BREVO_API_KEY || !env.MAIL_FROM) return responder(503, { ok: false, motivo: 'sin-configurar' });

    const base = String(env.SITE_URL || new URL(request.url).origin).replace(/\/+$/, '');
    const token = await firmar({ e: email, exp: Date.now() + VIGENCIA_MS }, secreto);
    const enlace = `${base}/verificar.html?token=${encodeURIComponent(token)}`;
    try {
      const envio = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          sender: { name: env.MAIL_FROM_NAME || 'Rural 11', email: env.MAIL_FROM },
          to: [{ email }],
          ...contenidoCorreo({ nombre, enlace }),
        }),
      });
      if (!envio.ok) {
        console.error('Brevo rechazó el correo:', envio.status, await envio.text().catch(() => ''));
        return responder(502, { ok: false, motivo: 'envio' });
      }
    } catch (error) {
      console.error('No se pudo enviar el correo de verificación:', error && error.message);
      return responder(502, { ok: false, motivo: 'envio' });
    }
    return responder(200, { ok: true });
  }

  return responder(400, { ok: false, motivo: 'accion' });
}
