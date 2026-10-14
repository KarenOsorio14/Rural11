/** Error esperado de la aplicación: lleva un código, un mensaje para el usuario y, opcionalmente, el campo afectado. */
export class AppError extends Error {
  constructor(code, message, field = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.field = field;
  }
}

/** Mensaje seguro para mostrar: los errores inesperados no exponen detalles técnicos. */
export function friendlyMessage(error) {
  if (error instanceof AppError) return error.message;
  console.error(error);
  return 'Ocurrió un error inesperado. Inténtalo de nuevo.';
}
