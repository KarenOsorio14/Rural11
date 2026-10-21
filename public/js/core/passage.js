'use strict';
// Dibuja el texto ("passage") que acompaña a una pregunta de lectura.
// Devuelve HTML listo para insertar; el contenido se escapa para que sea seguro.

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (ch) => ESCAPES[ch]);

export function passageHtml(passage) {
  if (!passage) return '';
  const paragraphs = String(passage.text || '')
    .split('\n')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join('');
  const source = passage.source ? `<figcaption class="q-passage__source">${escapeHtml(passage.source)}</figcaption>` : '';
  return `
    <figure class="q-passage">
      <p class="q-passage__label">Lee el texto</p>
      <h3 class="q-passage__title">${escapeHtml(passage.title || '')}</h3>
      <div class="q-passage__text">${paragraphs}</div>
      ${source}
    </figure>`;
}
