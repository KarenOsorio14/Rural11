const FLASH_KEY = 'pwa:flash';
const DURATION = { success: 4000, info: 5000, warning: 6000, error: 7000 };

/** Muestra una notificación. type: 'success' | 'info' | 'warning' | 'error' */
export function notify({ type = 'info', title, message = '' }) {
  const container = document.getElementById('toasts');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', type === 'error' || type === 'warning' ? 'alert' : 'status');

  const titleEl = document.createElement('p');
  titleEl.className = 'toast__title';
  titleEl.textContent = title;

  const close = document.createElement('button');
  close.className = 'toast__close';
  close.type = 'button';
  close.setAttribute('aria-label', 'Cerrar notificación');
  close.textContent = '×';

  toast.append(titleEl, close);

  if (message) {
    const messageEl = document.createElement('p');
    messageEl.className = 'toast__message';
    messageEl.textContent = message;
    toast.append(messageEl);
  }

  const dismiss = () => {
    toast.dataset.leaving = 'true';
    setTimeout(() => toast.remove(), 200);
  };
  close.addEventListener('click', dismiss);
  setTimeout(dismiss, DURATION[type] || DURATION.info);

  container.append(toast);
}

/** Guarda una notificación para mostrarla en la página siguiente (tras una redirección). */
export function flash(notification) {
  try {
    sessionStorage.setItem(FLASH_KEY, JSON.stringify(notification));
  } catch {
    // Si el almacenamiento no está disponible, se omite el aviso.
  }
}

export function showPendingFlash() {
  try {
    const raw = sessionStorage.getItem(FLASH_KEY);
    if (!raw) return;
    sessionStorage.removeItem(FLASH_KEY);
    notify(JSON.parse(raw));
  } catch {
    // Contenido inválido: se ignora.
  }
}
