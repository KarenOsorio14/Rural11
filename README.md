# Ruta11

PWA educativa para preparar las Ciencias Sociales del ICFES Saber 11. Incluye una ruta de
aprendizaje por temas, cuestionarios con lecturas, práctica libre y simulacros completos.

## Funcionalidades

- **Ruta:** mapa de avance por los cuatro temas (Historia, Geografía, Constitución y Sociedad).
- **Práctica:** cuestionarios por tema con preguntas de análisis y lectura.
- **Práctica libre:** sesiones de 5, 10, 15 o 20 preguntas mezcladas.
- **Practica tus conocimientos:** sesión continua de 20 preguntas de selección múltiple
  tipo ICFES, con dificultad creciente, retroalimentación inmediata, ejemplo similar
  correcto y progreso guardado.
- **Simulacros ICFES:** pruebas completas de 25 preguntas y 50 minutos, con temporizador,
  mapa de preguntas, pausa con progreso guardado, reanudación, puntaje por área, clave de
  respuestas y revisión de respuestas.
- **Perfil:** estadísticas, historial, racha, puntos y sesión.

Los datos de usuario se guardan localmente en IndexedDB.

## Ejecutar

Requiere Node.js 18 o superior.

```bash
npm install
npm start
```

Abre `http://localhost:3000`.

## Correo de verificación (HU-00)

Al registrarse, la app manda un correo con un enlace (vale 48 horas) desde la función
`netlify/functions/verificacion.js`. El enlace abre `verificar.html`, que marca la cuenta como
verificada **en el navegador donde se registró el estudiante** (las cuentas viven en IndexedDB).
Desde el Perfil se puede reenviar el correo. Iniciar sesión no exige tener el correo verificado.

Para que funcione en Netlify hay que crear estas variables en
*Site configuration > Environment variables* y volver a desplegar:

| Variable | Qué es |
| --- | --- |
| `VERIFY_SECRET` | Texto largo y aleatorio (mínimo 16 caracteres). Firma los enlaces. |
| `GMAIL_USER` | Cuenta de Gmail desde la que salen los correos. |
| `GMAIL_APP_PASSWORD` | «Contraseña de aplicación» de esa cuenta (Cuenta de Google > Seguridad > Verificación en dos pasos > Contraseñas de aplicaciones). No es la contraseña normal. |
| `SITE_URL` | Opcional. Dirección pública de la app, por ejemplo `https://rural11.netlify.app`. |

Sin estas variables el registro sigue funcionando y la app avisa que el correo no se pudo enviar.
En local (`npm start`) la función no existe, así que el envío siempre aparece como no disponible.
