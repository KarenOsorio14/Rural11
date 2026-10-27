'use strict';
// Modo día / noche: se guarda la elección en localStorage y se aplica con data-theme en <html>.
// Todo botón con la clase .theme-toggle (hay uno en cada pantalla) cambia el modo de la app.

const STORAGE_KEY = 'theme_preference';
const SVG_NS = 'http://www.w3.org/2000/svg';
const COLOR_KEY = 'color_preference';
const META_COLORS = { dark: '#17153B', light: '#FBF1E3' };

// Colores de la app. «original» es la paleta de siempre (sin data-color en <html>).
export const COLORS = [
  { id: 'original', name: 'Original' },
  { id: 'verde', name: 'Verde' },
  { id: 'rosa', name: 'Rosa' },
  { id: 'naranja', name: 'Naranja' },
  { id: 'azul', name: 'Azul' }
];
const COLOR_IDS = COLORS.map((c) => c.id);
// Fondo de cada color, para pintar la barra del navegador (theme-color).
const COLOR_META = {
  verde: { dark: '#0F2A22', light: '#EEF6EC' },
  rosa: { dark: '#2B1030', light: '#FDEFF4' },
  naranja: { dark: '#2A1608', light: '#FFF3E4' },
  azul: { dark: '#0B1F3A', light: '#EAF3FC' }
};

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
  if (meta) meta.setAttribute('content', (COLOR_META[getColor()] || META_COLORS)[theme]);
}

export function getColor() {
  const attr = document.documentElement.dataset.color;
  if (attr && COLOR_IDS.includes(attr)) return attr;
  try {
    const saved = localStorage.getItem(COLOR_KEY);
    if (COLOR_IDS.includes(saved) && saved !== 'original') return saved;
  } catch {}
  return 'original';
}

export function setColor(color) {
  if (!COLOR_IDS.includes(color)) return;
  if (color === 'original') delete document.documentElement.dataset.color;
  else document.documentElement.dataset.color = color;
  try {
    if (color === 'original') localStorage.removeItem(COLOR_KEY);
    else localStorage.setItem(COLOR_KEY, color);
  } catch {
    // Sin almacenamiento: el color vale solo para esta visita.
  }
  updateToggleButtons(document.documentElement.dataset.theme || getPreferredTheme());
  updateColorPickers();
}

function updateColorPickers() {
  const current = getColor();
  document.querySelectorAll('[data-color-picker] .color-chip').forEach((chip) => {
    const active = chip.dataset.colorValue === current;
    chip.setAttribute('aria-checked', String(active));
    chip.tabIndex = active ? 0 : -1;
  });
}

// Dibuja los botones de color dentro de cada contenedor [data-color-picker].
function initColorPickers() {
  document.querySelectorAll('[data-color-picker]').forEach((box) => {
    if (!box.children.length) {
      COLORS.forEach((color) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'color-chip';
        chip.dataset.colorValue = color.id;
        chip.setAttribute('role', 'radio');
        const dot = document.createElement('span');
        dot.className = 'color-chip__dot';
        dot.setAttribute('aria-hidden', 'true');
        const label = document.createElement('span');
        label.className = 'color-chip__name';
        label.textContent = color.name;
        chip.append(dot, label);
        chip.addEventListener('click', () => setColor(color.id));
        chip.addEventListener('keydown', (event) => {
          const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
          if (!(event.key in keys)) return;
          event.preventDefault();
          const next = (COLOR_IDS.indexOf(getColor()) + keys[event.key] + COLOR_IDS.length) % COLOR_IDS.length;
          setColor(COLOR_IDS[next]);
          box.querySelector(`[data-color-value="${COLOR_IDS[next]}"]`)?.focus();
        });
        box.appendChild(chip);
      });
    }
  });
  updateColorPickers();
}

export function initTheme() {
  const theme = getPreferredTheme();
  document.documentElement.dataset.theme = theme;
  updateToggleButtons(theme);
  initColorPickers();

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
