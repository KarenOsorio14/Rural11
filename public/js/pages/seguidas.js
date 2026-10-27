'use strict';
// «Practica tus conocimientos»: una sesión continua de 20 preguntas tipo ICFES.
// Se corrige una por una con retroalimentación y el avance se guarda después
// de cada respuesta. Al entrar se muestra directamente la primera pregunta.

import '../core/pwa.js';
import { passageHtml } from '../core/passage.js';
import { notify, flash, showPendingFlash } from '../core/notifications.js';
import { friendlyMessage } from '../core/errors.js';
import { showStorageRecovery } from '../core/storage-recovery.js';
import { getSession } from '../modules/auth/auth.service.js';
import {
  SEGUIDAS_SESSION_SIZE,
  advanceSeguidaLevel,
  buildSolvedExample,
  clearSeguidaProgress,
  createSeguidaSession,
  evaluateSeguida,
  getSeguidaProgress,
  pickNextSeguidaQuestion,
  saveSeguidaAttempt,
  saveSeguidaProgress,
  seguidaLevelName
} from '../modules/questionnaires/seguidas.service.js';

const root = document.getElementById('sg');
const titulo = document.getElementById('sg-title');

const LETRAS = ['A', 'B', 'C', 'D'];
const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

const estado = {
  paso: 'sesion',
  usuario: null,
  preguntas: [],
  respuestas: {},
  actual: 0,
  nivel: 1,
  racha: 0,
  seleccion: null,
  startedAt: null,
  resultado: null,
  guardando: false,
  guardado: ''
};

let cadenaGuardado = Promise.resolve();

function textoGuardado() {
  if (estado.guardado === 'guardando') return 'Guardando el avance…';
  if (estado.guardado === 'error') return 'No se pudo guardar el avance. Revisa tu almacenamiento local.';
  if (estado.guardado === 'listo') return 'Progreso guardado';
  return '';
}

function actualizarGuardado() {
  const indicador = root.querySelector('[data-guardado]');
  if (!indicador) return;

  const texto = textoGuardado();
  indicador.hidden = !texto;
  indicador.textContent = texto;
  indicador.dataset.estado = estado.guardado;
}

// ---------- Pregunta ----------
/** Ejemplo resuelto paso a paso (HU-17). Se reutiliza en la revisión final. */
function ejemploHtml(ejemplo, id = '') {
  const opciones = ejemplo.opciones.map((texto, index) => `
      <li class="sg-ejemplo__opcion ${index === ejemplo.correcta ? 'is-correcta' : ''}">
        <span class="sg-ejemplo__letra" aria-hidden="true">${LETRAS[index]}</span>
        <span>${esc(texto)}${index === ejemplo.correcta ? ' <strong>(correcta)</strong>' : ''}</span>
      </li>`).join('');
  const pasos = ejemplo.pasos.map((paso) => `<li>${esc(paso)}</li>`).join('');

  return `
    <div class="sg-ejemplo__cuerpo" ${id ? `id="${id}"` : ''}>
      <p class="sg-ejemplo__titulo">Ejemplo resuelto</p>
      <p class="sg-ejemplo__enunciado">${esc(ejemplo.enunciado)}</p>
      <ul class="sg-ejemplo__opciones">${opciones}</ul>
      <p class="sg-ejemplo__subtitulo">Solución paso a paso</p>
      <ol class="sg-ejemplo__pasos">${pasos}</ol>
      <p class="sg-ejemplo__conclusion">${esc(ejemplo.conclusion)}</p>
    </div>`;
}

function feedbackHtml(pregunta, seleccion) {
  const acierto = seleccion === pregunta.correctIndex;
  const tuRespuesta = acierto ? '' : `
    <p class="sg-feedback__linea">Tu respuesta: <strong>${esc(pregunta.options[seleccion])}</strong></p>`;

  // El ejemplo resuelto solo se ofrece cuando la respuesta fue incorrecta.
  let bloqueEjemplo = '';
  if (!acierto) {
    const ejemplo = buildSolvedExample(pregunta);
    bloqueEjemplo = ejemplo
      ? `<button type="button" class="btn btn--ghost sg-ver-ejemplo" data-accion="ver-ejemplo"
                 aria-expanded="false" aria-controls="sg-ejemplo">Ver ejemplo resuelto</button>
         <section class="sg-ejemplo" id="sg-ejemplo" hidden>
           ${ejemploHtml(ejemplo)}
           <button type="button" class="btn btn--ghost btn--sm sg-ejemplo__cerrar" data-accion="cerrar-ejemplo">Cerrar ejemplo</button>
         </section>`
      : '<p class="sg-ejemplo-vacio">Todavía no hay un ejemplo resuelto para este tema.</p>';
  }

  // Aviso de subida de nivel (HU-18): el nivel guardado ya es mayor que el de esta pregunta.
  const aviso = acierto && estado.nivel > pregunta.level
    ? `<p class="sg-nivel-aviso" role="status">¡Subes de nivel! Las próximas preguntas serán de nivel <strong>${esc(seguidaLevelName(estado.nivel))}</strong>.</p>`
    : '';

  return `
    <div class="sg-feedback ${acierto ? 'sg-feedback--ok' : 'sg-feedback--mal'}" role="status" aria-live="polite">
      <p class="sg-feedback__titulo">${acierto ? '¡Respuesta correcta!' : 'Respuesta incorrecta'}</p>
      ${tuRespuesta}
      <p class="sg-feedback__linea">Respuesta correcta: <strong>${esc(pregunta.options[pregunta.correctIndex])}</strong></p>
      <p class="sg-feedback__explicacion">${esc(pregunta.explanation || '')}</p>
      ${aviso}
      ${bloqueEjemplo}
    </div>`;
}

function vistaSesion() {
  const pregunta = estado.preguntas[estado.actual];
  const total = SEGUIDAS_SESSION_SIZE;
  const respuesta = estado.respuestas[pregunta.id];
  const revisada = respuesta !== undefined;
  const seleccion = revisada ? respuesta : estado.seleccion;
  const esUltima = estado.actual === total - 1;
  const porcentaje = Math.round(((estado.actual + 1) / total) * 100);

  const opciones = pregunta.options.map((texto, index) => {
    const esElegida = seleccion === index;
    const esCorrecta = revisada && index === pregunta.correctIndex;
    const esIncorrecta = revisada && esElegida && !esCorrecta;
    const clases = [
      'ps-op',
      'sg-op',
      esCorrecta ? 'sg-op--ok' : '',
      esIncorrecta ? 'sg-op--mal' : ''
    ].filter(Boolean).join(' ');
    const marca = esCorrecta
      ? '<span class="sg-op__marca">Correcta</span>'
      : esIncorrecta
        ? '<span class="sg-op__marca sg-op__marca--mal">Tu respuesta</span>'
        : '';

    return `
      <button type="button" class="${clases}" data-opcion="${index}" aria-pressed="${esElegida}" ${revisada ? 'disabled' : ''}>
        <span class="ps-op__letra" aria-hidden="true">${LETRAS[index]}</span>
        <span class="ps-op__texto">${esc(texto)}</span>${marca}
      </button>`;
  }).join('');

  const pie = revisada
    ? `${feedbackHtml(pregunta, seleccion)}
       <div class="sg-pie">
         <p class="sg-guardado" data-guardado role="status"></p>
         <button class="btn btn--primary ps-cta" type="button" data-accion="${esUltima ? 'finalizar' : 'siguiente'}">
           ${esUltima ? 'Ver resultado' : 'Siguiente pregunta'}
         </button>
       </div>`
    : `
       <p class="sg-ayuda">Elige una opción y pulsa «Comprobar respuesta».</p>
       <button class="btn btn--primary ps-cta" type="button" data-accion="comprobar" ${seleccion === null ? 'disabled' : ''}>
         Comprobar respuesta
       </button>`;

  return `
    <section class="ps-paso sg-sesion">
      <div class="sg-sesion__top">
        <span class="sg-nivel-pill sg-nivel-pill--${pregunta.level}">${esc(pregunta.levelName)}</span>
        <span class="sg-contador">Pregunta ${estado.actual + 1} de ${total}</span>
      </div>

      <div class="ps-progreso" role="progressbar" aria-valuemin="1" aria-valuemax="${total}" aria-valuenow="${estado.actual + 1}">
        <div class="ps-progreso__barra"><div class="ps-progreso__relleno" data-ancho="${porcentaje}"></div></div>
      </div>

      <p class="ps-etiqueta">${esc(pregunta.topicName)} · Pregunta tipo ICFES</p>
      ${passageHtml(pregunta.passage)}
      <h1 class="ps-pregunta">${esc(pregunta.text)}</h1>
      <div class="ps-opciones">${opciones}</div>
      ${pie}
    </section>`;
}

// ---------- Resultado ----------
function vistaResultado() {
  const resultado = estado.resultado;
  const tituloFinal = resultado.percentage >= 80
    ? '¡Excelente trabajo!'
    : resultado.percentage >= 60
      ? 'Buen trabajo'
      : 'Sigue practicando';

  const niveles = resultado.byDifficulty
    .filter((item) => item.total > 0)
    .map((item) => {
      const porcentaje = item.total ? Math.round((item.correct / item.total) * 100) : 0;
      return `
        <div class="sg-resultado-nivel">
          <div class="sg-resultado-nivel__top">
            <span>${esc(item.name)}</span>
            <strong>${item.correct} de ${item.total}</strong>
          </div>
          <div class="sg-resultado-nivel__barra">
            <div class="sg-resultado-nivel__relleno sg-resultado-nivel__relleno--${item.level}" data-ancho="${porcentaje}"></div>
          </div>
        </div>`;
    }).join('');

  const porTema = (resultado.byTopic || []).map((item) => `
        <li class="sg-tema-nivel">
          <span class="sg-tema-nivel__nombre">${esc(item.topicName)}</span>
          <span class="sg-tema-nivel__dato">${item.correct} de ${item.total} · ${esc(item.maxLevelName)}</span>
        </li>`).join('');

  const revision = resultado.review.map((pregunta, index) => {
    const estadoTexto = pregunta.selectedIndex === null
      ? 'Sin responder'
      : pregunta.isCorrect ? 'Correcta' : 'Incorrecta';
    const tuRespuesta = pregunta.selectedIndex === null
      ? '—'
      : esc(pregunta.options[pregunta.selectedIndex]);

    return `
      <li class="ps-rev ps-rev--${pregunta.isCorrect ? 'ok' : 'mal'}">
        <p class="ps-rev__estado">${index + 1}. ${estadoTexto} · ${esc(pregunta.levelName)}</p>
        <p class="ps-rev__texto">${esc(pregunta.text)}</p>
        <p class="ps-rev__resp">Tu respuesta: <strong>${tuRespuesta}</strong></p>
        <p class="ps-rev__resp">Correcta: <strong>${esc(pregunta.options[pregunta.correctIndex])}</strong></p>
        <p class="ps-rev__exp">${esc(pregunta.explanation || '')}</p>
        ${pregunta.solvedExample ? `
          <details class="sg-rev-ejemplo">
            <summary>Ver ejemplo resuelto</summary>
            ${ejemploHtml(pregunta.solvedExample)}
          </details>` : ''}
      </li>`;
  }).join('');

  return `
    <section class="ps-paso sg-resultado">
      <div class="ps-final ${resultado.percentage >= 60 ? 'ps-final--ok' : ''}">
        <p class="ps-final__pct">${resultado.percentage}%</p>
        <h1 class="ps-final__msg">${tituloFinal}</h1>
        <p class="ps-sub">${resultado.correctCount} de ${resultado.totalQuestions} respuestas correctas</p>
      </div>

      <div class="sg-resultado-resumen">
        <div class="sg-resultado-dato">
          <span class="sg-resultado-dato__val">${resultado.correctCount}</span>
          <span class="sg-resultado-dato__lbl">aciertos</span>
        </div>
        <div class="sg-resultado-dato">
          <span class="sg-resultado-dato__val">${resultado.totalQuestions}</span>
          <span class="sg-resultado-dato__lbl">preguntas</span>
        </div>
        <div class="sg-resultado-dato">
          <span class="sg-resultado-dato__val">${esc(resultado.levelReachedName || '')}</span>
          <span class="sg-resultado-dato__lbl">nivel alcanzado</span>
        </div>
      </div>

      <div>
        <h2 class="ps-h2">Resultado por dificultad</h2>
        <div class="sg-resultado-niveles">${niveles}</div>
      </div>

      ${porTema ? `
      <div>
        <h2 class="ps-h2">Nivel alcanzado por tema</h2>
        <ul class="sg-temas-nivel">${porTema}</ul>
      </div>` : ''}

      <div class="sg-acciones">
        <a class="btn btn--ghost btn--link" href="/#practica">Volver a Práctica</a>
        <button class="btn btn--primary" type="button" data-accion="otra">Otra sesión</button>
      </div>

      <details class="sg-revision">
        <summary class="sg-revision__summary">Revisar las ${resultado.totalQuestions} respuestas</summary>
        <ol class="ps-revision">${revision}</ol>
      </details>
    </section>`;
}

// ---------- Dibujo ----------
function dibujar() {
  const vistas = { sesion: vistaSesion, resultado: vistaResultado };
  root.innerHTML = vistas[estado.paso]();

  // La CSP no permite style="" en el HTML: los anchos se asignan desde JS.
  root.querySelectorAll('[data-ancho]').forEach((elemento) => {
    elemento.style.width = `${elemento.dataset.ancho}%`;
  });

  titulo.textContent = estado.paso === 'resultado'
    ? 'Resultado'
    : 'Practica tus conocimientos';

  actualizarGuardado();
  window.scrollTo(0, 0);
}

// ---------- Guardado ----------
function persistir() {
  if (!estado.usuario || !estado.preguntas.length) return Promise.resolve();

  const snapshot = {
    questionIds: estado.preguntas.map((pregunta) => pregunta.id),
    answers: { ...estado.respuestas },
    currentIndex: estado.actual,
    level: estado.nivel,
    streak: estado.racha,
    startedAt: estado.startedAt
  };

  estado.guardando = true;
  estado.guardado = 'guardando';
  actualizarGuardado();

  cadenaGuardado = cadenaGuardado
    .catch(() => {})
    .then(() => saveSeguidaProgress(estado.usuario.id, snapshot))
    .then(() => {
      estado.guardado = 'listo';
    })
    .catch((error) => {
      estado.guardado = 'error';
      notify({
        type: 'warning',
        title: 'No se pudo guardar el avance',
        message: friendlyMessage(error)
      });
    })
    .finally(() => {
      estado.guardando = false;
      actualizarGuardado();
    });

  return cadenaGuardado;
}

// ---------- Acciones ----------
async function empezarSesion() {
  estado.preguntas = createSeguidaSession();
  estado.respuestas = {};
  estado.actual = 0;
  estado.nivel = 1;
  estado.racha = 0;
  estado.seleccion = null;
  estado.startedAt = new Date().toISOString();
  estado.resultado = null;
  estado.guardado = '';
  estado.paso = 'sesion';

  dibujar();
  await persistir();
}

async function comprobarRespuesta() {
  const pregunta = estado.preguntas[estado.actual];
  if (estado.seleccion === null || estado.respuestas[pregunta.id] !== undefined) return;

  estado.respuestas[pregunta.id] = estado.seleccion;

  // HU-18: tras varias respuestas correctas seguidas, sube el nivel de dificultad.
  const avance = advanceSeguidaLevel(
    { level: estado.nivel, streak: estado.racha },
    estado.seleccion === pregunta.correctIndex,
    estado.preguntas.map((item) => item.id)
  );
  estado.nivel = avance.level;
  estado.racha = avance.streak;

  dibujar();
  await persistir();

  const feedback = root.querySelector('.sg-feedback');
  if (feedback) {
    feedback.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

async function siguientePregunta() {
  if (estado.guardando) await cadenaGuardado.catch(() => {});
  if (estado.actual >= SEGUIDAS_SESSION_SIZE - 1) return;

  // La siguiente pregunta se elige ahora, según el nivel actual del estudiante.
  if (estado.actual + 1 >= estado.preguntas.length) {
    const siguiente = pickNextSeguidaQuestion(
      estado.preguntas.map((item) => item.id),
      estado.nivel
    );
    if (!siguiente) return;

    if (siguiente.level > estado.nivel) {
      notify({
        type: 'info',
        title: 'Cambias de nivel',
        message: `Ya no quedan preguntas de nivel ${seguidaLevelName(estado.nivel)}. Seguimos con ${seguidaLevelName(siguiente.level)}.`
      });
    }
    if (siguiente.level !== estado.nivel) {
      estado.nivel = siguiente.level;
      estado.racha = 0;
    }
    estado.preguntas.push(siguiente);
  }

  estado.actual += 1;
  estado.seleccion = null;
  estado.guardado = '';
  dibujar();
  await persistir();
}

async function finalizarSesion() {
  if (estado.guardando) await cadenaGuardado.catch(() => {});

  let resultado = evaluateSeguida(estado.preguntas, estado.respuestas);

  try {
    resultado = await saveSeguidaAttempt(estado.usuario.id, resultado);
  } catch (error) {
    notify({
      type: 'warning',
      title: 'No se guardó el resultado',
      message: friendlyMessage(error)
    });
  }

  try {
    await clearSeguidaProgress(estado.usuario.id);
  } catch (error) {
    notify({
      type: 'warning',
      title: 'No se pudo limpiar el avance',
      message: friendlyMessage(error)
    });
  }

  estado.resultado = resultado;
  estado.paso = 'resultado';
  estado.preguntas = [];
  estado.respuestas = {};
  estado.actual = 0;
  estado.seleccion = null;

  dibujar();
}

root.addEventListener('click', async (event) => {
  const opcion = event.target.closest('[data-opcion]');
  if (opcion) {
    const pregunta = estado.preguntas[estado.actual];
    if (!pregunta || estado.respuestas[pregunta.id] !== undefined) return;

    estado.seleccion = Number(opcion.dataset.opcion);
    root.querySelectorAll('[data-opcion]').forEach((boton) => {
      const activo = Number(boton.dataset.opcion) === estado.seleccion;
      boton.setAttribute('aria-pressed', String(activo));
    });

    const comprobar = root.querySelector('[data-accion="comprobar"]');
    if (comprobar) comprobar.disabled = false;
    return;
  }

  const boton = event.target.closest('[data-accion]');
  if (!boton) return;

  switch (boton.dataset.accion) {
    case 'ver-ejemplo':
    case 'cerrar-ejemplo': {
      const panel = root.querySelector('#sg-ejemplo');
      const abrir = root.querySelector('[data-accion="ver-ejemplo"]');
      if (!panel || !abrir) return;

      const mostrar = boton.dataset.accion === 'ver-ejemplo' ? panel.hidden : false;
      panel.hidden = !mostrar;
      abrir.setAttribute('aria-expanded', String(mostrar));
      abrir.textContent = mostrar ? 'Ocultar ejemplo resuelto' : 'Ver ejemplo resuelto';
      if (mostrar) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      else abrir.focus();
      return;
    }
    case 'comprobar':
      await comprobarRespuesta();
      return;
    case 'siguiente':
      await siguientePregunta();
      return;
    case 'finalizar':
      await finalizarSesion();
      return;
    case 'otra':
      await empezarSesion();
      return;
    default:
  }
});

async function init() {
  showPendingFlash();

  try {
    const result = await getSession();

    if (result.status !== 'active') {
      flash({
        type: result.status === 'expired' ? 'warning' : 'info',
        title: result.status === 'expired' ? 'Tu sesión expiró' : 'Inicia sesión',
        message: 'Necesitas una cuenta activa para practicar tus conocimientos.'
      });
      location.replace('/login.html');
      return;
    }

    estado.usuario = result.user;

    const guardada = await getSeguidaProgress(result.user.id);
    root.hidden = false;

    if (guardada) {
      estado.preguntas = guardada.questions;
      estado.respuestas = { ...guardada.answers };
      estado.actual = guardada.currentIndex;
      estado.nivel = guardada.level;
      estado.racha = guardada.streak;
      estado.startedAt = guardada.startedAt || new Date().toISOString();
      estado.seleccion = null;
      estado.resultado = null;
      estado.paso = 'sesion';
      dibujar();
      return;
    }

    // Sin sesión guardada, comienza de inmediato con la primera pregunta.
    await empezarSesion();
  } catch (error) {
    if (showStorageRecovery(error)) return;
    notify({
      type: 'error',
      title: 'No se pudo abrir Practica tus conocimientos',
      message: friendlyMessage(error)
    });
  }
}

init();
