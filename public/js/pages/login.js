'use strict';
// Modo estricto.

import '../core/pwa.js';
// Importado solo por su efecto secundario (registro del service worker).
import { notify, flash, showPendingFlash } from '../core/notifications.js';
// Utilidades de notificaciones.
import { friendlyMessage, AppError } from '../core/errors.js';
// friendlyMessage: mensaje seguro para errores desconocidos. AppError: clase de error de dominio.
import { setInvalid, clearInvalid, setLoading, bindPasswordToggle } from '../core/form.js';
// Utilidades de formularios: marcar/limpiar campos inválidos, estado de carga del botón,
// y alternar visibilidad de contraseña.
import {
  login,
  getSession,
  getLockoutStatus,
  getRememberedIdentity
} from '../modules/auth/auth.service.js';
// Funciones del servicio de autenticación necesarias en esta página.

const form = document.getElementById('login-form');
// El formulario de login completo.
const documentInput = document.getElementById('documentNumber');
// Campo de número de documento.
const passwordInput = document.getElementById('password');
// Campo de contraseña.
const rememberInput = document.getElementById('remember');
// Checkbox "Recordarme".
const submitButton = document.getElementById('submit');
// Botón de enviar el formulario.
const formError = document.getElementById('form-error');
// Elemento para mostrar un error general del formulario (no ligado a un campo específico).
const documentError = document.getElementById('document-error');
// Elemento para mostrar el error específico del campo documento.
const passwordError = document.getElementById('password-error');
// Elemento para mostrar el error específico del campo contraseña.

let lockoutTimer = null;
// Referencia al intervalo (setInterval) que actualiza la cuenta regresiva del bloqueo,
// para poder cancelarlo cuando ya no se necesite.

bindPasswordToggle(document.getElementById('toggle-password'), [passwordInput]);
// Conecta el botón "Mostrar/Ocultar" al campo de contraseña.
showPendingFlash();
// Muestra cualquier mensaje flash pendiente (por ejemplo, al llegar desde logout o registro).

// -------------------------------------------------------------
// Control de Bloqueo Temporal (HU_01)
// -------------------------------------------------------------
function checkLockout() {
  // Revisa si el login está bloqueado y, si lo está, muestra una cuenta regresiva en vivo.
  const lock = getLockoutStatus();
  // Consulta el estado actual de bloqueo.
  if (lock.isLocked) {
    // Si está bloqueado...
    submitButton.disabled = true;
    // Deshabilita el botón de enviar para que no se pueda intentar login.
    showFormError(`Acceso bloqueado por intentos fallidos. Espera ${lock.remainingSeconds} segundos.`);
    // Muestra el mensaje de error con los segundos restantes.

    if (lockoutTimer) clearInterval(lockoutTimer);
    // Si ya había un temporizador corriendo (por ejemplo, de una llamada anterior), lo cancela
    // para no tener varios intervalos duplicados actualizando el mensaje.
    lockoutTimer = setInterval(() => {
      // Crea un intervalo que se ejecuta cada segundo para actualizar la cuenta regresiva.
      const currentLock = getLockoutStatus();
      // Vuelve a consultar el estado de bloqueo en cada "tick".
      if (!currentLock.isLocked) {
        // Si ya se desbloqueó (pasó el tiempo)...
        clearInterval(lockoutTimer);
        // Detiene el intervalo.
        lockoutTimer = null;
        // Limpia la referencia.
        submitButton.disabled = false;
        // Vuelve a habilitar el botón de enviar.
        clearErrors();
        // Limpia el mensaje de error mostrado.
      } else {
        showFormError(`Acceso bloqueado por intentos fallidos. Espera ${currentLock.remainingSeconds} segundos.`);
        // Si sigue bloqueado, actualiza el mensaje con los segundos restantes (cuenta regresiva).
      }
    }, 1000);
    // Se ejecuta cada 1000 ms (1 segundo).
  } else {
    submitButton.disabled = false;
    // Si no está bloqueado, se asegura de que el botón esté habilitado.
  }
}

// -------------------------------------------------------------
// Inicialización: Sesión previa y "Recordar credenciales" (Escenario 5)
// -------------------------------------------------------------
async function init() {
  // Función de arranque de la página de login.
  checkLockout();
  // Verifica de entrada si hay un bloqueo activo (por ejemplo, si el usuario recargó la página).

  try {
    const session = await getSession();
    // Consulta si ya hay una sesión activa.

    if (session.status === 'active') {
      // Si ya está logueado...
      location.replace('/');
      // Redirige directamente a la página principal (no tiene sentido mostrar el login).
      return;
      // Corta la ejecución.
    }
  } catch {}
  // Si getSession() falla, se ignora silenciosamente y se continúa mostrando el formulario de login.

  // Limpiar siempre la contraseña al cargar la página
  passwordInput.value = '';
  // Por seguridad, nunca se deja una contraseña precargada en el campo (aunque el navegador
  // podría autocompletar, esto la limpia explícitamente al iniciar).

  // Recuperar únicamente el documento si fue recordado
  const rememberedDoc = getRememberedIdentity();
  // Consulta si hay un número de documento guardado de una sesión anterior con "recordarme".

  if (rememberedDoc) {
    // Si hay un documento recordado...
    documentInput.value = rememberedDoc;
    // Precarga el campo de documento con ese valor.
    rememberInput.checked = true;
    // Marca el checkbox "Recordarme" como activado.
    passwordInput.focus();
    // Pone el foco directamente en el campo de contraseña (ya que el documento ya está lleno).
  } else {
    documentInput.value = '';
    // Si no hay nada recordado, se asegura de que el campo esté vacío.
    rememberInput.checked = false;
    // Y el checkbox desmarcado.
    documentInput.focus();
    // Pone el foco en el campo de documento (primer campo a llenar).
  }
}

// -------------------------------------------------------------
// Manejo de Errores Visuales
// -------------------------------------------------------------
function showFormError(message) {
  // Muestra un mensaje de error general (no asociado a un campo puntual).
  formError.textContent = message;
  // Establece el texto del mensaje.
  formError.hidden = false;
  // Lo hace visible (estaba oculto por defecto vía el atributo "hidden").
}

function showFieldError(fieldEl, errorEl, message) {
  // Marca un campo específico como inválido y muestra su mensaje de error asociado.
  setInvalid(fieldEl);
  // Utilidad del core: agrega estilos/atributos de "campo inválido" al elemento.
  if (errorEl) {
    // Si existe el elemento donde mostrar el mensaje de error de ese campo...
    errorEl.textContent = message;
    errorEl.hidden = false;
  }
}

function clearErrors() {
  // Limpia TODOS los mensajes de error visibles y el estado "inválido" de los campos.
  formError.hidden = true;
  formError.textContent = '';
  // Oculta y vacía el error general.

  if (documentError) {
    documentError.hidden = true;
    documentError.textContent = '';
  }
  // Oculta y vacía el error del campo documento (si existe el elemento).
  if (passwordError) {
    passwordError.hidden = true;
    passwordError.textContent = '';
  }
  // Oculta y vacía el error del campo contraseña (si existe el elemento).

  clearInvalid(documentInput, passwordInput);
  // Utilidad del core: quita el estado "inválido" visual de ambos campos a la vez.
}

function handleLoginError(error) {
  // Maneja de forma centralizada los distintos tipos de error que puede lanzar login().
  checkLockout();
  // Siempre re-chequea el estado de bloqueo, porque este intento fallido pudo haber activado uno nuevo.

  // Escenario 2 y 4: Credenciales incorrectas
  if (error instanceof AppError && error.code === 'INVALID_CREDENTIALS') {
  // Si el error es específicamente de credenciales incorrectas...
  setInvalid(documentInput);
  setInvalid(passwordInput);
  // Marca ambos campos como inválidos (no se especifica cuál falló exactamente, por seguridad:
  // así no se revela si el documento existe o si fue la contraseña la que falló).

  passwordInput.value = '';
  // Limpia la contraseña ingresada por seguridad/usabilidad.

  if (!rememberInput.checked) {
    // Si el usuario NO marcó "recordarme"...
    documentInput.value = '';
    // También limpia el campo de documento (para que reintente desde cero).
  }
  // Si SÍ marcó "recordarme", se deja el documento tal como está, para no obligarlo a
  // reescribirlo en cada intento.

  showFormError('Credenciales incorrectas.');
  // Muestra el mensaje de error general.

  notify({
    type: 'error',
    title: 'Credenciales incorrectas',
    message: 'El número de identidad o la contraseña no coinciden.',
  });
  // Además del mensaje inline, muestra una notificación tipo toast.

  passwordInput.focus();
  // Devuelve el foco al campo de contraseña para facilitar el reintento.

  return;
  // Corta aquí, no sigue evaluando los demás casos de error.
}

  // Escenario 3: Validación de campos obligatorios y formato numérico
  if (error instanceof AppError && error.code === 'VALIDATION') {
    // Si el error es de validación de algún campo específico...
    if (error.field === 'documentNumber') {
      // Si el campo afectado es el documento...
      showFieldError(documentInput, documentError, error.message);
      documentInput.focus();
    } else if (error.field === 'password') {
      // Si el campo afectado es la contraseña...
      showFieldError(passwordInput, passwordError, error.message);
      passwordInput.focus();
    } else {
      // Si el error de validación no está ligado a un campo concreto...
      showFormError(error.message);
    }
    notify({ type: 'warning', title: 'Verifica los datos', message: error.message });
    // Notificación adicional tipo advertencia.
    return;
  }

  if (error instanceof AppError && error.code === 'ACCOUNT_LOCKED') {
    // Si el error es porque la cuenta está bloqueada (justo se acaba de activar el bloqueo)...
    showFormError(error.message);
    notify({ type: 'error', title: 'Acceso bloqueado', message: error.message });
    return;
  }

  notify({ type: 'error', title: 'Error al iniciar sesión', message: friendlyMessage(error) });
  // Caso genérico: cualquier otro error no contemplado arriba (por ejemplo, errores técnicos
  // inesperados) se muestra con un mensaje seguro mediante friendlyMessage().
}

// -------------------------------------------------------------
// Envío del Formulario (Escenario 1)
// -------------------------------------------------------------
form.addEventListener('submit', async (event) => {
  // Maneja el envío del formulario de login.
  event.preventDefault();
  // Evita el envío tradicional del navegador (que recargaría la página).
  clearErrors();
  // Limpia cualquier error visual de un intento anterior antes de validar de nuevo.

  const docVal = documentInput.value.trim();
  // Lee y limpia (trim) el valor del campo documento.
  const passVal = passwordInput.value;
  // Lee el valor de la contraseña (sin trim, para no alterar contraseñas con espacios intencionales).

  // Validación local inmediata antes de llamar al servicio
  let hasLocalError = false;
  // Bandera que indica si se encontró algún error de validación en el propio navegador
  // (antes de siquiera llamar a login(), para dar feedback más rápido).
  if (!docVal) {
    // Si el documento está vacío...
    showFieldError(documentInput, documentError, 'Campo obligatorio.');
    hasLocalError = true;
  } else if (!/^\d+$/.test(docVal)) {
    // Si no está vacío pero contiene algo que no sea solo dígitos...
    showFieldError(documentInput, documentError, 'El número de identidad solo debe contener números.');
    hasLocalError = true;
  }

  if (!passVal) {
    // Si la contraseña está vacía...
    showFieldError(passwordInput, passwordError, 'Campo obligatorio.');
    hasLocalError = true;
  }

  if (hasLocalError) {
    // Si se encontró cualquier error local...
    return;
    // Se detiene aquí, sin siquiera llamar al servicio de login (evita una llamada innecesaria
    // y no gasta un "intento fallido" del sistema de bloqueo por errores de formato).
  }

  setLoading(submitButton, true, 'Iniciar sesión', 'Iniciando sesión…');
  // Pone el botón en estado de carga (deshabilitado, con texto "Iniciando sesión…").
  try {
    const user = await login({
      documentNumber: docVal,
      password: passVal,
      remember: rememberInput.checked,
    });
    // Llama al servicio de autenticación con los datos del formulario.

    flash({ type: 'success', title: 'Sesión iniciada', message: `Bienvenido, ${user.name}.` });
    // Prepara un mensaje de bienvenida que se mostrará en la siguiente página (home).
    location.replace('/');
    // Redirige a la página principal.
  } catch (error) {
    handleLoginError(error);
    // Si login() lanza un error, se delega su manejo a la función especializada de arriba.
    setLoading(submitButton, false, 'Iniciar sesión', 'Iniciando sesión…');
    // Devuelve el botón a su estado normal (habilitado, texto original) para permitir reintentar.
  }
});

init();
// Ejecuta la inicialización al cargar el script.