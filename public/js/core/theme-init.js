// Se carga en el <head> de cada página (sin type="module") para aplicar el tema guardado
// antes de que se pinte la pantalla y evitar el parpadeo entre día y noche.
(function () {
  var theme = null;
  try { theme = localStorage.getItem('theme_preference'); } catch (e) { theme = null; }
  if (theme !== 'dark' && theme !== 'light') {
    theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  document.documentElement.setAttribute('data-theme', theme);
})();
