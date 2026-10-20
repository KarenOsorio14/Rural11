'use strict';
// Modo día / noche: se guarda la elección en localStorage y se aplica con data-theme en <html>.
// Todo botón con la clase .theme-toggle (hay uno en cada pantalla) cambia el modo de la app.

const STORAGE_KEY = 'theme_preference';
const SVG_NS = 'http://www.w3.org/2000/svg';
const META_COLORS = { dark: '#17153B', light: '#FBF1E3' };

function readSaved() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function getPreferredTheme() {
  const saved = readSaved();
  if (saved === 'dark' || saved === 'light') return saved;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Sin almacenamiento disponible: el cambio vale solo para esta visita.
  }
  updateToggleButtons(theme);
}

export function toggleTheme() {
  const current = document.documentElement.dataset.theme || getPreferredTheme();
  setTheme(current === 'dark' ? 'light' : 'dark');
}

function iconFor(theme) {
  // En modo noche se muestra el sol (para pasar al día); en modo día, la luna.
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'ico');
  svg.setAttribute('aria-hidden', 'true');
  const add = (name, attrs) => {
    const el = document.createElementNS(SVG_NS, name);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    svg.appendChild(el);
  };
  if (theme === 'dark') {
    add('circle', { cx: 12, cy: 12, r: 4 });
    add('path', { d: 'M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4' });
  } else {
    add('path', { d: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z' });
  }
  return svg;
}

function updateToggleButtons(theme) {
  const label = theme === 'dark' ? 'Cambiar a modo día' : 'Cambiar a modo noche';
  document.querySelectorAll('.theme-toggle').forEach((btn) => {
    btn.replaceChildren(iconFor(theme));
    btn.setAttribute('aria-label', label);
    btn.title = label;
  });
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', META_COLORS[theme]);
}

export function initTheme() {
  const theme = getPreferredTheme();
  document.documentElement.dataset.theme = theme;
  updateToggleButtons(theme);

  document.querySelectorAll('.theme-toggle').forEach((btn) => {
    btn.removeEventListener('click', toggleTheme);
    btn.addEventListener('click', toggleTheme);
  });
}

// Auto-inicializar
initTheme();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTheme);
}
