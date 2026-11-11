// Desempeño del estudiante: estadísticas (HU_28) y temas con menor rendimiento (HU_27).
// Todo se calcula con el historial del estudiante autenticado, así que se actualiza solo
// cada vez que termina una actividad nueva.

import { TOPICS } from '../questionnaires/questionnaires.data.js';

// Cuántas actividades forman un "periodo" para calcular la mejora.
export const PERIODO = 5;
// Cuántas actividades se ven en el gráfico de evolución.
export const PUNTOS_GRAFICO = 12;
// Por debajo de este porcentaje un tema se marca para reforzar (el mismo umbral de aprobación).
export const UMBRAL_REFUERZO = 60;

const TEMA_POR_CATEGORIA = new Map(TOPICS.map((t) => [t.category, t]));
const TEMA_POR_ID = new Map(TOPICS.map((t) => [t.id, t]));
const TEMA_POR_NOMBRE = new Map(TOPICS.map((t) => [t.name, t]));

const fecha = (a) => new Date(a.createdAt || 0).getTime();
const promedio = (lista) => (lista.length ? Math.round(lista.reduce((s, a) => s + (a.percentage || 0), 0) / lista.length) : 0);

function tipoDeActividad(a) {
  if (a.isSimulacro) return 'Simulacro';
  if (a.isSeguida) return 'Practica tus conocimientos';
  if (a.questionnaireId === 'practica-libre') return 'Práctica libre';
  return a.questionnaireTitle || a.category || 'Cuestionario';
}

/** HU_28: promedio, mejor puntaje, simulacros, mejora y evolución en el tiempo. */
export function calcularEstadisticas(historial) {
  const intentos = [...historial].sort((a, b) => fecha(a) - fecha(b));
  const total = intentos.length;

  const recientes = intentos.slice(-PERIODO);
  const anteriores = intentos.slice(-PERIODO * 2, -PERIODO);
  const mejora = anteriores.length
    ? { actual: promedio(recientes), anterior: promedio(anteriores), puntos: promedio(recientes) - promedio(anteriores) }
    : null;

  return {
    total,
    promedio: promedio(intentos),
    mejorPuntaje: total ? Math.max(...intentos.map((a) => a.percentage || 0)) : 0,
    simulacros: intentos.filter((a) => a.isSimulacro).length,
    mejora,
    evolucion: intentos.slice(-PUNTOS_GRAFICO).map((a) => ({
      fecha: new Date(a.createdAt || 0),
      porcentaje: a.percentage || 0,
      actividad: tipoDeActividad(a)
    }))
  };
}

/** Reparte los aciertos de un intento entre los 4 temas. */
function aciertosPorTema(a) {
  const filas = [];
  const sumar = (tema, correctas, total) => {
    if (tema && total > 0) filas.push({ tema, correctas, total });
  };

  if (a.isSimulacro && Array.isArray(a.byTopic)) {
    a.byTopic.forEach((t) => sumar(TEMA_POR_ID.get(t.id), t.correct, t.total));
  } else if (a.isSeguida && Array.isArray(a.byTopic)) {
    a.byTopic.forEach((t) => sumar(TEMA_POR_NOMBRE.get(t.topicName), t.correct, t.total));
  } else if (a.questionnaireId === 'practica-libre') {
    // Desde esta versión cada pregunta guarda su tema; las prácticas viejas de un solo tema
    // se asignan completas y las de varios temas sin ese dato no se pueden repartir.
    const conTema = (a.review || []).filter((r) => r.tema);
    if (conTema.length) {
      conTema.forEach((r) => sumar(TEMA_POR_ID.get(r.tema), r.isCorrect ? 1 : 0, 1));
    } else {
      sumar(TEMA_POR_CATEGORIA.get(a.category), a.correctCount, a.totalQuestions);
    }
  } else {
    sumar(TEMA_POR_CATEGORIA.get(a.category), a.correctCount, a.totalQuestions);
  }
  return filas;
}

/** HU_27: porcentaje de aciertos por tema, de menor a mayor rendimiento. */
export function calcularTemas(historial) {
  const acumulado = new Map(TOPICS.map((t) => [t.id, { tema: t, correctas: 0, total: 0 }]));
  historial.forEach((a) => {
    aciertosPorTema(a).forEach(({ tema, correctas, total }) => {
      const fila = acumulado.get(tema.id);
      fila.correctas += correctas;
      fila.total += total;
    });
  });

  const filas = [...acumulado.values()].map((f) => ({
    id: f.tema.id,
    nombre: f.tema.category,
    correctas: f.correctas,
    total: f.total,
    porcentaje: f.total ? Math.round((f.correctas / f.total) * 100) : null
  }));

  const conDatos = filas.filter((f) => f.porcentaje !== null).sort((a, b) => a.porcentaje - b.porcentaje || b.total - a.total);
  const sinDatos = filas.filter((f) => f.porcentaje === null);
  const reforzar = conDatos.filter((f) => f.porcentaje < UMBRAL_REFUERZO);

  // Sugerencia: los temas por debajo del umbral; si no hay ninguno, el de menor rendimiento.
  const sugeridos = reforzar.length ? reforzar : conDatos.slice(0, 1);
  return {
    temas: [...conDatos, ...sinDatos],
    sugeridos: sugeridos.map((f) => f.id),
    todosSobreUmbral: conDatos.length > 0 && reforzar.length === 0
  };
}
