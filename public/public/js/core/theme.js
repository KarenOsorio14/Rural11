'use strict';

const STORAGE_KEY = 'theme_preference';

export function getPreferredTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'dark' || saved === 'light') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(STORAGE_KEY, theme);
  updateToggleButtons(theme);
}

export function toggleTheme() {
  const current = document.documentElement.dataset.theme || getPreferredTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  setTheme(next);
}

function updateToggleButtons(theme) {
  const buttons = document.querySelectorAll('.theme-toggle');
  buttons.forEach((btn) => {
    btn.textContent = theme === 'dark' ? '☀️' : '🌙';
    btn.setAttribute('aria-label', theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
    btn.title = theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
  });
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
