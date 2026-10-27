'use strict';
// Simulacro completo tipo ICFES: instrucciones, examen con temporizador, mapa de
// preguntas, entrega y resultados con revisión.

import '../core/pwa.js';
import { passageHtml } from '../core/passage.js';
import { notify, flash, showPendingFlash } from '../core/notifications.js';
import { friendlyMessage } from '../core/errors.js';
import { showStorageRecovery } from '../core/storage-recovery.js';
import { getSession } from '../modules/auth/auth.service.js';
import {
  clearSimulacroProgress,
  getPausedSimulacro,
  getSimulacroById,
  getSimulacrosWithStats,
  evaluateSimulacro,
  saveSimulacroAttempt,
  saveSimulacroProgress
} from '../modules/questionnaires/simulacros.service.js';

const main = document.getElementById('simulacro-main');
const introView = document.getElementById('sim-intro-view');
const playerView = document.getElementById('sim-player-view');
const resultsView = document.getElementById('sim-results-view');
const topbarTitle = document.getElementById('sim-topbar-title');
const finishModal = document.getElementById('sim-finish-modal');
const finishText = document.getElementById('sim-finish-text');
const finishCancel = document.getElementById('sim-finish-cancel');
const finishConfirm = document.getElementById('sim-finish-confirm');
const pauseModal = document.getElementById('sim-pause-modal');
const pauseText = document.getElementById('sim-pause-text');
const pauseResume = document.getElementById('sim-pause-resume');

const ICON_BACK = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
const ICON_NEXT = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
const ICON_FLAG = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 21V4h12l-2.5 4L18 12H6"/></svg>';
const TOPIC_ORDER = ['historia', 'geografia', 'constitucion', 'sociedad'];

const state = {
  user: null,
  simulacro: null,
  answers: {},
  flags: new Set(),
  current: 0,
  limitSeconds: 0,
  remaining: 0,
  sessionStartedAt: 0,
  sessionStartRemaining: 0,
  timerId: null,
  finished: false,
  paused: false,
  result: null
};

const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[char]));

function currentQuestion() {
  return state.simulacro ? state.simulacro.questions[state.current] : null;
}

function answeredCount() {
  if (!state.simulacro) return 0;
  return state.simulacro.questions.filter((question) => state.answers[question.id] !== undefined).length;
}

function formatTimer(totalSeconds) {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes === 0) return `${rest} s`;
  return `${minutes} min ${rest} s`;
}

function plural(count, singular, pluralForm) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

// -------------------------------------------------------------
// 1. Listado e instrucciones
// -------------------------------------------------------------
function simulacroCard(simulacro, index) {
  const best = simulacro.bestScore !== null
    ? `<span class="sim-card__best ${simulacro.passed ? 'is-pass' : ''}">Mejor: ${simulacro.bestScore}%</span>`
    : '';
  const paused = simulacro.paused;
  const status = `<span class="sim-card__status">${paused ? '<span class="sim-card__paused">En pausa</span>' : ''}${best}</span>`;
  const pausedMeta = paused
    ? `<li>${paused.answeredCount}/${simulacro.questionCount} respondidas</li>
       <li>Quedan ${formatTimer(paused.remainingSeconds)}</li>`
    : '';
  const actions = paused
    ? `<div class="sim-card__actions">
         <button class="btn btn--primary" type="button" data-resume="${esc(simulacro.id)}">
           Continuar simulacro
         </button>
         <button class="btn btn--ghost btn--sm" type="button" data-preview="${esc(simulacro.id)}">
           Ver instrucciones
         </button>
       </div>`
    : `<button class="btn btn--primary" type="button" data-preview="${esc(simulacro.id)}">
         Ver instrucciones
       </button>`;

  return `
    <article class="sim-card sim-card--${(index % 3) + 1}">
      <div class="sim-card__top">
        <span class="sim-card__tag">${esc(simulacro.badge)}</span>
        ${status}
      </div>
      <h2 class="sim-card__title">${esc(simulacro.title)}</h2>
      <p class="sim-card__desc">${esc(simulacro.description)}</p>
      <ul class="sim-card__meta">
        <li>${simulacro.questionCount} preguntas</li>
        <li>${simulacro.durationMinutes} min</li>
        <li>${simulacro.areaCount} áreas</li>
        ${pausedMeta}
      </ul>
      ${actions}
    </article>`;
}

async function showList() {
  state.simulacro = null;
  state.finished = true;
  state.paused = false;
  stopTimer();
  removeBeforeUnload();
  playerView.hidden = true;
  resultsView.hidden = true;
  introView.hidden = false;
  topbarTitle.textContent = 'Simulacro ICFES';
  history.replaceState(null, '', '/simulacro.html');
  introView.innerHTML = '<p class="sim-loading">Cargando simulacros…</p>';

  try {
    const simulacros = await getSimulacrosWithStats(state.user.id);
    introView.innerHTML = `
      <section class="sim-intro">
        <div class="sim-intro__head">
          <p class="sim-kicker">Prueba completa · Saber 11</p>
          <h1 class="sim-title">Simulacros ICFES</h1>
          <p class="sim-lead">
            Elige un simulacro completo de Ciencias Sociales. Incluye las cuatro áreas,
            preguntas de lectura, temporizador y revisión detallada al final. Puedes pausarlo
            y continuar después sin perder tus respuestas.
          </p>
        </div>
        <div class="sim-list">
          ${simulacros.map(simulacroCard).join('')}
        </div>
      </section>`;
  } catch (error) {
    if (showStorageRecovery(error)) return;
    introView.innerHTML = `
      <div class="q-empty">
        No se pudieron cargar los simulacros. ${esc(friendlyMessage(error))}
      </div>`;
  }
}

async function showIntro(simulacro) {
  let paused = null;

  if (state.user) {
    try {
      paused = await getPausedSimulacro(state.user.id, simulacro.id);
    } catch (error) {
      if (showStorageRecovery(error)) return;
      notify({
        type: 'warning',
        title: 'No se pudo revisar el progreso',
        message: friendlyMessage(error)
      });
    }
  }

  state.simulacro = simulacro;
  state.finished = true;
  state.paused = false;
  stopTimer();
  removeBeforeUnload();
  playerView.hidden = true;
  resultsView.hidden = true;
  introView.hidden = false;
  topbarTitle.textContent = simulacro.title;
  history.replaceState(null, '', `/simulacro.html?id=${encodeURIComponent(simulacro.id)}`);

  const pausedPanel = paused
    ? `<div class="sim-paused-note">
         <div>
           <strong class="sim-paused-note__title">Tienes este simulacro en pausa</strong>
           <p class="sim-paused-note__text">
             Guardaste ${plural(paused.answeredCount, 'respuesta', 'respuestas')} de
             ${simulacro.questionCount}. Puedes continuar exactamente donde lo dejaste.
           </p>
         </div>
         <span class="sim-paused-note__time">${formatTimer(paused.remainingSeconds)}</span>
       </div>`
    : '';

  const actions = paused
    ? `<div class="sim-intro__buttons">
         <button class="btn btn--ghost" type="button" data-restart="${esc(simulacro.id)}">
           Empezar de nuevo
         </button>
         <button class="btn btn--primary" type="button" data-resume="${esc(simulacro.id)}">
           Continuar simulacro
         </button>
       </div>`
    : `<button class="btn btn--primary" type="button" data-start="${esc(simulacro.id)}">
         Comenzar simulacro
       </button>`;

  introView.innerHTML = `
    <section class="sim-intro">
      <div class="sim-intro__head">
        <span class="sim-card__tag">${esc(simulacro.badge)}</span>
        <h1 class="sim-title">${esc(simulacro.title)}</h1>
        <p class="sim-lead">${esc(simulacro.description)}</p>
      </div>

      ${pausedPanel}

      <div class="sim-stats">
        <div class="sim-stat">
          <span class="sim-stat__value">${simulacro.questionCount}</span>
          <span class="sim-stat__label">Preguntas</span>
        </div>
        <div class="sim-stat">
          <span class="sim-stat__value">${simulacro.durationMinutes}</span>
          <span class="sim-stat__label">Minutos</span>
        </div>
        <div class="sim-stat">
          <span class="sim-stat__value">${simulacro.areaCount}</span>
          <span class="sim-stat__label">Áreas</span>
        </div>
        <div class="sim-stat">
          <span class="sim-stat__value">60%</span>
          <span class="sim-stat__label">Para aprobar</span>
        </div>
      </div>

      <div class="sim-panel">
        <h2 class="sim-panel__title">Antes de empezar</h2>
        <ul class="sim-instructions">
          <li>Responde preguntas de Historia, Geografía, Constitución y Sociedad.</li>
          <li>Puedes moverte entre preguntas con los botones o con el mapa del simulacro.</li>
          <li>Usa “Marcar para revisar” si quieres volver a una pregunta antes de entregar.</li>
          <li>El temporizador empieza al dar clic en “Comenzar simulacro”. Puedes pausarlo: el tiempo se detiene y tu progreso queda guardado.</li>
          <li>Al entregar verás tu puntaje, la clave de respuestas y la explicación de cada pregunta.</li>
        </ul>
      </div>

      <div class="sim-intro__actions">
        <a class="btn btn--ghost btn--link" href="/simulacro.html">Ver otros simulacros</a>
        ${actions}
      </div>
    </section>`;
  window.scrollTo(0, 0);
}

// -------------------------------------------------------------
// 2. Examen
// -------------------------------------------------------------
function startExam() {
  if (!state.simulacro) return;

  state.answers = {};
  state.flags = new Set();
  state.current = 0;
  state.limitSeconds = state.simulacro.durationMinutes * 60;
  state.remaining = state.limitSeconds;
  state.sessionStartedAt = 0;
  state.sessionStartRemaining = 0;
  state.finished = false;
  state.paused = false;
  state.result = null;

  introView.hidden = true;
  resultsView.hidden = true;
  playerView.hidden = false;
  topbarTitle.textContent = state.simulacro.title;

  addBeforeUnload();
  renderPlayer();
  startTimer();
  notify({
    type: 'info',
    title: 'Simulacro iniciado',
    message: `Tienes ${state.simulacro.durationMinutes} minutos. Puedes pausar y continuar después.`
  });
}

function startTimer() {
  stopTimer();
  state.sessionStartedAt = Date.now();
  state.sessionStartRemaining = state.remaining;
  state.timerId = window.setInterval(tick, 1000);
  tick();
}

function stopTimer() {
  if (state.timerId) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }
}

/** Calcula el tiempo restante sin contar los periodos en pausa. */
function syncRemaining() {
  if (!state.simulacro || !state.sessionStartedAt) return;
  const elapsed = Math.floor((Date.now() - state.sessionStartedAt) / 1000);
  state.remaining = Math.max(0, state.sessionStartRemaining - elapsed);
}

function tick() {
  if (!state.simulacro || state.finished || state.paused) return;
  syncRemaining();
  updateTimer();

  if (state.remaining <= 0) {
    stopTimer();
    finishExam({ auto: true });
  }
}

function updateTimer() {
  const timer = document.getElementById('sim-timer');
  if (!timer) return;
  timer.textContent = formatTimer(state.remaining);
  timer.classList.toggle('is-low', state.remaining <= 5 * 60);
  timer.classList.toggle('is-critical', state.remaining <= 60);
  timer.setAttribute('aria-label', `Tiempo restante: ${formatTimer(state.remaining)}`);
}

function paletteButton(question, index) {
  const answered = state.answers[question.id] !== undefined;
  const flagged = state.flags.has(question.id);
  const current = index === state.current;
  const classes = [
    'sim-palette__btn',
    answered ? 'is-answered' : '',
    flagged ? 'is-flagged' : '',
    current ? 'is-current' : ''
  ].filter(Boolean).join(' ');
  const label = `Pregunta ${index + 1}${answered ? ', respondida' : ', sin responder'}${flagged ? ', marcada para revisar' : ''}`;

  return `<button class="${classes}" type="button" data-jump="${index}" aria-label="${label}" ${current ? 'aria-current="true"' : ''}>${index + 1}</button>`;
}

function renderPlayer() {
  const simulacro = state.simulacro;
  const question = currentQuestion();
  const total = simulacro.questions.length;
  const selected = state.answers[question.id];
  const flagged = state.flags.has(question.id);
  const isFirst = state.current === 0;
  const isLast = state.current === total - 1;
  const progress = Math.round(((state.current + 1) / total) * 100);

  playerView.innerHTML = `
    <section class="sim-exam">
      <div class="sim-exam__top">
        <div>
          <p class="sim-kicker">${esc(simulacro.badge)}</p>
          <p class="sim-exam__count">Pregunta ${state.current + 1} de ${total}</p>
        </div>
        <div class="sim-exam__tools">
          <span class="sim-timer" id="sim-timer" role="timer">${formatTimer(state.remaining)}</span>
          <button class="btn btn--ghost btn--sm" id="sim-pause" type="button">Pausar</button>
          <button class="btn btn--ghost btn--sm" id="sim-exit" type="button">Salir</button>
        </div>
      </div>

      <div class="sim-progress" aria-hidden="true">
        <div class="sim-progress__fill" data-width="${progress}"></div>
      </div>

      <div class="sim-exam__grid">
        <section class="q-player sim-question" aria-labelledby="sim-question-title">
          <div class="q-player__nav">
            <span class="q-player__topic">${esc(question.category)}</span>
            <span class="q-player__count">${esc(question.topicName)}</span>
          </div>

          ${passageHtml(question.passage)}
          <h2 class="q-player__question-text" id="sim-question-title" tabindex="-1">${esc(question.text)}</h2>

          <fieldset class="q-options fieldset-reset">
            <legend class="visually-hidden">Opciones de respuesta</legend>
            ${question.options.map((option, index) => `
              <label class="q-option ${selected === index ? 'is-selected' : ''}">
                <input type="radio" name="sim-question" value="${index}" ${selected === index ? 'checked' : ''}>
                <span class="q-option__label">${esc(option)}</span>
              </label>`).join('')}
          </fieldset>

          <div class="sim-question__footer">
            <button class="sim-flag ${flagged ? 'is-active' : ''}" id="sim-flag" type="button" aria-pressed="${flagged}">
              ${ICON_FLAG}
              <span id="sim-flag-text">${flagged ? 'Marcada para revisar' : 'Marcar para revisar'}</span>
            </button>

            <div class="sim-question__nav">
              <button class="btn btn--ghost" id="sim-prev" type="button" ${isFirst ? 'disabled' : ''}>
                ${ICON_BACK} Anterior
              </button>
              ${isLast
                ? '<button class="btn btn--primary" id="sim-finish" type="button">Finalizar simulacro</button>'
                : `<button class="btn btn--primary" id="sim-next" type="button">Siguiente ${ICON_NEXT}</button>`}
            </div>
          </div>
        </section>

        <aside class="sim-side">
          <div class="sim-palette-card">
            <div class="sim-palette-card__head">
              <h2 class="sim-palette-card__title">Mapa del simulacro</h2>
              <span class="sim-palette-card__count" id="sim-answered-count">${answeredCount()}/${total}</span>
            </div>
            <div class="sim-palette" id="sim-palette" aria-label="Ir a una pregunta">
              ${simulacro.questions.map(paletteButton).join('')}
            </div>
            <ul class="sim-legend">
              <li><span class="sim-legend__dot sim-legend__dot--answered"></span>Respondida</li>
              <li><span class="sim-legend__dot sim-legend__dot--current"></span>Actual</li>
              <li><span class="sim-legend__dot sim-legend__dot--flagged"></span>Por revisar</li>
            </ul>
            <button class="btn btn--primary" id="sim-finish-side" type="button">Entregar simulacro</button>
          </div>
          <p class="sim-side__hint">El temporizador sigue corriendo al cambiar de pregunta, pero se detiene cuando pausas el simulacro.</p>
        </aside>
      </div>
    </section>`;

  const fill = playerView.querySelector('.sim-progress__fill');
  if (fill) fill.style.width = `${fill.dataset.width}%`;
  updateTimer();
}

function refreshPlayerState() {
  if (!state.simulacro || state.finished) return;
  const question = currentQuestion();
  const total = state.simulacro.questions.length;

  playerView.querySelectorAll('.q-option').forEach((label) => {
    const input = label.querySelector('input');
    label.classList.toggle('is-selected', Boolean(input && input.checked));
  });

  playerView.querySelectorAll('[data-jump]').forEach((button) => {
    const index = Number(button.dataset.jump);
    const item = state.simulacro.questions[index];
    const answered = state.answers[item.id] !== undefined;
    const flagged = state.flags.has(item.id);
    button.classList.toggle('is-answered', answered);
    button.classList.toggle('is-flagged', flagged);
    button.classList.toggle('is-current', index === state.current);
    if (index === state.current) button.setAttribute('aria-current', 'true');
    else button.removeAttribute('aria-current');
  });

  const counter = document.getElementById('sim-answered-count');
  if (counter) counter.textContent = `${answeredCount()}/${total}`;

  const flagButton = document.getElementById('sim-flag');
  const flagText = document.getElementById('sim-flag-text');
  const flagged = state.flags.has(question.id);
  if (flagButton) {
    flagButton.classList.toggle('is-active', flagged);
    flagButton.setAttribute('aria-pressed', String(flagged));
  }
  if (flagText) flagText.textContent = flagged ? 'Marcada para revisar' : 'Marcar para revisar';
}

function goTo(index) {
  if (!state.simulacro) return;
  if (index < 0 || index >= state.simulacro.questions.length) return;
  state.current = index;
  renderPlayer();
}

function toggleFlag() {
  const question = currentQuestion();
  if (!question) return;
  if (state.flags.has(question.id)) state.flags.delete(question.id);
  else state.flags.add(question.id);
  refreshPlayerState();
}

/** Guarda respuestas, pregunta actual y tiempo restante, y detiene el reloj. */
async function pauseExam() {
  if (!state.simulacro || state.finished || state.paused) return;

  syncRemaining();
  if (state.remaining <= 0) {
    stopTimer();
    finishExam({ auto: true });
    return;
  }

  stopTimer();

  try {
    await saveSimulacroProgress(state.user.id, state.simulacro.id, {
      answers: state.answers,
      flags: [...state.flags],
      current: state.current,
      remainingSeconds: state.remaining
    });
  } catch (error) {
    if (showStorageRecovery(error)) {
      state.paused = true;
      removeBeforeUnload();
      return;
    }

    startTimer();
    notify({
      type: 'error',
      title: 'No se pudo pausar',
      message: friendlyMessage(error)
    });
    return;
  }

  state.paused = true;
  removeBeforeUnload();

  const savedAnswers = answeredCount() > 0
    ? `Guardamos ${plural(answeredCount(), 'respuesta', 'respuestas')} y el tiempo restante`
    : 'Guardamos el tiempo restante';

  pauseText.textContent =
    `${savedAnswers} (${formatTimer(state.remaining)}). Puedes continuar ahora o volver al inicio; ` +
    'el simulacro quedará en pausa para retomarlo cuando quieras.';
  pauseModal.hidden = false;
  pauseResume.focus();
}

/** Continúa el simulacro que está pausado en esta misma página. */
function resumePausedSession() {
  if (!state.paused || !state.simulacro) return;

  state.paused = false;
  pauseModal.hidden = true;
  addBeforeUnload();
  startTimer();
  updateTimer();
  document.getElementById('sim-pause')?.focus();

  notify({
    type: 'info',
    title: 'Simulacro reanudado',
    message: `Te quedan ${formatTimer(state.remaining)}.`
  });
}

/** Restaura respuestas, marcas, pregunta actual y tiempo de un progreso guardado. */
function restoreExam(simulacro, progress) {
  state.simulacro = simulacro;
  state.answers = {};
  state.flags = new Set();
  state.current = Math.max(
    0,
    Math.min(simulacro.questions.length - 1, Number(progress.current) || 0)
  );
  state.limitSeconds = simulacro.durationMinutes * 60;
  state.remaining = Math.max(
    0,
    Math.min(state.limitSeconds, Number(progress.remainingSeconds) || 0)
  );
  state.sessionStartedAt = 0;
  state.sessionStartRemaining = 0;
  state.finished = false;
  state.paused = false;
  state.result = null;

  const validIds = new Set(simulacro.questions.map((question) => question.id));
  for (const question of simulacro.questions) {
    const raw = progress.answers ? progress.answers[question.id] : undefined;
    if (raw === undefined || raw === null) continue;
    const index = Number(raw);
    if (Number.isInteger(index) && index >= 0 && index < question.options.length) {
      state.answers[question.id] = index;
    }
  }

  state.flags = new Set(
    (Array.isArray(progress.flags) ? progress.flags : []).filter((id) => validIds.has(id))
  );

  introView.hidden = true;
  resultsView.hidden = true;
  playerView.hidden = false;
  topbarTitle.textContent = simulacro.title;
  history.replaceState(null, '', `/simulacro.html?id=${encodeURIComponent(simulacro.id)}`);

  addBeforeUnload();
  renderPlayer();
  startTimer();

  notify({
    type: 'info',
    title: 'Simulacro reanudado',
    message: `Continúas donde lo dejaste. Te quedan ${formatTimer(state.remaining)}.`
  });
}

/** Carga el progreso guardado y lo restaura; si ya no existe, muestra las instrucciones. */
async function resumeSavedExam(simulacroId) {
  try {
    const simulacro = getSimulacroById(simulacroId);
    const progress = await getPausedSimulacro(state.user.id, simulacro.id);

    if (!progress) {
      notify({
        type: 'info',
        title: 'No hay progreso guardado',
        message: 'Puedes comenzar el simulacro desde el principio.'
      });
      await showIntro(simulacro);
      return;
    }

    restoreExam(simulacro, progress);
  } catch (error) {
    if (showStorageRecovery(error)) return;
    notify({
      type: 'error',
      title: 'No se pudo continuar el simulacro',
      message: friendlyMessage(error)
    });
  }
}

function openFinishModal() {
  if (state.finished) return;
  const total = state.simulacro.questions.length;
  const unanswered = total - answeredCount();
  const flagged = state.flags.size;
  const parts = [];

  if (unanswered > 0) {
    parts.push(`Tienes ${plural(unanswered, 'pregunta sin responder', 'preguntas sin responder')}.`);
  } else {
    parts.push('Respondiste todas las preguntas.');
  }
  if (flagged > 0) {
    parts.push(`Marcaste ${plural(flagged, 'pregunta', 'preguntas')} para revisar.`);
  }
  parts.push(`Te quedan ${formatTimer(state.remaining)} de tiempo.`);

  finishText.textContent = `${parts.join(' ')} ¿Quieres entregar el simulacro?`;
  finishModal.hidden = false;
  finishCancel.focus();
}

function closeFinishModal() {
  finishModal.hidden = true;
}

async function finishExam({ auto = false } = {}) {
  if (state.finished || !state.simulacro) return;

  syncRemaining();
  state.finished = true;
  state.paused = false;
  stopTimer();
  closeFinishModal();
  removeBeforeUnload();
  await clearSimulacroProgress(state.user.id, state.simulacro.id).catch(() => {});

  const durationSeconds = Math.min(
    state.limitSeconds,
    Math.max(0, state.limitSeconds - state.remaining)
  );

  try {
    const result = evaluateSimulacro(state.simulacro.id, state.answers, { durationSeconds });
    state.result = result;

    // Se intenta guardar antes de mostrar el resultado para no perder el intento si el
    // usuario cambia de página inmediatamente. Si falla, el resultado se muestra igual.
    let saveError = null;
    try {
      await saveSimulacroAttempt(state.user.id, result);
    } catch (error) {
      saveError = error;
    }

    renderResults(result);

    if (auto) {
      notify({
        type: 'warning',
        title: 'Tiempo agotado',
        message: 'El simulacro se entregó automáticamente.'
      });
    }

    if (saveError) {
      notify({
        type: 'warning',
        title: 'No se guardó el resultado',
        message: friendlyMessage(saveError)
      });
    }
  } catch (error) {
    notify({ type: 'error', title: 'No se pudo calificar', message: friendlyMessage(error) });
    showList();
  }
}

async function exitExam() {
  if (state.finished) {
    showList();
    return;
  }
  const confirmed = window.confirm(
    '¿Salir del simulacro? Se descartará el progreso de este intento. ' +
    'Si quieres conservarlo, usa “Pausar”.'
  );
  if (!confirmed) return;
  state.finished = true;
  state.paused = false;
  stopTimer();
  removeBeforeUnload();
  await clearSimulacroProgress(state.user.id, state.simulacro.id).catch(() => {});
  window.location.href = '/#simulacro';
}

// -------------------------------------------------------------
// 3. Resultados
// -------------------------------------------------------------
function renderResults(result) {
  introView.hidden = true;
  playerView.hidden = true;
  resultsView.hidden = false;
  topbarTitle.textContent = result.title;

  const sortedTopics = [...result.byTopic].sort(
    (a, b) => TOPIC_ORDER.indexOf(a.id) - TOPIC_ORDER.indexOf(b.id)
  );
  const time = formatDuration(result.durationSeconds);

  resultsView.innerHTML = `
    <section class="q-results sim-results">
      <div class="q-results__header">
        <div class="q-score-badge ${result.passed ? 'q-score-badge--pass' : 'q-score-badge--fail'}">
          <span class="q-score-badge__number">${result.percentage}%</span>
          <span class="q-score-badge__label">${result.passed ? 'Aprobado' : 'Reprobado'}</span>
        </div>
        <h1 class="q-results__title">${result.passed ? '¡Buen trabajo!' : 'Sigue preparándote'}</h1>
        <p class="q-results__desc">
          ${result.passed
            ? 'Alcanzaste el puntaje mínimo del simulacro. Revisa tus respuestas para consolidar lo aprendido.'
            : 'No alcanzaste el 60 %. Revisa la explicación de cada pregunta y vuelve a intentarlo.'}
        </p>
      </div>

      <div class="q-results__stats">
        <div class="q-stat-card">
          <div class="q-stat-card__value">${result.correctCount} / ${result.totalQuestions}</div>
          <div class="q-stat-card__label">Aciertos</div>
        </div>
        <div class="q-stat-card">
          <div class="q-stat-card__value">${result.percentage}%</div>
          <div class="q-stat-card__label">Puntaje ponderado</div>
        </div>
        <div class="q-stat-card">
          <div class="q-stat-card__value">${time}</div>
          <div class="q-stat-card__label">Tiempo utilizado</div>
        </div>
        <div class="q-stat-card">
          <div class="q-stat-card__value">${result.passingPercentage}%</div>
          <div class="q-stat-card__label">Mínimo para aprobar</div>
        </div>
      </div>

      <section class="sim-pondera" aria-labelledby="sim-pondera-title">
        <h2 class="q-results__subtitle" id="sim-pondera-title">Cómo se calculó tu puntaje</h2>
        <p>
          Acertaste ${result.correctCount} de ${result.totalQuestions} preguntas (${result.rawPercentage}% de aciertos).
          Las preguntas más difíciles pesan más: las básicas valen 1, las intermedias 2 y las avanzadas 3.
          Por eso tu puntaje ponderado es <strong>${result.percentage} de 100</strong>.
        </p>
        <p>
          En el Saber 11, Sociales y ciudadanas pesa ${result.moduleWeight.part} de las ${result.moduleWeight.of} partes del
          puntaje global (Lectura crítica, Matemáticas y Ciencias naturales pesan 3 cada una e Inglés 1).
          Con este resultado aportarías unos <strong>${result.globalContribution} de ${result.globalMax} puntos</strong>
          del puntaje global de 500.
        </p>
      </section>

      <section class="sim-topic-results">
        <h2 class="q-results__subtitle">Desempeño por área</h2>
        <div class="sim-topic-list">
          ${sortedTopics.map((topic) => {
            const topicPercentage = topic.total ? Math.round((topic.correct / topic.total) * 100) : 0;
            return `
              <div class="sim-topic-row">
                <span class="sim-topic-row__name">${esc(topic.name)}</span>
                <span class="sim-topic-row__value">${topic.correct}/${topic.total} · ${topicPercentage}%</span>
                <div class="sim-topic-bar" aria-hidden="true">
                  <span data-width="${topicPercentage}"></span>
                </div>
              </div>`;
          }).join('')}
        </div>
      </section>

      <details class="sim-answer-key">
        <summary class="sim-answer-key__summary">Ver clave de respuestas correctas (${result.totalQuestions})</summary>
        <ol class="sim-answer-key__list">
          ${result.review.map((item) => {
            const letter = String.fromCharCode(65 + item.correctIndex);
            const correctChoice = item.options[item.correctIndex] || '';
            return `<li class="sim-answer-key__item">
              <span class="sim-answer-key__letter">${letter}</span>
              <span>${esc(correctChoice)}</span>
            </li>`;
          }).join('')}
        </ol>
      </details>

      <section>
        <h2 class="q-results__subtitle">Revisión de respuestas</h2>
        <div class="q-review-list">
          ${result.review.map((item, index) => {
            const isOk = item.isCorrect;
            const yourChoice = item.selectedIndex !== null ? item.options[item.selectedIndex] : 'Sin responder';
            const correctChoice = item.options[item.correctIndex];
            return `
              <div class="q-review-item ${isOk ? 'q-review-item--correct' : 'q-review-item--incorrect'}">
                <div class="q-review-item__header">
                  <span>Pregunta ${index + 1}: ${esc(item.text)}</span>
                  <span class="review-state ${isOk ? 'text-ok' : 'text-bad'}">${isOk ? 'Correcta' : 'Incorrecta'}</span>
                </div>
                <p class="sim-review__topic">${esc(item.topicName)}</p>
                ${item.passage
                  ? `<details class="sim-review__passage">
                      <summary>Ver lectura</summary>
                      ${passageHtml(item.passage)}
                    </details>`
                  : ''}
                <div class="review-detail">
                  <div><strong>Tu respuesta:</strong> <span class="${isOk ? 'text-ok' : 'text-bad'}">${esc(yourChoice)}</span></div>
                  <div><strong>Respuesta correcta:</strong> <span class="text-ok text-strong">${esc(correctChoice)}</span></div>
                </div>
                <div class="q-review-item__explanation">
                  <strong>Explicación:</strong> ${esc(item.explanation || '')}
                </div>
              </div>`;
          }).join('')}
        </div>
      </section>

      <div class="q-results__footer">
        <a class="btn btn--ghost btn--link" href="/#simulacro">Volver al inicio</a>
        <button class="btn btn--primary" id="sim-retry" type="button">Repetir simulacro</button>
      </div>
    </section>`;

  resultsView.querySelectorAll('[data-width]').forEach((bar) => {
    bar.style.width = `${Number(bar.dataset.width) || 0}%`;
  });

  const retry = document.getElementById('sim-retry');
  if (retry) {
    retry.addEventListener('click', () => {
      resultsView.hidden = true;
      startExam();
    });
  }

  window.scrollTo(0, 0);
}

// -------------------------------------------------------------
// 4. Aviso al salir y eventos
// -------------------------------------------------------------
function warnBeforeUnload(event) {
  if (state.finished || state.paused) return;
  event.preventDefault();
  event.returnValue = '';
}

function addBeforeUnload() {
  window.addEventListener('beforeunload', warnBeforeUnload);
}

function removeBeforeUnload() {
  window.removeEventListener('beforeunload', warnBeforeUnload);
}

introView.addEventListener('click', async (event) => {
  const preview = event.target.closest('[data-preview]');
  if (preview) {
    try {
      await showIntro(getSimulacroById(preview.dataset.preview));
    } catch (error) {
      notify({ type: 'error', title: 'Simulacro no disponible', message: friendlyMessage(error) });
    }
    return;
  }

  const resume = event.target.closest('[data-resume]');
  if (resume) {
    await resumeSavedExam(resume.dataset.resume);
    return;
  }

  const restart = event.target.closest('[data-restart]');
  if (restart) {
    try {
      const simulacro = getSimulacroById(restart.dataset.restart);
      const confirmed = window.confirm(
        '¿Empezar de nuevo? Se borrará el progreso guardado de este simulacro.'
      );
      if (!confirmed) return;

      await clearSimulacroProgress(state.user.id, simulacro.id).catch(() => {});
      state.simulacro = simulacro;
      startExam();
    } catch (error) {
      notify({ type: 'error', title: 'Simulacro no disponible', message: friendlyMessage(error) });
    }
    return;
  }

  const start = event.target.closest('[data-start]');
  if (start) {
    try {
      state.simulacro = getSimulacroById(start.dataset.start);
      startExam();
    } catch (error) {
      notify({ type: 'error', title: 'Simulacro no disponible', message: friendlyMessage(error) });
    }
  }
});

playerView.addEventListener('click', (event) => {
  if (event.target.closest('#sim-pause')) {
    pauseExam();
    return;
  }

  if (event.target.closest('#sim-exit')) {
    exitExam();
    return;
  }

  const jump = event.target.closest('[data-jump]');
  if (jump) {
    goTo(Number(jump.dataset.jump));
    return;
  }

  if (event.target.closest('#sim-prev')) {
    goTo(state.current - 1);
    return;
  }

  if (event.target.closest('#sim-next')) {
    goTo(state.current + 1);
    return;
  }

  if (event.target.closest('#sim-flag')) {
    toggleFlag();
    return;
  }

  if (event.target.closest('#sim-finish') || event.target.closest('#sim-finish-side')) {
    openFinishModal();
  }
});

playerView.addEventListener('change', (event) => {
  const input = event.target.closest('input[name="sim-question"]');
  if (!input || !state.simulacro) return;
  const question = currentQuestion();
  state.answers[question.id] = Number(input.value);
  refreshPlayerState();
});

finishCancel.addEventListener('click', closeFinishModal);

finishConfirm.addEventListener('click', () => {
  finishExam();
});

finishModal.addEventListener('click', (event) => {
  if (event.target === finishModal) closeFinishModal();
});

pauseResume.addEventListener('click', resumePausedSession);

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (!pauseModal.hidden) {
    resumePausedSession();
    return;
  }
  if (!finishModal.hidden) closeFinishModal();
});

// -------------------------------------------------------------
// 5. Inicialización
// -------------------------------------------------------------
async function init() {
  showPendingFlash();

  try {
    const session = await getSession();
    if (session.status !== 'active') {
      flash({
        type: 'info',
        title: 'Inicia sesión',
        message: 'Necesitas una cuenta activa para hacer un simulacro.'
      });
      location.replace('/login.html');
      return;
    }

    state.user = session.user;
    main.hidden = false;

    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (!id) {
      await showList();
      return;
    }

    try {
      const simulacro = getSimulacroById(id);
      if (params.get('resume') === '1') {
        await resumeSavedExam(simulacro.id);
      } else {
        await showIntro(simulacro);
      }
    } catch (error) {
      notify({ type: 'error', title: 'Simulacro no encontrado', message: friendlyMessage(error) });
      await showList();
    }
  } catch (error) {
    if (showStorageRecovery(error)) return;
    notify({ type: 'error', title: 'No se pudo iniciar el simulacro', message: friendlyMessage(error) });
  }
}

init();
