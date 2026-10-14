'use strict';
// Restablecer contraseña: pide documento, correo y la nueva contraseña (con confirmación).
// El proceso real por correo llegará con la API; por ahora se valida que documento y correo sean de la misma cuenta.

import '../core/pwa.js';
import { notify, flash } from '../core/notifications.js';
import { friendlyMessage, AppError } from '../core/errors.js';
import { setInvalid, clearInvalid, setLoading, bindPasswordToggle } from '../core/form.js';
import { resetPassword } from '../modules/auth/auth.service.js';

const form = document.getElementById('reset-form');
const submitButton = document.getElementById('submit');

const fields = {
  documentNumber: document.getElementById('documentNumber'),
  email: document.getElementById('email'),
  newPassword: document.getElementById('newPassword'),
  confirm: document.getElementById('confirm'),
};

bindPasswordToggle(document.getElementById('toggle-password'), [fields.newPassword, fields.confirm]);

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearInvalid(...Object.values(fields));

  const values = Object.fromEntries(Object.entries(fields).map(([key, input]) => [key, input.value]));

  // Campos vacíos: se marcan todos a la vez y el foco va al primero.
  const empty = Object.keys(fields).filter((key) => !values[key].trim());
  if (empty.length) {
    for (const key of empty) setInvalid(fields[key], 'Campo obligatorio.');
    fields[empty[0]].focus();
    return;
  }

  if (values.newPassword !== values.confirm) {
    setInvalid(fields.confirm, 'Las contraseñas no coinciden.');
    fields.confirm.focus();
    return;
  }

  setLoading(submitButton, true, 'Restablecer contraseña', 'Guardando…');
  try {
    await resetPassword({
      documentNumber: values.documentNumber,
      email: values.email,
      newPassword: values.newPassword,
    });

    flash({
      type: 'success',
      title: 'Contraseña actualizada',
      message: 'Ya puedes iniciar sesión con tu nueva contraseña.',
    });
    location.replace('/login.html');
  } catch (error) {
    setLoading(submitButton, false, 'Restablecer contraseña', 'Guardando…');

    if (error instanceof AppError && error.code === 'VALIDATION' && fields[error.field]) {
      setInvalid(fields[error.field], error.message);
      fields[error.field].focus();
      return;
    }

    // Un intento que no coincide limpia las contraseñas para que se vuelvan a escribir.
    fields.newPassword.value = '';
    fields.confirm.value = '';
    notify({
      type: 'error',
      title: error instanceof AppError && error.code === 'NO_MATCH' ? 'No encontramos la cuenta' : 'No se pudo restablecer',
      message: friendlyMessage(error),
    });
  }
});
