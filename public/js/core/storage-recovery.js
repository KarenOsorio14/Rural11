import { openDb, resetLocalDatabase } from './db.js';

const STORAGE_ERRORS = new Set(['DB_UNAVAILABLE', 'DB_BLOCKED']);

let overlay = null;

/** Indica si el error viene de IndexedDB y merece la pantalla de recuperación. */
export function isStorageError(error) {
  return Boolean(error && STORAGE_ERRORS.has(error.code));
}

function clearAppStorage() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('pwa:')) localStorage.removeItem(key);
    }
  } catch {
    // Si localStorage también está bloqueado, no hay nada más que limpiar.
  }

  try {
    sessionStorage.removeItem('pwa:flash');
  } catch {
    // Se ignora: no es imprescindible para recuperar la app.
  }
}

function buildOverlay(error) {
  const wrapper = document.createElement('div');
  wrapper.className = 'storage-recovery';
  wrapper.setAttribute('role', 'alertdialog');
  wrapper.setAttribute('aria-modal', 'true');
  wrapper.setAttribute('aria-labelledby', 'storage-recovery-title');
  wrapper.setAttribute('aria-describedby', 'storage-recovery-message');

  const card = document.createElement('div');
  card.className = 'storage-recovery__card';

  const title = document.createElement('h2');
  title.id = 'storage-recovery-title';
  title.className = 'storage-recovery__title';
  title.textContent = 'No se pudo abrir el almacenamiento local';

  const message = document.createElement('p');
  message.id = 'storage-recovery-message';
  message.className = 'storage-recovery__message';
  message.textContent = error && error.message
    ? error.message
    : 'El navegador no permitió acceder a los datos locales de la aplicación.';

  const help = document.createElement('p');
  help.className = 'storage-recovery__help';
  help.textContent = error && error.code === 'DB_BLOCKED'
    ? 'Cierra las demás pestañas de Rural 11, vuelve a esta y pulsa «Reintentar».'
    : 'Esto puede ocurrir en una ventana privada, si el navegador bloquea los datos del sitio o si la información local quedó dañada.';

  const status = document.createElement('p');
  status.className = 'storage-recovery__status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.hidden = true;

  const actions = document.createElement('div');
  actions.className = 'storage-recovery__actions';

  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'btn btn--primary';
  retry.textContent = 'Reintentar';

  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'btn btn--ghost';
  reset.textContent = 'Restablecer datos locales';

  const showStatus = (text, isError = false) => {
    status.textContent = text;
    status.hidden = false;
    status.dataset.error = isError ? 'true' : 'false';
  };

  retry.addEventListener('click', async () => {
    retry.disabled = true;
    reset.disabled = true;
    retry.textContent = 'Reintentando…';
    showStatus('Comprobando el almacenamiento local…');

    try {
      await openDb();
      showStatus('El almacenamiento ya está disponible. Recargando…');
      location.reload();
    } catch (nextError) {
      retry.disabled = false;
      reset.disabled = false;
      retry.textContent = 'Reintentar';
      showStatus(
        nextError && nextError.code === 'DB_BLOCKED'
          ? 'Sigue bloqueado. Cierra las otras pestañas de Rural 11 y vuelve a intentarlo.'
          : 'No se pudo abrir el almacenamiento. Puedes restablecer los datos locales para empezar de nuevo.',
        true
      );
    }
  });

  reset.addEventListener('click', async () => {
    const confirmed = window.confirm(
      'Se borrarán las cuentas, la sesión y el historial guardados en este navegador. Esta acción no se puede deshacer. ¿Quieres continuar?'
    );
    if (!confirmed) return;

    retry.disabled = true;
    reset.disabled = true;
    reset.textContent = 'Restableciendo…';
    showStatus('Borrando los datos locales…');

    try {
      await resetLocalDatabase();
      clearAppStorage();
      location.replace('/bienvenida.html');
    } catch (nextError) {
      retry.disabled = false;
      reset.disabled = false;
      reset.textContent = 'Restablecer datos locales';
      showStatus(
        nextError && nextError.code === 'DB_BLOCKED'
          ? 'No se pudo borrar porque otra pestaña está usando los datos. Cierra las demás pestañas e inténtalo de nuevo.'
          : 'No se pudieron restablecer los datos locales. Cierra el navegador y vuelve a abrirlo.',
        true
      );
    }
  });

  actions.append(retry, reset);
  card.append(title, message, help, status, actions);
  wrapper.append(card);

  return { wrapper, retry };
}

/**
 * Muestra una pantalla de recuperación cuando IndexedDB no está disponible.
 * Devuelve true si el error era de almacenamiento (para que la página no muestre
 * un aviso genérico encima).
 */
export function showStorageRecovery(error) {
  if (!isStorageError(error)) return false;

  // La pantalla se muestra una sola vez, aunque varias operaciones fallen.
  if (overlay) return true;

  try {
    overlay = buildOverlay(error);
    const host = document.body || document.documentElement;
    host.append(overlay.wrapper);
    overlay.retry.focus();
  } catch (renderError) {
    console.error('[storage-recovery] No se pudo mostrar la pantalla de recuperación:', renderError);
    // Si ni siquiera se puede construir la pantalla, al menos el mensaje queda
    // en la notificación genérica de la página.
    overlay = null;
    return false;
  }

  return true;
}
