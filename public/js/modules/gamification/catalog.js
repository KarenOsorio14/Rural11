'use strict';
// Catálogo de insignias (HU_21) y recompensas virtuales (HU_22) de Rural 11.
// Cada objetivo se evalúa con las estadísticas reales del estudiante (ver stats.js).
// Una insignia o recompensa se identifica por su `id`; las reutilizables generan una
// clave distinta cada vez que se repite el objetivo (ver `occurrences`).

export const BADGES = [
  { id: 'primer-paso', name: 'Primer paso', image: '/img/grano/hola.webp', description: 'Completa tu primera actividad de práctica.',
    goal: 'Completar 1 actividad', progress: (s) => [s.attempts, 1] },
  { id: 'primera-aprobacion', name: 'Aprobado', image: '/img/grano/alegre.webp', description: 'Aprueba una actividad con 60% o más.',
    goal: 'Aprobar 1 actividad', progress: (s) => [s.passed, 1] },
  { id: 'puntaje-perfecto', name: 'Puntaje perfecto', image: '/img/grano/i-brillo.webp', description: 'Obtén 100% en una actividad.',
    goal: 'Lograr 100% en una actividad', progress: (s) => [s.perfect, 1] },
  { id: 'cien-aciertos', name: 'Cien aciertos', image: '/img/grano/i-grano.webp', description: 'Acumula 100 respuestas correctas.',
    goal: '100 respuestas correctas', progress: (s) => [s.correct, 100] },
  { id: 'explorador-social', name: 'Explorador social', image: '/img/grano/i-brujula.webp', description: 'Aprueba un cuestionario de cada uno de los 4 temas.',
    goal: 'Aprobar los 4 temas', progress: (s) => [s.topicsPassed, 4] },
  { id: 'racha-3', name: 'Constante', image: '/img/grano/cafe.webp', description: 'Practica 3 días seguidos.',
    goal: 'Racha de 3 días', progress: (s) => [s.bestStreak, 3] },
  { id: 'racha-7', name: 'Imparable', image: '/img/grano/genial.webp', description: 'Practica 7 días seguidos.',
    goal: 'Racha de 7 días', progress: (s) => [s.bestStreak, 7] },
  { id: 'primer-simulacro', name: 'Simulacro completado', image: '/img/grano/estudia.webp', description: 'Termina un simulacro ICFES completo.',
    goal: 'Completar 1 simulacro', progress: (s) => [s.simulacros, 1] },
  { id: 'simulacro-aprobado', name: 'Listo para el ICFES', image: '/img/grano/i-birrete.webp', description: 'Aprueba un simulacro ICFES.',
    goal: 'Aprobar 1 simulacro', progress: (s) => [s.simulacrosPassed, 1] },
  { id: 'nivel-avanzado', name: 'Nivel avanzado', image: '/img/grano/explorador.webp', description: 'Llega al nivel Avanzado en "Practica tus conocimientos".',
    goal: 'Alcanzar nivel 3 en preguntas seguidas', progress: (s) => [s.seguidasLevel, 3] }
];

// Recompensas virtuales: imágenes de Grano ya incluidas en la app.
// `points` usa el sistema de puntos HU_20. `reusable` + `step`: se vuelve a ganar cada
// `step` puntos adicionales (cada vez con una clave nueva, sin duplicar ninguna).
export const REWARDS = [
  { id: 'grano-estudia', name: 'Grano estudioso', image: '/img/grano/3d/estudia.webp', description: 'Grano te acompaña a estudiar.',
    goal: 'Llegar a 100 puntos', progress: (s) => [s.points, 100] },
  { id: 'grano-idea', name: 'Grano con ideas', image: '/img/grano/3d/idea.webp', description: 'Una idea brillante en tu colección.',
    goal: 'Llegar a 300 puntos', progress: (s) => [s.points, 300] },
  { id: 'grano-celebra', name: 'Grano celebra', image: '/img/grano/3d/celebra.webp', description: 'Celebra tres actividades aprobadas.',
    goal: 'Aprobar 3 actividades', progress: (s) => [s.passed, 3] },
  { id: 'grano-geografo', name: 'Grano geógrafo', image: '/img/grano/3d/geografo.webp', description: 'Disfraz de geógrafo por dominar un tema.',
    goal: 'Aprobar un cuestionario de Geografía', progress: (s) => [s.topicPassedCount.Geografía || 0, 1] },
  { id: 'grano-historiador', name: 'Grano historiador', image: '/img/grano/3d/historiador.webp', description: 'Disfraz de historiador por dominar un tema.',
    goal: 'Aprobar un cuestionario de Historia', progress: (s) => [s.topicPassedCount.Historia || 0, 1] },
  { id: 'grano-abogado', name: 'Grano abogado', image: '/img/grano/3d/abogado.webp', description: 'Disfraz de abogado por conocer la Constitución.',
    goal: 'Aprobar un cuestionario de Constitución y Ciudadanía', progress: (s) => [s.topicPassedCount['Constitución y Ciudadanía'] || 0, 1] },
  { id: 'grano-cultura', name: 'Grano cultural', image: '/img/grano/3d/cultura.webp', description: 'Disfraz cultural por dominar Sociedad y Cultura.',
    goal: 'Aprobar un cuestionario de Sociedad y Cultura', progress: (s) => [s.topicPassedCount['Sociedad y Cultura'] || 0, 1] },
  { id: 'grano-medalla', name: 'Grano con medalla', image: '/img/grano/3d/medalla.webp', description: 'Medalla por aprobar un simulacro ICFES.',
    goal: 'Aprobar 1 simulacro', progress: (s) => [s.simulacrosPassed, 1] },
  { id: 'estrella-puntos', name: 'Estrella de puntos', image: '/img/grano/3d/estrella.webp', reusable: true, step: 500,
    description: 'Se vuelve a ganar cada 500 puntos.',
    goal: 'Cada 500 puntos', progress: (s) => [s.points % 500, 500] }
];

/**
 * Cuántas veces se cumple el objetivo de una recompensa.
 * No reutilizable: 0 o 1. Reutilizable: una vez por cada `step` de puntos.
 */
export function occurrences(def, stats) {
  if (def.reusable) return Math.floor(stats.points / def.step);
  const [value, target] = def.progress(stats);
  return value >= target ? 1 : 0;
}
