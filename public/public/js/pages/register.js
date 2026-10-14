'use strict';
// Modo estricto.

import '../core/pwa.js';
// Importado solo por su efecto secundario (registro del service worker).
import { notify, flash } from '../core/notifications.js';
// Utilidades de notificaciones (aquí no se usa showPendingFlash porque esta página no
// necesita mostrar mensajes pendientes de páginas anteriores).
import { friendlyMessage, AppError } from '../core/errors.js';
// Utilidades de manejo de errores.
import { setInvalid, clearInvalid, setLoading, bindPasswordToggle } from '../core/form.js';
// Utilidades de formularios.
import { register, getSession } from '../modules/auth/auth.service.js';
// Funciones del servicio de autenticación necesarias para el registro.

const form = document.getElementById('register-form');
// El formulario de registro.

const fields = {
  // Objeto que agrupa todos los campos del formulario por nombre lógico,
  // para poder iterarlos genéricamente más abajo (Object.values, Object.entries).
  name: document.getElementById('name'),
  documentNumber: document.getElementById('documentNumber'),
  email: document.getElementById('email'),
  password: document.getElementById('password'),
  confirm: document.getElementById('confirm'),
  // Campo de "confirmar contraseña" (no existe como tal en el backend, solo se usa
  // para validar en el cliente que coincide con "password").
};

const submitButton = document.getElementById('submit');
// Botón de enviar el formulario.

bindPasswordToggle(
  document.getElementById('toggle-password'),
  [fields.password, fields.confirm]
);
// Conecta el botón "Mostrar/Ocultar" a AMBOS campos de contraseña a la vez
// (password y confirm cambian de tipo juntos).

// Quien ya tiene sesión no necesita registrarse.
getSession()
  .then((result) => {
    // Consulta si ya hay sesión activa al cargar la página.
    if (result.status === 'active') {
      // Si ya está logueado...
      location.replace('/');
      // Redirige a la página principal (no tiene sentido mostrarle el formulario de registro).
    }
  })
  .catch(() => {});
  // Si falla la consulta de sesión, se ignora silenciosamente y se deja ver el formulario.

function showFieldError(error) {
  // Muestra el error de un AppError en el campo correspondiente, según error.field.
  const input = fields[error.field];
  // Busca en el objeto "fields" el input cuyo nombre coincida con error.field
  // (por ejemplo, error.field === 'documentNumber' -> fields.documentNumber).

  if (!input) return false;
  // Si no se encontró un campo asociado (error genérico sin campo específico), no hace nada
  // y devuelve false para que el llamador sepa que no se manejó visualmente.

  setInvalid(input, error.message);
  // Marca el campo como inválido y muestra el mensaje de error asociado a ese input.
  input.focus();
  // Pone el foco en el campo con error.

  return true;
  // Indica que sí se manejó visualmente el error.
}

form.addEventListener('submit', async (event) => {
  // Maneja el envío del formulario de registro.
  event.preventDefault();
  // Evita el envío tradicional (recarga de página).

  clearInvalid(...Object.values(fields));
  // Limpia el estado "inválido" de TODOS los campos antes de validar de nuevo
  // (usa spread para pasar cada input como argumento individual a clearInvalid).

  const values = Object.fromEntries(
    Object.entries(fields).map(([key, input]) => [key, input.value])
  );
  // Construye un objeto plano { name: '...', documentNumber: '...', password: '...', confirm: '...' }
  // leyendo el valor actual de cada input. Object.entries+map+Object.fromEntries es un patrón
  // para "transformar" un objeto de elementos DOM en un objeto de valores de texto.

  // Validación de confirmación de contraseña
  // Validar campos obligatorios
let hasEmptyFields = false;

const requiredFields = [
  ['name', 'name'],
  ['documentNumber', 'documentNumber'],
  ['email', 'email'],
  ['password', 'password'],
  ['confirm', 'confirm'],
];

for (const [key, fieldName] of requiredFields) {
  if (!values[key].trim()) {
    setInvalid(fields[fieldName], 'Campo obligatorio');
    hasEmptyFields = true;
  }
}

// Si hay campos vacíos, no continuar
if (hasEmptyFields) {
  const firstEmpty = requiredFields.find(
    ([key]) => !values[key].trim()
  );

  if (firstEmpty) {
    fields[firstEmpty[1]].focus();
  }

  return;
}

// Validar que las contraseñas coincidan
if (values.password !== values.confirm) {
  showFieldError(
    new AppError(
      'VALIDATION',
      'Las contraseñas no coinciden',
      'confirm'
    )
  );
  return;
}

  setLoading(
    submitButton,
    true,
    'Crear cuenta',
    'Creando cuenta…'
  );
  // Pone el botón en estado de carga.

  try {
    await register({
      documentNumber: values.documentNumber,
      email: values.email,
      name: values.name,
      password: values.password,
    });
    // Llama al servicio de registro con los datos del formulario (nótese que "confirm"
    // NO se envía, ya cumplió su propósito de validación local).

    flash({
      type: 'success',
      title: 'Cuenta creada',
      message: 'Ahora inicia sesión con tu número de identidad y tu contraseña.',
    });
    // Prepara un mensaje de éxito para mostrarlo en la página de login.

    location.replace('/login.html');
    // Redirige al login tras el registro exitoso.

  } catch (error) {
    setLoading(
      submitButton,
      false,
      'Crear cuenta',
      'Creando cuenta…'
    );
    // Devuelve el botón a su estado normal ante cualquier error.

    if (error instanceof AppError && showFieldError(error)) {
      // Si el error es de dominio (AppError) Y showFieldError logró asociarlo a un campo
      // concreto (devolvió true)...
      notify({
        type: error.code === 'EMAIL_TAKEN'
          ? 'warning'
          : 'error',
        // Tipo de notificación distinto según si es un duplicado (warning, menos grave)
        // o cualquier otro error de validación (error).
        title: error.code === 'EMAIL_TAKEN'
          ? 'Correo o identidad ya registrados'
          : 'Revisa los datos',
        message: error.message,
      });

      return;
      // Corta aquí: ya se manejó visualmente el error específico del campo.
    }

    notify({
      type: 'error',
      title: 'No se pudo crear la cuenta',
      message: friendlyMessage(error),
    });
    // Caso genérico: error no asociado a un campo, o que no es un AppError en absoluto
    // (por ejemplo, un fallo técnico inesperado). Se muestra con mensaje seguro.
  }
});