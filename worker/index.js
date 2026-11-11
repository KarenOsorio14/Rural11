// Worker de Cloudflare para Rural 11.
// Los archivos de la app (carpeta public) los sirve Cloudflare directamente. Este código solo
// se ejecuta cuando la dirección no corresponde a ningún archivo: atiende las rutas /api/ y
// en cualquier otro caso devuelve la respuesta normal de los archivos estáticos.

import { onRequest as verificacion } from './verificacion.js';
import { onRequest as cuentas } from './cuentas.js';
import { onRequest as progreso } from './progreso.js';

// HU-29: cuentas y avance en línea (base de datos D1, enlazada como DB en wrangler.jsonc).
const RUTAS = {
  '/api/verificacion': verificacion,
  '/api/cuentas': cuentas,
  '/api/progreso': progreso,
};

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    const ruta = RUTAS[pathname];
    if (ruta) return ruta({ request, env, ctx });
    // La raíz del sitio es index.html.
    if (pathname === '/') {
      return env.ASSETS.fetch(new Request(new URL('/index.html', request.url), request));
    }
    return env.ASSETS.fetch(request);
  },
};
