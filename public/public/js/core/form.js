/** Marca un campo como inválido y, si existe #<id>-error, muestra ahí el mensaje. */
export function setInvalid(input, message = '') {
  input.closest('.field__control').dataset.invalid = 'true';
  input.setAttribute('aria-invalid', 'true');

  const errorEl = document.getElementById(`${input.id}-error`);
  if (errorEl && message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
  }
}

export function clearInvalid(...inputs) {
  for (const input of inputs) {
    input.closest('.field__control').dataset.invalid = 'false';
    input.removeAttribute('aria-invalid');

    const errorEl = document.getElementById(`${input.id}-error`);
    if (errorEl) {
      errorEl.hidden = true;
      errorEl.textContent = '';
    }
  }
}

export function setLoading(button, loading, idleText, busyText) {
  button.disabled = loading;
  button.textContent = loading ? busyText : idleText;
}

/** Botón "Mostrar/Ocultar" que alterna la visibilidad de uno o más campos de contraseña. */
export function bindPasswordToggle(button, inputs) {
  button.addEventListener('click', () => {
    const show = inputs[0].type === 'password';
    for (const input of inputs) input.type = show ? 'text' : 'password';
    button.textContent = show ? 'Ocultar' : 'Mostrar';
    button.setAttribute('aria-pressed', String(show));
  });
}
