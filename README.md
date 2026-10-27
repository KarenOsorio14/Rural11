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
