'use strict';
// Modo estricto.

import '../core/pwa.js';
// Solo se importa por su efecto secundario (registra el service worker, etc.);
// no se usa ningún export de este módulo aquí.
import { notify, flash, showPendingFlash } from '../core/notifications.js';
// Funciones para mostrar notificaciones: notify (toast inmediato), flash (mensaje que
// sobrevive a una redirección) y showPendingFlash (muestra el flash pendiente al cargar).
import { showStorageRecovery } from '../core/storage-recovery.js';
// Pantalla de recuperación si IndexedDB está bloqueado o dañado.
import { friendlyMessage } from '../core/errors.js';
// Convierte cualquier error en un mensaje seguro y amigable para mostrar al usuario.
import { getSession, logout, refreshAccount } from '../modules/auth/auth.service.js';
import { obtenerRanking, obtenerComparacion, cambiarOculto } from '../modules/cloud/nube.js';
// HU-29: datos en línea. HU-23 / HU-24: tabla de posiciones y comparación con el grupo.
import { solicitarVerificacion, motivoLegible } from '../modules/auth/verificacion.service.js';
// Funciones del servicio de autenticación: obtener sesión actual y cerrar sesión.
import {
  getTopicsWithStats,
  getQuestionnairesList,
  getUserAttempts
} from '../modules/questionnaires/questionnaires.service.js';
// Funciones del servicio de cuestionarios: temas con estadísticas e historial del usuario.
import { getSimulacrosDashboard } from '../modules/questionnaires/simulacros.service.js';
// Simulacros completos: listado con mejor resultado e historial.
import { getSeguidaSummary } from '../modules/questionnaires/seguidas.service.js';
// Practica tus conocimientos: sesión activa y mejor resultado.
import { calculatePoints } from '../modules/points/points.service.js';
// Sistema de puntos HU_20 (compartido con insignias y recompensas).
import { checkAchievements } from '../core/achievements-notify.js';
import { getAchievementsOverview } from '../modules/gamification/gamification.service.js';
import { calcularEstadisticas, calcularTemas, PERIODO, UMBRAL_REFUERZO } from '../modules/performance/performance.service.js';
// Desempeño del estudiante: estadísticas (HU_28) y temas con menor rendimiento (HU_27).

const home = document.getElementById('home');
// Contenedor principal de la página (oculto hasta confirmar que hay sesión activa).
const logoutButton = document.getElementById('logout');
// Botón para cerrar sesión.

// Elementos del perfil y avatar
const userAvatar = document.getElementById('user-avatar');
// Círculo con las iniciales del usuario.
const profileName = document.getElementById('profile-name');
// Elemento donde se muestra el nombre del usuario.
const profileEmail = document.getElementById('profile-email');
// Elemento donde se muestra el correo del usuario.
const profileLevel = document.getElementById('profile-level');
// Elemento donde se muestra un "nivel" gamificado según el desempeño.
const greeting = document.getElementById('greeting');
// Saludo de la pantalla Ruta ("¡Hola, Karen!").
const levelShort = document.getElementById('profile-level-short');
// "Nivel N" bajo el saludo.
const chipStreak = document.getElementById('chip-streak');
// Chip con los días seguidos practicando.
const chipPoints = document.getElementById('chip-points');
// Chip con los puntos acumulados.
const routeSvg = document.getElementById('route-svg');
// Mapa de la ruta (se dibuja con JS según el progreso real).
const routeCta = document.getElementById('route-cta');
// Botón grande bajo el mapa ("Continuar: Geografía").
const statCompleted = document.getElementById('stat-completed');
// Contador de cuestionarios completados.
const statPassed = document.getElementById('stat-passed');
// Contador de cuestionarios aprobados.
const statAvg = document.getElementById('stat-avg');
// Promedio de calificación.

// Contenedores de temas e historial
const topicsGrid = document.getElementById('topics-grid');
const simulacrosGrid = document.getElementById('simulacros-grid');
const simulacroHistoryContainer = document.getElementById('simulacro-history-container');
const simulacroHistoryTbody = document.getElementById('simulacro-history-tbody');

const seguidaCta = document.getElementById('seguidas-cta');
const seguidaCtaTitle = document.getElementById('seguidas-cta-title');
const seguidaCtaDesc = document.getElementById('seguidas-cta-desc');

// Pose de Grano para cada tema (imágenes en /img/grano/3d/).
const TOPIC_GRANO = { historia: 'historiador', geografia: 'geografo', constitucion: 'abogado', sociedad: 'cultura' };
const granoSrc = (topicId) => `/img/grano/3d/${TOPIC_GRANO[topicId] || 'idea'}.webp`;
// Contenedor donde se inyectan las tarjetas de los 4 temas.
const historyContainer = document.getElementById('q-history-container');
// Contenedor (tabla) que se muestra u oculta según si hay historial.
const historyTbody = document.getElementById('q-history-tbody');
// Cuerpo de la tabla de historial, donde se inyectan las filas.

const dateFormat = new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeStyle: 'short' });
// Formateador de fechas en español (Colombia), con fecha larga y hora corta
// (ej: "22 de septiembre de 2026, 10:30 a. m.").

function formatDuration(totalSeconds) {
  // Convierte segundos en un texto corto para la tabla de simulacros.
  const seconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes === 0) return `${rest} s`;
  return `${minutes} min ${rest} s`;
}

function renderSimulacros(list) {
  // Tarjetas de simulacros con el mejor resultado del usuario.
  if (!simulacrosGrid) return;
  simulacrosGrid.innerHTML = list
    .map((simulacro, index) => {
      const best = simulacro.bestScore !== null
        ? `<span class="sim-card__best ${simulacro.passed ? 'is-pass' : ''}">Mejor: ${simulacro.bestScore}%</span>`
        : '';
      const paused = simulacro.paused;
      const status = `<span class="sim-card__status">${paused ? '<span class="sim-card__paused">En pausa</span>' : ''}${best}</span>`;
      const pausedMeta = paused
        ? `<li>${paused.answeredCount}/${simulacro.questionCount} respondidas</li>
           <li>Quedan ${formatDuration(paused.remainingSeconds)}</li>`
        : '';
      const href = `/simulacro.html?id=${encodeURIComponent(simulacro.id)}${paused ? '&amp;resume=1' : ''}`;
      const label = paused
        ? 'Continuar simulacro'
        : (simulacro.attemptsCount ? 'Repetir simulacro' : 'Comenzar simulacro');

      return `
        <article class="sim-card sim-card--${(index % 3) + 1}">
          <div class="sim-card__top">
            <span class="sim-card__tag">${simulacro.badge}</span>
            ${status}
          </div>
          <h3 class="sim-card__title">${simulacro.title}</h3>
          <p class="sim-card__desc">${simulacro.description}</p>
          <ul class="sim-card__meta">
            <li>${simulacro.questionCount} preguntas</li>
            <li>${simulacro.durationMinutes} min</li>
            <li>${simulacro.areaCount} áreas</li>
            ${pausedMeta}
          </ul>
          <a class="btn btn--primary btn--link" href="${href}">
            ${label}
          </a>
        </article>`;
    })
    .join('');
}

function renderSimulacroHistory(history) {
  // Historial de pruebas completas, separado del historial de cuestionarios.
  if (!simulacroHistoryContainer || !simulacroHistoryTbody) return;

  if (history.length === 0) {
    simulacroHistoryContainer.hidden = true;
    return;
  }

  simulacroHistoryTbody.innerHTML = history
    .map((attempt) => {
      const dateStr = dateFormat.format(new Date(attempt.createdAt));
      const statusText = attempt.passed ? 'Aprobado' : 'No aprobado';
      return `
        <tr>
          <td>
            <strong>${attempt.questionnaireTitle || 'Simulacro'}</strong>
            <div class="cell-sub">${attempt.totalQuestions || 0} preguntas</div>
          </td>
          <td>
            <span class="pill ${attempt.passed ? 'pill--ok' : 'pill--bad'}">
              ${attempt.percentage}% (${statusText})
            </span>
          </td>
          <td>${attempt.correctCount} / ${attempt.totalQuestions}</td>
          <td>${formatDuration(attempt.durationSeconds)}</td>
          <td class="cell-date">${dateStr}</td>
        </tr>`;
    })
    .join('');

  simulacroHistoryContainer.hidden = false;
}

function renderSeguidaCta(summary) {
  // La tarjeta de Práctica muestra si hay una sesión guardada o el mejor resultado.
  if (!seguidaCta || !seguidaCtaTitle || !seguidaCtaDesc) return;

  const progress = summary ? summary.progress : null;
  const bestScore = summary ? summary.bestScore : null;

  if (progress) {
    const respondidas = progress.answeredCount === 1
      ? '1 respondida'
      : `${progress.answeredCount} respondidas`;
    seguidaCta.href = '/seguidas.html';
    seguidaCtaTitle.textContent = 'Continuar practicando';
    seguidaCtaDesc.textContent =
      `Vas por la pregunta ${progress.currentIndex + 1} de ${progress.total} · ${respondidas}`;
    return;
  }

  seguidaCta.href = '/seguidas.html';
  seguidaCtaTitle.textContent = 'Practica tus conocimientos';
  seguidaCtaDesc.textContent = bestScore !== null
    ? `Preguntas tipo ICFES, una tras otra · mejor resultado: ${bestScore}%`
    : 'Preguntas tipo ICFES, una tras otra, con dificultad creciente';
}

let currentUser = null;
// Variable de estado a nivel de módulo: guarda el usuario autenticado actual.

function getInitials(name) {
  // Calcula las iniciales a mostrar en el avatar circular a partir del nombre completo.
  if (!name) return 'CS';
  // Si no hay nombre (caso raro), usa "CS" (Ciencias Sociales) como valor por defecto.
  const parts = name.trim().split(/\s+/);
  // Separa el nombre en palabras, usando cualquier cantidad de espacios como separador.
  if (parts.length >= 2) {
    // Si hay al menos nombre y apellido...
    return (parts[0][0] + parts[1][0]).toUpperCase();
    // Toma la primera letra de la primera palabra y la primera letra de la segunda, en mayúsculas.
  }
  return name.slice(0, 2).toUpperCase();
  // Si solo hay una palabra, toma sus dos primeras letras.
}

const SVG_NS = 'http://www.w3.org/2000/svg';
// Espacio de nombres necesario para crear elementos SVG desde JS.

const SHORT_NAMES = {
  historia: 'Historia',
  geografia: 'Geografía',
  constitucion: 'Constitución',
  sociedad: 'Sociedad'
};
// Nombres cortos para las etiquetas del mapa.

// Cada tema es una unidad: franja de color con su nombre y, debajo, el botón redondo del tema.
const NODE_X = [160, 210, 226, 210, 160, 110, 94, 110];
const TOPIC_ICON = {
  historia: 'M4 5.5C6.5 4.5 9.5 4.5 12 6c2.5-1.5 5.5-1.5 8-.5v13c-2.5-1-5.5-1-8 .5-2.5-1.5-5.5-1.5-8-.5z M12 6v13.5',
  geografia: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z M12 3c-3.5 3-3.5 15 0 18 M12 3c3.5 3 3.5 15 0 18 M3 12h18',
  constitucion: 'M12 4v15 M7 20h10 M4.5 7.5h15 M4.5 7.5l-2.5 6.5a2.8 2.8 0 0 0 5.6 0z M19.5 7.5l-2.5 6.5a2.8 2.8 0 0 0 5.6 0z',
  sociedad: 'M9 5a3 3 0 1 0 0 6a3 3 0 1 0 0-6z M17 7a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5z M3 20c0-3.6 2.7-6 6-6s6 2.4 6 6 M15.5 14.5c3 0 5.5 1.7 5.5 5'
};
// Iconos de trazo de lo que representa cada tema (libro, globo, balanza, personas).

function svgEl(name, attrs = {}, parent) {
  // Crea un elemento SVG con sus atributos (los colores van en clases CSS por la CSP).
  const el = document.createElementNS(SVG_NS, name);
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
  if (parent) parent.appendChild(el);
  return el;
}

function drawRoute(topics, quizzes) {
  // Dibuja la ruta paso a paso: cada tema es una unidad y cada cuestionario, un botón.
  // Cuestionario aprobado = hecho, primero sin aprobar = actual, el resto = bloqueado.
  routeSvg.replaceChildren();
  const steps = [];
  topics.forEach((topic, u) => {
    quizzes
      .filter((q) => q.category === topic.category)
      .forEach((quiz) => steps.push({ topic, quiz, unit: u }));
  });
  const doneFlags = steps.map((s) => s.quiz.passed);
  const currentIndex = doneFlags.indexOf(false);
  // -1 si el usuario ya aprobó todos los cuestionarios.
  const stateOf = (i) => (doneFlags[i] ? 'done' : i === currentIndex ? 'now' : 'locked');

  const R = 38;
  const DEPTH = 9;
  const BANNER_H = 62;
  const PITCH = 142;
  const nodeCount = (u) => steps.filter((s) => s.unit === u).length;

  // Alturas de cada unidad: franja + sus botones.
  let cursorY = 8;
  const unitTops = topics.map((t, u) => {
    const top = cursorY;
    cursorY += BANNER_H + 26 + nodeCount(u) * PITCH + 18;
    return top;
  });
  routeSvg.setAttribute('viewBox', `0 0 320 ${cursorY + 190}`);

  // Franjas de color de cada tema.
  topics.forEach((topic, u) => {
    const top = unitTops[u];
    const banner = svgEl('g', { class: `rm-unit rm-c-${topic.id}` }, routeSvg);
    svgEl('rect', { class: 'rm-unit__bg', x: 12, y: top, width: 296, height: BANNER_H, rx: 18 }, banner);
    svgEl('text', { class: 'rm-unit__kicker', x: 30, y: top + 25 }, banner).textContent = `Tema ${u + 1}`;
    svgEl('text', { class: 'rm-unit__name', x: 30, y: top + 48 }, banner).textContent = SHORT_NAMES[topic.id] || topic.category;
  });

  // Botones: uno por cuestionario, en una curva continua de lado a lado.
  const seen = {};
  steps.forEach((step, i) => {
    const { topic, quiz, unit } = step;
    const state = stateOf(i);
    const k = seen[unit] || 0;
    seen[unit] = k + 1;
    const x = NODE_X[i % NODE_X.length];
    const y = unitTops[unit] + BANNER_H + 26 + k * PITCH + R + 4;
    const label = quiz.shortTitle || 'Repaso general';

    let group;
    if (state === 'locked') {
      group = svgEl('g', { class: `rm-node rm-node--locked rm-c-${topic.id}`, 'aria-label': `${label} (bloqueado)` }, routeSvg);
    } else {
      group = svgEl('a', {
        href: `/practice.html?topic=${topic.id}&quiz=${quiz.id}`,
        class: `rm-node rm-node--${state} rm-c-${topic.id}`,
        'aria-label': `${state === 'now' ? '¡Sigue aquí! ' : ''}${label}: practicar`
      }, routeSvg);
    }

    if (state === 'now') {
      svgEl('circle', { class: 'rm-halo', cx: x, cy: y, r: R + 12 }, group);
      // Grano con la pose del tema, a un lado del botón, esperando.
      const left = x >= 160;
      svgEl('image', {
        class: 'rm-grano',
        href: granoSrc(topic.id),
        x: left ? x - R - 100 : x + R + 12,
        y: y - 44,
        width: 90,
        height: 86,
        preserveAspectRatio: 'xMidYMid meet'
      }, group);
    }

    // Botón redondo con grosor (base más oscura debajo) y el icono del tema.
    svgEl('circle', { class: 'rm-base', cx: x, cy: y + DEPTH, r: R }, group);
    svgEl('circle', { class: 'rm-disc', cx: x, cy: y, r: R }, group);
    svgEl('path', { class: 'rm-shine', d: `M${x - 26} ${y - 8} a28 28 0 0 1 30 -22` }, group);
    const icon = svgEl('g', { class: 'rm-icon', transform: `translate(${x - 16} ${y - 16}) scale(1.33)` }, group);
    svgEl('path', { d: TOPIC_ICON[topic.id] }, icon);

    let below = y + R + DEPTH + 18;
    if (state === 'done') {
      svgEl('circle', { class: 'rm-badge', cx: x + 28, cy: y + 30, r: 12 }, group);
      svgEl('path', { class: 'rm-check', d: `M${x + 22.5} ${y + 30} l4 4 l7 -8` }, group);
    } else if (state === 'locked') {
      svgEl('circle', { class: 'rm-badge rm-badge--lock', cx: x + 28, cy: y + 30, r: 12 }, group);
      svgEl('rect', { class: 'rm-lock', x: x + 23.5, y: y + 29.5, width: 9, height: 7, rx: 1.5 }, group);
      svgEl('path', { class: 'rm-lock-arc', d: `M${x + 25.5} ${y + 29.5} v-2 a2.5 2.5 0 0 1 5 0 v2` }, group);
    } else {
      svgEl('rect', { class: 'rm-pill', x: x - 40, y: y + R + DEPTH + 6, width: 80, height: 22, rx: 11 }, group);
      svgEl('text', { class: 'rm-pill__text', x, y: y + R + DEPTH + 21, 'text-anchor': 'middle' }, group).textContent = 'EMPEZAR';
      below += 28;
    }
    svgEl('text', { class: 'rm-step-name', x, y: below, 'text-anchor': 'middle' }, group).textContent = label;
  });

  // Meta: Simulacro ICFES completo, disponible al final de la ruta.
  const gy = cursorY + 36;
  const goalGroup = svgEl('a', {
    href: '/simulacro.html',
    class: 'rm-node rm-node--goal rm-c-meta',
    'aria-label': 'Simulacro ICFES: prueba completa'
  }, routeSvg);
  svgEl('circle', { class: 'rm-base', cx: 160, cy: gy + DEPTH, r: R }, goalGroup);
  svgEl('circle', { class: 'rm-disc', cx: 160, cy: gy, r: R }, goalGroup);
  svgEl('path', { class: 'rm-shine', d: `M${160 - 26} ${gy - 8} a28 28 0 0 1 30 -22` }, goalGroup);
  svgEl('path', { class: 'rt-flag', d: `M${160 - 9} ${gy - 14} v28 M${160 - 9} ${gy - 14} h19 l-5 7 l5 7 h-19` }, goalGroup);
  svgEl('rect', { class: 'rm-pill', x: 160 - 52, y: gy + R + DEPTH + 10, width: 104, height: 24, rx: 12 }, goalGroup);
  svgEl('text', { class: 'rm-pill__text', x: 160, y: gy + R + DEPTH + 27, 'text-anchor': 'middle' }, goalGroup).textContent = 'EMPEZAR';
  svgEl('text', { class: 'rm-goal-name', x: 160, y: gy + R + DEPTH + 54, 'text-anchor': 'middle' }, goalGroup).textContent = 'Simulacro ICFES';

  // Botón principal bajo el mapa y tarjeta "Siguiente" (pantallas grandes).
  const approved = doneFlags.filter(Boolean).length;
  document.getElementById('route-progress').style.width = `${steps.length ? (approved / steps.length) * 100 : 0}%`;
  document.getElementById('route-progress-text').textContent =
    `${approved} de ${steps.length} cuestionarios aprobados`;
  if (currentIndex === -1) {
    routeCta.textContent = 'Ruta completada: ir a práctica libre';
    routeCta.href = '/sesion.html';
    document.getElementById('next-kicker').textContent = 'Ruta completada';
    document.getElementById('next-title').textContent = 'Aprobaste todos los cuestionarios';
    document.getElementById('next-desc').textContent = 'Sigue repasando con la práctica libre y mejora tu promedio.';
    document.getElementById('next-grano').src = '/img/grano/3d/medalla.webp';
  } else {
    const { topic, quiz } = steps[currentIndex];
    routeCta.textContent = `Continuar: ${quiz.shortTitle || SHORT_NAMES[topic.id] || topic.category}`;
    routeCta.href = `/practice.html?topic=${topic.id}&quiz=${quiz.id}`;
    document.getElementById('next-kicker').textContent = `Siguiente · ${SHORT_NAMES[topic.id] || topic.category}`;
    document.getElementById('next-title').textContent = quiz.title;
    document.getElementById('next-desc').textContent = quiz.description;
    document.getElementById('next-grano').src = granoSrc(topic.id);
  }

  // Lista de estado de los temas (un tema está hecho cuando se aprobaron todos sus cuestionarios).
  const STATUS = { done: 'Aprobado', now: 'En curso', locked: 'Pendiente' };
  const topicState = (u) => {
    const mine = steps.map((s, i) => ({ s, i })).filter(({ s }) => s.unit === u);
    if (mine.length && mine.every(({ i }) => doneFlags[i])) return 'done';
    if (mine.some(({ i }) => i === currentIndex)) return 'now';
    return 'locked';
  };
  document.getElementById('topic-list').innerHTML = topics
    .map((t, u) => {
      const state = topicState(u);
      const passed = steps.filter((s, i) => s.unit === u && doneFlags[i]).length;
      const total = nodeCount(u);
      const link = state === 'locked'
        ? ''
        : `<a class="topic-row__go btn--link" href="/practice.html?topic=${t.id}">${state === 'done' ? 'Repasar' : 'Practicar'}</a>`;
      return `
        <li class="topic-row topic-row--${state}">
          <span class="topic-grano topic-grano--${t.id}" aria-hidden="true"><img src="${granoSrc(t.id)}" alt="" width="56" height="56" loading="lazy"></span>
          <span class="topic-row__text">
            <span class="topic-row__name">${t.name}</span>
            <span class="topic-row__status">${STATUS[state]} · ${passed} de ${total}</span>
          </span>
          ${link}
        </li>`;
    })
    .join('');
}

function dayKey(date) {
  // Clave "año-mes-día" en hora local, para comparar días.
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function calcStreak(history) {
  // Días seguidos con al menos un intento, contando hacia atrás desde hoy (o desde ayer).
  const days = new Set(history.map((h) => dayKey(new Date(h.createdAt))));
  const cursor = new Date();
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function esc(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function achievementCard(item) {
  const visual = `<img class="ach-card__img" src="${esc(item.image)}" alt="" width="56" height="56" loading="lazy">`;
  const pct = Math.max(0, Math.min(100, Math.round((item.progress / item.target) * 100)));
  const status = item.earned
    ? `<span class="ach-card__status">${item.reusable && item.count > 1 ? `Obtenida ×${item.count}` : 'Obtenida'}</span>`
    : `<span class="ach-card__status ach-card__status--pending">Pendiente</span>`;
  const bar = item.earned && !item.reusable
    ? ''
    : `<div class="progress" aria-hidden="true"><div class="progress__bar" data-pct="${pct}"></div></div>
       <p class="ach-card__meta">${item.progress} / ${item.target}</p>`;
  return `
    <li class="ach-card ${item.earned ? 'is-earned' : 'is-locked'}">
      ${visual}
      <div class="ach-card__body">
        <p class="ach-card__name">${esc(item.name)} ${status}</p>
        <p class="ach-card__desc">${esc(item.description)}</p>
        <p class="ach-card__goal">Objetivo: ${esc(item.goal)}</p>
        ${bar}
      </div>
    </li>`;
}

// ---------- HU_28: estadísticas de desempeño ----------
const fechaCorta = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' });

function drawEvolution(puntos) {
  // Gráfico de línea del puntaje (0 a 100 %) en las últimas actividades. Los colores van en
  // clases CSS (la CSP no permite estilos en línea) y cada punto muestra su detalle al tocarlo.
  const box = document.getElementById('perf-chart');
  const tip = document.getElementById('perf-chart-tip');
  const empty = document.getElementById('perf-chart-empty');
  box.replaceChildren();
  const ayuda = `La línea punteada marca el aprobado (${UMBRAL_REFUERZO}%). Toca un punto para ver su detalle.`;
  tip.textContent = puntos.length ? ayuda : '';
  empty.hidden = puntos.length > 0;
  if (!puntos.length) return;

  const W = 320, H = 168, L = 34, R = 14, T = 12, B = 26;
  const x = (i) => (puntos.length === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (puntos.length - 1));
  const y = (v) => T + ((100 - v) * (H - T - B)) / 100;
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'perf-chart__svg', role: 'img',
    'aria-label': `Puntaje de tus últimas ${puntos.length} actividades, de ${puntos[0].porcentaje}% a ${puntos[puntos.length - 1].porcentaje}%` }, box);

  [0, 50, 100].forEach((v) => {
    svgEl('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'perf-chart__grid' }, svg);
    svgEl('text', { x: L - 6, y: y(v) + 4, class: 'perf-chart__axis', 'text-anchor': 'end' }, svg).textContent = `${v}%`;
  });
  // Línea de aprobación (60 %), punteada; su nombre va en la nota de abajo para no tapar la línea.
  svgEl('line', { x1: L, x2: W - R, y1: y(UMBRAL_REFUERZO), y2: y(UMBRAL_REFUERZO), class: 'perf-chart__pass' }, svg);

  if (puntos.length > 1) {
    svgEl('polyline', { points: puntos.map((p, i) => `${x(i)},${y(p.porcentaje)}`).join(' '), class: 'perf-chart__line' }, svg);
  }
  const primero = puntos[0];
  const ultimo = puntos[puntos.length - 1];
  svgEl('text', { x: L, y: H - 6, class: 'perf-chart__axis' }, svg).textContent = fechaCorta.format(primero.fecha);
  if (puntos.length > 1) {
    svgEl('text', { x: W - R, y: H - 6, class: 'perf-chart__axis', 'text-anchor': 'end' }, svg).textContent = fechaCorta.format(ultimo.fecha);
  }

  const detalle = (p) => `${p.actividad}, ${fechaCorta.format(p.fecha)}: ${p.porcentaje}%`;
  let activo = null;
  puntos.forEach((p, i) => {
    const punto = svgEl('circle', { cx: x(i), cy: y(p.porcentaje), r: 4, class: 'perf-chart__dot' }, svg);
    // Zona de toque más grande que el punto, para usarlo con el dedo.
    const zona = svgEl('circle', { cx: x(i), cy: y(p.porcentaje), r: 13, class: 'perf-chart__hit', tabindex: 0,
      role: 'button', 'aria-label': detalle(p) }, svg);
    const mostrar = () => {
      if (activo) activo.classList.remove('is-active');
      activo = punto;
      punto.classList.add('is-active');
      tip.textContent = detalle(p);
    };
    zona.addEventListener('pointerenter', mostrar);
    zona.addEventListener('click', mostrar);
    zona.addEventListener('focus', mostrar);
  });
  // Solo el último punto lleva su valor escrito; el resto se ve al tocarlo.
  svgEl('text', { x: x(puntos.length - 1), y: y(ultimo.porcentaje) - 10, class: 'perf-chart__value',
    'text-anchor': puntos.length === 1 ? 'middle' : 'end' }, svg).textContent = `${ultimo.porcentaje}%`;
}

function renderPerformance(historial) {
  const est = calcularEstadisticas(historial);
  document.getElementById('perf-best').textContent = `${est.mejorPuntaje}%`;
  document.getElementById('perf-sims').textContent = est.simulacros;

  const trend = document.getElementById('perf-trend');
  const note = document.getElementById('perf-trend-note');
  trend.classList.remove('is-up', 'is-down');
  if (est.mejora) {
    const d = est.mejora.puntos;
    trend.textContent = `${d > 0 ? '+' : ''}${d} pts`;
    if (d > 0) trend.classList.add('is-up');
    if (d < 0) trend.classList.add('is-down');
    note.textContent = `Mejora: promedio de tus últimas ${PERIODO} actividades (${est.mejora.actual}%) frente a las ${PERIODO} anteriores (${est.mejora.anterior}%).`;
  } else {
    trend.textContent = '—';
    const faltan = PERIODO * 2 - est.total;
    note.textContent = `Para calcular tu mejora necesitas ${PERIODO * 2} actividades; ${faltan === 1 ? 'te falta 1' : `te faltan ${faltan}`}.`;
  }
  document.getElementById('perf-chart-sub').textContent = est.evolucion.length > 1 ? `(últimas ${est.evolucion.length} actividades)` : '';
  drawEvolution(est.evolucion);
}

// ---------- HU_27: temas con menor rendimiento ----------
function renderWeakTopics(historial) {
  const { temas, sugeridos, todosSobreUmbral } = calcularTemas(historial);
  const advice = document.getElementById('weak-advice');
  const nombre = (id) => temas.find((t) => t.id === id).nombre;

  if (!sugeridos.length) {
    advice.textContent = 'Aún no tienes resultados. Haz un cuestionario o un simulacro para conocer tus temas a reforzar.';
  } else if (todosSobreUmbral) {
    advice.textContent = `Vas bien: todos tus temas están sobre ${UMBRAL_REFUERZO}%. Para seguir subiendo, practica ${nombre(sugeridos[0])}.`;
  } else {
    const lista = sugeridos.map(nombre);
    const texto = lista.length > 1 ? `${lista.slice(0, -1).join(', ')} y ${lista[lista.length - 1]}` : lista[0];
    advice.textContent = `Te sugerimos practicar ${texto}: ${lista.length > 1 ? 'están' : 'está'} por debajo de ${UMBRAL_REFUERZO}%.`;
  }

  const el = document.getElementById('weak-list');
  el.innerHTML = temas.map((t) => {
    const sinDatos = t.porcentaje === null;
    const reforzar = !sinDatos && t.porcentaje < UMBRAL_REFUERZO;
    const estado = sinDatos ? 'Sin datos' : reforzar ? 'Reforzar' : 'Bien';
    return `
      <li class="weak-row${reforzar ? ' is-weak' : ''}${sinDatos ? ' is-empty' : ''}">
        <div class="weak-row__head">
          <span class="weak-row__name">${esc(t.nombre)}</span>
          <span class="weak-row__pct">${sinDatos ? '—' : `${t.porcentaje}%`}</span>
        </div>
        <div class="weak-row__bar" aria-hidden="true"><div class="weak-row__fill" data-pct="${sinDatos ? 0 : t.porcentaje}"></div></div>
        <div class="weak-row__foot">
          <span class="weak-row__state">${estado}${sinDatos ? '' : ` · ${t.correctas} de ${t.total} correctas`}</span>
          <a class="weak-row__go btn--link" href="/practice.html?topic=${esc(t.id)}">Practicar</a>
        </div>
      </li>`;
  }).join('');
  // El ancho se pone desde JavaScript: la CSP bloquea los style="" del HTML.
  el.querySelectorAll('.weak-row__fill[data-pct]').forEach((bar) => { bar.style.width = `${bar.dataset.pct}%`; });
}

function renderAchievements(overview) {
  const fill = (id, list) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = list.map((item) => achievementCard(item)).join('');
    // El ancho se pone desde JavaScript: la política de seguridad (CSP) bloquea los style="" del HTML.
    el.querySelectorAll('.progress__bar[data-pct]').forEach((bar) => { bar.style.width = `${bar.dataset.pct}%`; });
  };
  fill('badges-list', overview.badges);
  fill('rewards-list', overview.rewards);
  const badgeCount = document.getElementById('badges-count');
  const rewardCount = document.getElementById('rewards-count');
  if (badgeCount) badgeCount.textContent = `${overview.badges.filter((b) => b.earned).length} de ${overview.badges.length}`;
  if (rewardCount) rewardCount.textContent = `${overview.rewards.filter((r) => r.earned).length} de ${overview.rewards.length}`;
}

async function loadHomeData() {
  // Carga y renderiza toda la información dinámica de la página principal (estadísticas,
  // temas y tabla de historial). Se puede volver a llamar cuando el usuario regresa a la pestaña.
  if (!currentUser) return;
  // Salvaguarda: si aún no se ha resuelto el usuario actual, no hace nada.

  try {
    const topics = await getTopicsWithStats(currentUser.id);
    // Trae los 4 temas con sus estadísticas para este usuario.
    const history = await getUserAttempts(currentUser.id);
    // Trae el historial completo de intentos del usuario.
    const simulacros = await getSimulacrosDashboard(currentUser.id);
    // Simulacros: tarjetas con mejor resultado e historial de pruebas completas.
    const seguida = await getSeguidaSummary(currentUser.id);
    // Practica tus conocimientos: progreso guardado y mejor resultado.

    // 1. Métricas del perfil
    const totalAttempts = history.length;
    // Cantidad total de intentos realizados.
    const passedCount = history.filter((h) => h.passed).length;
    // Cantidad de intentos aprobados.
    const avgScore = totalAttempts > 0
      ? Math.round(history.reduce((acc, h) => acc + h.percentage, 0) / totalAttempts)
      : 0;
    // Promedio de porcentaje de todos los intentos (0 si no hay ninguno, para evitar división por cero).

    statCompleted.textContent = totalAttempts;
    // Muestra el total de intentos en el DOM.
    statPassed.textContent = passedCount;
    // Muestra el total de aprobados.
    statAvg.textContent = `${avgScore}%`;
    // Muestra el promedio con el símbolo de porcentaje.

    const streak = calcStreak(history);
    const points = calculatePoints(history);
    // 10 puntos por cada respuesta correcta en cualquier cuestionario, práctica libre o simulacro.
    chipStreak.textContent = `Racha ${streak} ${streak === 1 ? 'día' : 'días'}`;
    chipPoints.textContent = `Puntos ${points}`;
    levelShort.textContent = `Nivel ${1 + passedCount}`;
    document.getElementById('tile-streak').textContent = streak;
    document.getElementById('tile-points').textContent = points;
    document.getElementById('tile-level').textContent = 1 + passedCount;

    if (passedCount >= 4) {
      // Sistema simple de "niveles" gamificados según cuántos cuestionarios ha aprobado.
      profileLevel.textContent = 'Maestro en Ciencias Sociales';
    } else if (passedCount >= 2) {
      profileLevel.textContent = 'Investigador Social';
    } else if (passedCount >= 1) {
      profileLevel.textContent = 'Estudiante Activo';
    } else {
      profileLevel.textContent = 'Explorador Social';
      // Nivel por defecto para quien aún no ha aprobado ninguno.
    }

    // 2. Mapa de la ruta y tarjetas de los 4 temas de Ciencias Sociales
    drawRoute(topics, await getQuestionnairesList(currentUser.id));
    topicsGrid.innerHTML = topics
      .map((t) => {
        // Por cada tema, construye el HTML de su tarjeta.
        let statsBadge = '';
        // Insignia opcional que solo aparece si el usuario ya intentó algo de este tema.
        if (t.attemptsCount > 0) {
          statsBadge = `<span class="q-card__badge q-card__badge--success">${t.passedCount} aprobados</span>`;
        }

        return `
        <article class="q-card">
          <div class="q-card__top">
            <img class="q-card__grano" src="${granoSrc(t.id)}" alt="" width="120" height="100" loading="lazy">
            <div class="q-card__badges">
              <span class="q-card__badge">${t.badge}</span>
              ${statsBadge}
            </div>
          </div>
          <h3 class="q-card__title">${t.name}</h3>
          <p class="q-card__desc">${t.description}</p>
          <div class="q-card__meta">
            <span>${t.questionnairesCount} cuestionario(s)</span>
            <span>${t.totalQuestions} preguntas</span>
          </div>
          <a href="/practice.html?topic=${t.id}" class="btn btn--primary q-card__btn btn--link">
            Practicar este tema
          </a>
        </article>
      `;
        // El enlace "Practicar este tema" abre practice.html?topic=<id> pasando el id del
        // tema como parámetro de URL.
      })
      .join('');
    // Une todas las tarjetas generadas en un solo string HTML y lo inyecta de una vez.

    // 3. Renderizar historial general
    if (history.length > 0) {
      // Solo se construye la tabla si hay al menos un intento registrado.
      historyTbody.innerHTML = history
        .map((att) => {
          // Por cada intento del historial, construye una fila de tabla.
          const dateStr = dateFormat.format(new Date(att.createdAt));
          // Formatea la fecha de creación del intento a texto legible en español.
          // Color del texto de la insignia según si aprobó o no (variables CSS del tema).
          // Color de fondo suave, a juego con el color de texto.
          const statusText = att.passed ? 'Aprobado' : 'No aprobado';
          // Texto descriptivo del resultado.

          return `
          <tr>
            <td>
              <strong>${att.questionnaireTitle || 'Cuestionario'}</strong>
              <div class="cell-sub">${att.category || ''}</div>
            </td>
            <td>
              <span class="pill ${att.passed ? 'pill--ok' : 'pill--bad'}">
                ${att.percentage}% (${statusText})
              </span>
            </td>
            <td>${att.correctCount} / ${att.totalQuestions}</td>
            <td class="cell-date">${dateStr}</td>
          </tr>
        `;
        })
        .join('');
      // Une todas las filas y las inyecta en el <tbody>.
      historyContainer.hidden = false;
      // Muestra el contenedor de la tabla (por si estaba oculto).
    } else {
      historyContainer.hidden = true;
      // Si no hay historial, oculta la tabla completa.
    }

    // 4. Simulacros ICFES
    renderSimulacros(simulacros.list);
    renderSimulacroHistory(simulacros.history);
    renderSeguidaCta(seguida);

    // 5. Desempeño (HU_28) y temas a reforzar (HU_27), calculados con el mismo historial.
    renderPerformance(history);
    renderWeakTopics(history);

    // 6. Insignias y recompensas (HU_21 / HU_22): se otorga lo pendiente y se pinta el estado.
    await checkAchievements(currentUser.id);
    renderAchievements(await getAchievementsOverview(currentUser.id));

    // 7. Tabla de posiciones y comparación (HU_23 / HU_24). Necesitan internet; no bloquean lo demás.
    renderRanking();
  } catch (error) {
    // Si el fallo es del almacenamiento local, se muestra la pantalla de recuperación.
    if (showStorageRecovery(error)) return;
    // Si cualquiera de las consultas anteriores falla...
    notify({ type: 'error', title: 'Error', message: 'No se pudieron cargar los datos de Ciencias Sociales.' });
    // Muestra una notificación de error genérica al usuario.
  }
}

// ---------- HU_23 / HU_24: tabla de posiciones y comparación con el grupo ----------
const MENSAJE_RANKING = {
  'sin-conexion': 'Conéctate a internet para ver la tabla de posiciones.',
  'sin-sesion': 'Cierra sesión y vuelve a entrar con internet para ver la tabla de posiciones.',
  'sin-servidor': 'La tabla de posiciones estará disponible cuando el sitio tenga la base de datos en línea.',
  error: 'No se pudo cargar la tabla de posiciones. Inténtalo más tarde.',
};

async function renderRanking() {
  const status = document.getElementById('rank-status');
  const body = document.getElementById('rank-body');
  if (!status || !body) return;
  const [ranking, cmp] = await Promise.all([obtenerRanking(), obtenerComparacion()]);
  if (ranking.estado !== 'ok') {
    status.textContent = MENSAJE_RANKING[ranking.estado] || MENSAJE_RANKING.error;
    status.hidden = false;
    body.hidden = true;
    return;
  }

  // HU_24: comparación con el promedio general.
  const mine = document.getElementById('cmp-mine');
  const all = document.getElementById('cmp-all');
  const note = document.getElementById('cmp-note');
  if (cmp.estado === 'ok') {
    mine.textContent = cmp.miPromedio === null ? '—' : `${cmp.miPromedio}%`;
    all.textContent = cmp.promedioGeneral === null ? '—' : `${cmp.promedioGeneral}%`;
    document.getElementById('cmp-all-lbl').textContent = `Promedio general (${cmp.estudiantes} ${cmp.estudiantes === 1 ? 'estudiante' : 'estudiantes'})`;
    if (cmp.miPromedio === null) {
      note.textContent = 'Termina una actividad para compararte con el grupo.';
    } else if (cmp.promedioGeneral !== null) {
      const d = cmp.miPromedio - cmp.promedioGeneral;
      const pts = (n) => `${n} ${n === 1 ? 'punto' : 'puntos'}`;
      note.textContent = d > 0 ? `Estás ${pts(d)} por encima del promedio general.`
        : d < 0 ? `Estás ${pts(-d)} por debajo del promedio general. ¡Sigue practicando!`
          : 'Estás justo en el promedio general.';
    }
  } else {
    note.textContent = '';
  }

  // HU_23: tabla ordenada de mayor a menor puntaje; solo nombre + inicial y puntos.
  const list = document.getElementById('rank-list');
  let previa = 0;
  list.innerHTML = ranking.tabla.map((fila) => {
    const salto = fila.posicion > previa + 1 && previa > 0 && fila.soyYo;
    previa = fila.posicion;
    return `
      <li class="rank-row${fila.soyYo ? ' is-me' : ''}${salto ? ' is-gap' : ''}">
        <span class="rank-row__pos">${fila.posicion}.</span>
        <span class="rank-row__name">${esc(fila.nombre)}${fila.soyYo ? ' (tú)' : ''}</span>
        <span class="rank-row__pts">${fila.puntos.toLocaleString('es-CO')} pts</span>
      </li>`;
  }).join('');
  if (!ranking.tabla.length) {
    status.textContent = 'Todavía nadie tiene puntos. ¡Termina una actividad y sé el primero!';
    status.hidden = false;
  } else {
    status.textContent = ranking.yo.posicion
      ? `Vas en el puesto ${ranking.yo.posicion} de ${ranking.participantes}.`
      : 'Aún no tienes puntos: termina una actividad para entrar a la tabla.';
    status.hidden = false;
  }
  body.hidden = false;

  // HU_24: ocultarse de las comparaciones públicas.
  const hide = document.getElementById('rank-hide');
  hide.checked = Boolean(ranking.yo.oculto);
  if (!hide.dataset.listo) {
    hide.dataset.listo = '1';
    hide.addEventListener('change', async () => {
      hide.disabled = true;
      const r = await cambiarOculto(hide.checked);
      hide.disabled = false;
      if (r.estado !== 'ok') {
        hide.checked = !hide.checked;
        notify({ type: 'error', title: 'No se pudo guardar', message: MENSAJE_RANKING[r.estado] || MENSAJE_RANKING.error });
        return;
      }
      notify({ type: 'success', title: r.oculto ? 'Ya no apareces' : 'Vuelves a aparecer', message: r.oculto ? 'Tus compañeros ya no te ven en la tabla ni en el promedio.' : 'Tus compañeros te verán en la tabla de posiciones.' });
      renderRanking();
    });
  }
}

// Estado del correo (HU-00): etiqueta en el perfil y botón para reenviar el correo de verificación.
const ESPERA_REENVIO_MS = 60 * 1000;
let ultimoReenvio = 0;

function renderVerificacion(user) {
  const etiqueta = document.getElementById('profile-verif');
  const boton = document.getElementById('resend-verif');
  if (!etiqueta || !boton) return;
  const verificado = Boolean(user.emailVerified);
  etiqueta.hidden = verificado;
  boton.hidden = verificado;
  if (boton.dataset.listo) return;
  boton.dataset.listo = '1';
  boton.addEventListener('click', async () => {
    const falta = ESPERA_REENVIO_MS - (Date.now() - ultimoReenvio);
    if (falta > 0) {
      notify({ type: 'info', title: 'Espera un momento', message: `Puedes pedir otro correo en ${Math.ceil(falta / 1000)} segundos.` });
      return;
    }
    ultimoReenvio = Date.now();
    boton.disabled = true;
    const envio = await solicitarVerificacion({ email: currentUser.email, nombre: currentUser.name.split(' ')[0] });
    boton.disabled = false;
    if (envio.ok) {
      notify({ type: 'success', title: 'Correo enviado', message: 'Revisa tu bandeja y el correo no deseado.' });
    } else {
      ultimoReenvio = 0;
      notify({ type: 'error', title: 'No se pudo enviar', message: motivoLegible(envio.motivo) });
    }
  });
}

function renderSessionInfo({ user, session }) {
  // Pinta en el DOM los datos del usuario y de la sesión (llamado una sola vez al iniciar).
  currentUser = user;
  // Guarda el usuario en la variable de módulo para que otras funciones puedan usarlo.
  userAvatar.textContent = getInitials(user.name);
  // Calcula y muestra las iniciales en el avatar.
  profileName.textContent = user.name;
  document.getElementById('side-name').textContent = user.name;
  greeting.textContent = `¡Hola, ${user.firstName || user.name.split(' ')[0]}!`;
  // Saludo con el primer nombre.
  // Muestra el nombre completo.
  profileEmail.textContent = user.email;
  // Muestra el correo (nota: puede venir vacío si el usuario se registró solo con documento).

  const emailEl = document.getElementById('user-email');
  // Busca un elemento adicional (probablemente en otra sección de la página, como un menú).
  const typeEl = document.getElementById('session-type');
  // Elemento que describe el tipo de sesión (persistente o temporal).
  const expEl = document.getElementById('session-expires');
  // Elemento que muestra cuándo expira la sesión.

  renderVerificacion(user);
  // HU-29: trae de la cuenta en línea si el correo ya se verificó (por ejemplo, desde otro dispositivo).
  refreshAccount().then((fresh) => {
    if (fresh) { currentUser = { ...currentUser, ...fresh }; renderVerificacion(fresh); }
  }).catch(() => {});
  if (emailEl) emailEl.textContent = user.email;
  // Solo actualiza si el elemento existe en el DOM (defensivo, por si cambia el HTML).
  if (typeEl) {
    typeEl.textContent = session.persistent
      ? 'Recordada: se mantiene 30 días en este dispositivo'
      : 'Temporal: dura 12 horas desde tu último uso';
    // Mensaje distinto según si el usuario marcó "recordarme" al iniciar sesión.
  }
  if (expEl) expEl.textContent = dateFormat.format(new Date(session.expiresAt));
  // Muestra la fecha/hora de expiración formateada.

  home.hidden = false;
  // Revela el contenido de la página (estaba oculto por defecto para evitar parpadeos
  // mientras se verifica la sesión).
}

async function init() {
  // Función de arranque de la página: verifica sesión y carga los datos.
  showPendingFlash();
  // Muestra cualquier mensaje "flash" que haya quedado pendiente de una página anterior
  // (por ejemplo, "Sesión iniciada" tras el login).

  try {
    const result = await getSession();
    // Consulta el estado de la sesión actual.

    if (result.status !== 'active') {
      // Si no hay sesión activa (puede ser 'expired' o 'none')...
      flash(
        result.status === 'expired'
          ? { type: 'warning', title: 'Tu sesión expiró', message: 'Inicia sesión de nuevo para continuar.' }
          : { type: 'info', title: 'Inicia sesión', message: 'Necesitas una cuenta activa para entrar.' }
      );
      // Prepara un mensaje flash distinto según el motivo exacto.
      location.replace(result.status === 'expired' ? '/login.html' : '/bienvenida.html');
      // Sesión vencida: directo al login con el aviso. Sin sesión: pantalla de bienvenida.
      return;
      // Corta la ejecución: no tiene sentido seguir cargando datos sin sesión.
    }

    renderSessionInfo(result);
    // Si hay sesión activa, pinta los datos de usuario/sesión.
    await loadHomeData();
    // Y carga las estadísticas y el historial.

    // Actualizar datos automáticamente si el usuario regresa a esta pestaña después de practicar
    window.addEventListener('focus', loadHomeData);
    // Cada vez que la ventana/pestaña recupera el foco se vuelven a cargar los datos para
    // reflejar nuevos intentos sin necesidad de recargar manualmente.
  } catch (error) {
    // Si getSession() falla por el almacenamiento local, se ofrece una salida
    // clara (reintentar o restablecer) en vez de dejar la página en blanco.
    if (showStorageRecovery(error)) return;
    // Si getSession() falla de forma inesperada...
    notify({ type: 'error', title: 'No se pudo verificar tu sesión', message: friendlyMessage(error) });
  }
}

// ---------- Pestañas Ruta / Práctica / Simulacro / Perfil ----------
const tabButtons = document.querySelectorAll('[data-tab]');
const panels = document.querySelectorAll('[data-panel]');
const TAB_NAMES = ['ruta', 'practica', 'simulacro', 'perfil'];

function showTab(name, { updateHash = true } = {}) {
  const tab = TAB_NAMES.includes(name) ? name : 'ruta';
  panels.forEach((panel) => { panel.hidden = panel.dataset.panel !== tab; });
  tabButtons.forEach((btn) => {
    const active = btn.dataset.tab === tab;
    btn.classList.toggle('is-active', active);
    if (active) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  });
  if (updateHash) history.replaceState(null, '', tab === 'ruta' ? location.pathname : `#${tab}`);
  window.scrollTo(0, 0);
}

tabButtons.forEach((btn) => btn.addEventListener('click', () => showTab(btn.dataset.tab)));
showTab(location.hash.slice(1), { updateHash: false });

const logoutModal = document.getElementById('logout-modal');
const logoutCancel = document.getElementById('logout-cancel');
const logoutConfirm = document.getElementById('logout-confirm');

// HU-05: primero se pide confirmación; solo si acepta se cierra la sesión.
logoutButton.addEventListener('click', () => {
  logoutModal.hidden = false;
  logoutCancel.focus();
});

logoutCancel.addEventListener('click', () => {
  logoutModal.hidden = true;
  logoutButton.focus();
});

logoutModal.addEventListener('click', (event) => {
  if (event.target === logoutModal) logoutModal.hidden = true;
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') logoutModal.hidden = true;
});

logoutConfirm.addEventListener('click', async () => {
  logoutConfirm.disabled = true;
  try {
    await logout();
    flash({ type: 'info', title: 'Sesión cerrada', message: 'Cerraste sesión correctamente.' });
    location.replace('/login.html');
  } catch (error) {
    logoutConfirm.disabled = false;
    logoutModal.hidden = true;
    notify({ type: 'error', title: 'No se pudo cerrar la sesión', message: friendlyMessage(error) });
  }
});

init();
// Ejecuta la inicialización en cuanto se carga el script.