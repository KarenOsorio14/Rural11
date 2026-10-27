'use strict';
// Grano en las pantallas de resultados: celebra si el estudiante aprueba y lo
// acompaña si todavía no. La imagen es decorativa (el mensaje ya dice el resultado).

const MINIMO_APROBAR = 60;

export function granoResultadoPose(percentage, { libre = false } = {}) {
  if (percentage >= 80) return 'medalla';
  if (percentage >= MINIMO_APROBAR) return 'celebra';
  if (libre) return 'estudia';
  return percentage >= 40 ? 'confundido' : 'nervioso';
}

export function granoResultadoHtml(percentage, opciones = {}) {
  const pose = granoResultadoPose(percentage, opciones);
  const tono = percentage >= MINIMO_APROBAR ? 'ok' : 'animo';
  return `<img class="grano-resultado grano-resultado--${tono}" src="/img/grano/3d/${pose}.webp" alt="" width="132" height="132" aria-hidden="true">`;
}
