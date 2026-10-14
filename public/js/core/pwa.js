import './theme.js';

const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
  window.location.hostname === '[::1]' ||
  window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
);

if ('serviceWorker' in navigator) {
  if (isLocalhost) {
    // En desarrollo local desregistra el Service Worker y limpia cachés para que funcione como una web normal sin bloqueos
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
    });
    // Recarga automática en tiempo real instantánea para desarrollo
    try {
      const source = new EventSource('/__live_reload');
      source.onmessage = (event) => {
        if (event.data === 'reload') {
          location.reload();
        }
      };
    } catch (e) {
      // Ignorar si el endpoint no está disponible
    }
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.warn('No se pudo registrar el service worker:', error);
      });
    });
  }
}
