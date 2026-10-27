// Worker de Cloudflare para Rural 11.
// Los archivos de la app (carpeta public) los sirve Cloudflare directamente. Este código solo
// se ejecuta cuando la dirección no corresponde a ningún archivo: atiende /api/verificacion y
// en cualquier otro caso devuelve la respuesta normal de los archivos estáticos.

import { onRequest as verificacion } from './verificacion.js';

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/verificacion') {
      return verificacion({ request, env, ctx });
    }
    // La raíz del sitio es index.html.
    if (pathname === '/') {
      return env.ASSETS.fetch(new Request(new URL('/index.html', request.url), request));
    }
    return env.ASSETS.fetch(request);
  },
};
