'use strict';

import '../core/pwa.js';
import { notify, flash, showPendingFlash } from '../core/notifications.js';
import { friendlyMessage } from '../core/errors.js';
import { getSession } from '../modules/auth/auth.service.js';
import {
  TOPICS,
  getQuestionnairesList,
  getQuestionnaireById,
  evaluateAndSaveAttempt,
  getUserAttempts
} from '../modules/questionnaires/questionnaires.service.js';

const practiceMain = document.getElementById('practice-main');
const topbarTopicTitle = document.getElementById('topbar-topic-title');
const topicAvatar = document.getElementById('topic-avatar');
const topicTitle = document.getElementById('topic-title');
const topicDesc = document.getElementById('topic-desc');
const topicBadge = document.getElementById('topic-badge');

const catalogView = document.getElementById('q-catalog-view');
const playerView = document.getElementById('q-player-view');
const resultsView = document.getElementById('q-results-view');
const cardsGrid = document.getElementById('q-cards-grid');
const historyContainer = document.getElementById('q-history-container');
const historyTbody = document.getElementById('q-history-tbody');

const dateFormat = new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeStyle: 'short' });

let currentUser = null;
let currentTopic = null;
let currentQuiz = null;
let currentQuestionIndex = 0;
let userAnswers = {};

function getSelectedTopic() {
  const params = new URLSearchParams(window.location.search);
  const rawParam = params.get('topic') || '';
  const topicParam = decodeURIComponent(rawParam).trim().toLowerCase();

  const found = TOPICS.find((t) =>
    t.id.toLowerCase() === topicParam ||
    t.category.toLowerCase() === topicParam ||
    t.name.toLowerCase().includes(topicParam)
  );
  return found || TOPICS[0];
}

function showView(view) {
  catalogView.style.display = view === 'catalog' ? 'block' : 'none';
  playerView.style.display = view === 'player' ? 'block' : 'none';
  resultsView.style.display = view === 'results' ? 'block' : 'none';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// -------------------------------------------------------------
// 1. Renderizar Catálogo del Tema
// -------------------------------------------------------------
async function renderTopicCatalog() {
  try {
    const list = await getQuestionnairesList(currentUser.id, currentTopic.category);
    const allHistory = await getUserAttempts(currentUser.id);
    const topicHistory = allHistory.filter((h) => h.category === currentTopic.category);

    topbarTopicTitle.textContent = currentTopic.name;
    topicAvatar.textContent = currentTopic.icon;
    topicTitle.textContent = currentTopic.name;
    topicDesc.textContent = currentTopic.description;
    topicBadge.textContent = currentTopic.badge || currentTopic.category;

    if (list.length === 0) {
      cardsGrid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 2.5rem; text-align: center; color: var(--muted); background: var(--surface); border: 1px dashed var(--border); border-radius: var(--radius);">
          No hay cuestionarios disponibles en este tema por el momento.
        </div>
      `;
    } else {
      cardsGrid.innerHTML = list
        .map((q) => {
          let scoreBadge = '';
          if (q.bestScore !== null) {
            const badgeClass = q.passed ? 'q-card__badge--success' : 'q-card__badge';
            scoreBadge = `<span class="q-card__badge ${badgeClass}">Mejor: ${q.bestScore}%</span>`;
          }

          return `
          <article class="q-card">
            <div class="q-card__top">
              <span class="q-card__icon">${q.icon}</span>
              <div style="display: flex; gap: 0.4rem; align-items: center;">
                <span class="q-card__badge">${q.difficulty}</span>
                ${scoreBadge}
              </div>
            </div>
            <h3 class="q-card__title">${q.title}</h3>
            <p class="q-card__desc">${q.description}</p>
            <div class="q-card__meta">
              <span>📝 ${q.questionsCount} preguntas</span>
              <span>⏱️ ~${q.durationMinutes} min</span>
            </div>
            <button class="btn btn--primary q-card__btn" data-action="start-quiz" data-id="${q.id}">
              ${q.bestScore !== null ? 'Reintentar práctica' : 'Comenzar práctica'}
            </button>
          </article>
        `;
        })
        .join('');
    }

    cardsGrid.querySelectorAll('[data-action="start-quiz"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        startQuiz(btn.dataset.id);
      });
    });

    if (topicHistory.length > 0) {
      historyTbody.innerHTML = topicHistory
        .map((att) => {
          const dateStr = dateFormat.format(new Date(att.createdAt));
          const badgeColor = att.passed ? 'var(--success)' : 'var(--danger)';
          const badgeBg = att.passed ? 'var(--success-soft)' : 'var(--danger-soft)';
          const statusText = att.passed ? 'Aprobado' : 'No aprobado';

          return `
          <tr>
            <td>
              <strong>${att.questionnaireTitle || 'Cuestionario'}</strong>
            </td>
            <td>
              <span style="display: inline-block; padding: 0.2rem 0.5rem; border-radius: 999px; font-weight: 700; font-size: 0.8rem; background: ${badgeBg}; color: ${badgeColor};">
                ${att.percentage}% (${statusText})
              </span>
            </td>
            <td>${att.correctCount} / ${att.totalQuestions}</td>
            <td style="color: var(--muted); font-size: 0.8rem;">${dateStr}</td>
          </tr>
        `;
        })
        .join('');
      historyContainer.style.display = 'block';
    } else {
      historyContainer.style.display = 'none';
    }

    showView('catalog');
  } catch (error) {
    notify({ type: 'error', title: 'Error', message: 'No se pudieron cargar los cuestionarios del tema.' });
  }
}

// -------------------------------------------------------------
// 2. Evaluador Interactivo (Player)
// -------------------------------------------------------------
function startQuiz(questionnaireId) {
  try {
    currentQuiz = getQuestionnaireById(questionnaireId);
    currentQuestionIndex = 0;
    userAnswers = {};
    renderQuestion();
    showView('player');
  } catch (error) {
    notify({ type: 'error', title: 'Error al iniciar', message: friendlyMessage(error) });
  }
}

function renderQuestion() {
  const q = currentQuiz.questions[currentQuestionIndex];
  const total = currentQuiz.questions.length;
  const progressPercent = Math.round(((currentQuestionIndex + 1) / total) * 100);

  const isLast = currentQuestionIndex === total - 1;
  const isFirst = currentQuestionIndex === 0;
  const currentSelected = userAnswers[q.id];

  playerView.innerHTML = `
    <div class="q-player">
      <div class="q-player__nav">
        <button class="btn btn--ghost" id="q-player-cancel" style="min-height: 36px; padding: 0 0.75rem; font-size: 0.85rem;">
          ← Salir al tema
        </button>
        <span style="font-size: 0.85rem; font-weight: 700; color: var(--muted);">
          Pregunta ${currentQuestionIndex + 1} de ${total}
        </span>
      </div>

      <div class="q-player__progress-bar">
        <div class="q-player__progress-fill" style="width: ${progressPercent}%;"></div>
      </div>

      <div>
        <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--accent); letter-spacing: 0.05em;">
          ${currentQuiz.category}
        </span>
        <h2 class="q-player__question-text">${q.text}</h2>
      </div>

      <fieldset class="q-options" style="border: none; padding: 0; margin: 0;">
        <legend class="visually-hidden">Opciones de respuesta</legend>
        ${q.options
          .map((optText, optIndex) => {
            const isChecked = currentSelected === optIndex;
            return `
            <label class="q-option ${isChecked ? 'is-selected' : ''}">
              <input type="radio" name="question-${q.id}" value="${optIndex}" ${isChecked ? 'checked' : ''}>
              <span class="q-option__label">${optText}</span>
            </label>
          `;
          })
          .join('')}
      </fieldset>

      <div class="q-player__controls">
        <button class="btn btn--ghost" id="q-btn-prev" ${isFirst ? 'disabled' : ''}>
          ← Anterior
        </button>
        ${
          isLast
            ? `<button class="btn btn--primary" id="q-btn-submit">Finalizar y Calificar ✨</button>`
            : `<button class="btn btn--primary" id="q-btn-next">Siguiente →</button>`
        }
      </div>
    </div>
  `;

  document.getElementById('q-player-cancel').addEventListener('click', () => {
    if (confirm('¿Deseas salir del cuestionario? Tu progreso en esta sesión no se guardará.')) {
      renderTopicCatalog();
    }
  });

  playerView.querySelectorAll('input[type="radio"]').forEach((radio) => {
    radio.addEventListener('change', (e) => {
      userAnswers[q.id] = Number(e.target.value);
      playerView.querySelectorAll('.q-option').forEach((lbl) => lbl.classList.remove('is-selected'));
      radio.closest('.q-option').classList.add('is-selected');
    });
  });

  const prevBtn = document.getElementById('q-btn-prev');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        renderQuestion();
      }
    });
  }

  const nextBtn = document.getElementById('q-btn-next');
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (userAnswers[q.id] === undefined) {
        notify({ type: 'warning', title: 'Respuesta requerida', message: 'Selecciona una opción para continuar.' });
        return;
      }
      if (currentQuestionIndex < total - 1) {
        currentQuestionIndex++;
        renderQuestion();
      }
    });
  }

  const submitBtn = document.getElementById('q-btn-submit');
  if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
      if (userAnswers[q.id] === undefined) {
        notify({ type: 'warning', title: 'Respuesta requerida', message: 'Selecciona una opción para finalizar.' });
        return;
      }
      await finishQuiz();
    });
  }
}

// -------------------------------------------------------------
// 3. Pantalla de Resultados
// -------------------------------------------------------------
async function finishQuiz() {
  try {
    const result = await evaluateAndSaveAttempt(currentUser.id, currentQuiz.id, userAnswers);

    const scoreClass = result.passed ? 'q-score-badge--pass' : 'q-score-badge--fail';
    const statusText = result.passed ? '¡Aprobado con éxito!' : 'No alcanzaste el puntaje mínimo';
    const statusDesc = result.passed
      ? '¡Excelente trabajo! Has demostrado un gran dominio en este tema de Ciencias Sociales.'
      : 'Repasa el material y vuelve a intentarlo para mejorar tu calificación.';

    resultsView.innerHTML = `
      <div class="q-results">
        <div class="q-results__header">
          <div class="q-score-badge ${scoreClass}">
            <span class="q-score-badge__number">${result.percentage}%</span>
            <span class="q-score-badge__label">${result.passed ? 'Aprobado' : 'Reprobado'}</span>
          </div>
          <h2 style="font-size: 1.5rem; font-weight: 800; margin-top: 0.5rem;">${statusText}</h2>
          <p style="color: var(--muted); font-size: 0.95rem; max-width: 42ch;">${statusDesc}</p>
        </div>

        <div class="q-results__stats">
          <div class="q-stat-card">
            <div class="q-stat-card__value">${result.correctCount} / ${result.totalQuestions}</div>
            <div class="q-stat-card__label">Aciertos</div>
          </div>
          <div class="q-stat-card">
            <div class="q-stat-card__value">${result.percentage}%</div>
            <div class="q-stat-card__label">Calificación</div>
          </div>
          <div class="q-stat-card">
            <div class="q-stat-card__value">${result.passingPercentage}%</div>
            <div class="q-stat-card__label">Mínimo para aprobar</div>
          </div>
        </div>

        <div>
          <h3 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 0.75rem;">Revisión de respuestas</h3>
          <div class="q-review-list">
            ${result.review
              .map((item, idx) => {
                const isOk = item.isCorrect;
                const statusIcon = isOk ? '✅ Correcta' : '❌ Incorrecta';
                const itemClass = isOk ? 'q-review-item--correct' : 'q-review-item--incorrect';
                const yourChoice = item.selectedIndex !== null ? item.options[item.selectedIndex] : 'Sin responder';
                const correctChoice = item.options[item.correctIndex];

                return `
                <div class="q-review-item ${itemClass}">
                  <div class="q-review-item__header">
                    <span>Pregunta ${idx + 1}: ${item.text}</span>
                    <span style="font-size: 0.8rem; font-weight: 700; color: ${isOk ? 'var(--success)' : 'var(--danger)'};">
                      ${statusIcon}
                    </span>
                  </div>
                  <div style="font-size: 0.875rem; display: grid; gap: 0.25rem;">
                    <div><strong>Tu respuesta:</strong> <span style="color: ${isOk ? 'var(--success)' : 'var(--danger)'};">${yourChoice}</span></div>
                    ${!isOk ? `<div><strong>Respuesta correcta:</strong> <span style="color: var(--success); font-weight: 600;">${correctChoice}</span></div>` : ''}
                  </div>
                  <div class="q-review-item__explanation">
                    💡 <strong>Explicación:</strong> ${item.explanation}
                  </div>
                </div>
              `;
              })
              .join('')}
          </div>
        </div>

        <div style="display: flex; flex-wrap: wrap; gap: 1rem; justify-content: space-between; border-top: 1px solid var(--border); padding-top: 1.25rem;">
          <button class="btn btn--ghost" id="q-btn-return-catalog">
            ← Volver a cuestionarios de este tema
          </button>
          <button class="btn btn--primary" id="q-btn-retry">
            🔄 Reintentar este cuestionario
          </button>
        </div>
      </div>
    `;

    document.getElementById('q-btn-return-catalog').addEventListener('click', () => {
      renderTopicCatalog();
    });

    document.getElementById('q-btn-retry').addEventListener('click', () => {
      startQuiz(result.questionnaireId);
    });

    showView('results');
    notify({
      type: result.passed ? 'success' : 'warning',
      title: result.passed ? '¡Felicitaciones!' : 'Cuestionario completado',
      message: `Obtuviste ${result.percentage}% de calificación.`
    });
  } catch (error) {
    notify({ type: 'error', title: 'Error al calificar', message: friendlyMessage(error) });
  }
}

// -------------------------------------------------------------
// 4. Inicialización
// -------------------------------------------------------------
async function init() {
  showPendingFlash();

  try {
    const result = await getSession();

    if (result.status !== 'active') {
      flash({ type: 'info', title: 'Inicia sesión', message: 'Inicia sesión para ingresar a la práctica.' });
      location.replace('/login.html');
      return;
    }

    currentUser = result.user;
    currentTopic = getSelectedTopic();

    practiceMain.hidden = false;
    await renderTopicCatalog();
  } catch (error) {
    notify({ type: 'error', title: 'Error', message: friendlyMessage(error) });
  }
}

init();
