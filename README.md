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

## Despliegue en Cloudflare

La app se publica como Worker de Cloudflare (`rural11`), conectado a la rama `main` de GitHub:
cada mezcla a `main` se despliega sola con `npx wrangler deploy`. La configuración está en
`wrangler.jsonc`: los archivos de `public/` se sirven tal cual y `worker/index.js` solo atiende
`/api/verificacion`. Las cabeceras de seguridad están en `public/_headers`.

Para probarlo en local como en Cloudflare: `npx wrangler dev` (las variables van en un archivo
`.dev.vars`, que no se sube a GitHub).

## Correo de verificación (HU-00)

Al registrarse, la app manda un correo con un enlace (vale 48 horas) desde `worker/verificacion.js`.
El enlace abre `verificar.html`, que marca la cuenta como verificada **en el navegador donde se
registró el estudiante** (las cuentas viven en IndexedDB). Desde el Perfil se puede reenviar el
correo. Iniciar sesión no exige tener el correo verificado. El correo sale por la API de Brevo
(plan gratis, 300 correos al día).

Para que funcione hay que crear estas variables en Cloudflare, en
*Workers y Pages > rural11 > Configuración > Variables y secretos*, con tipo **Secreto**:

| Variable | Qué es |
| --- | --- |
| `VERIFY_SECRET` | Texto largo y aleatorio (mínimo 16 caracteres). Firma los enlaces. |
| `BREVO_API_KEY` | Clave de API de Brevo (SMTP y API > Claves de API). |
| `MAIL_FROM` | Correo remitente, verificado como remitente en Brevo. |
| `MAIL_FROM_NAME` | Opcional. Nombre que ve el estudiante (por defecto «Rural 11»). |
| `SITE_URL` | Opcional. Dirección pública de la app. |

Sin estas variables el registro sigue funcionando y la app avisa que el correo no se pudo enviar.
