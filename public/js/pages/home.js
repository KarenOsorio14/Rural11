'use strict';
// Modo estricto.

import '../core/pwa.js';
// Solo se importa por su efecto secundario (registra el service worker, etc.);
// no se usa ningún export de este módulo aquí.
import { notify, flash, showPendingFlash } from '../core/notifications.js';
// Funciones para mostrar notificaciones: notify (toast inmediato), flash (mensaje que
// sobrevive a una redirección) y showPendingFlash (muestra el flash pendiente al cargar).
import { friendlyMessage } from '../core/errors.js';
// Convierte cualquier error en un mensaje seguro y amigable para mostrar al usuario.
import { getSession, logout } from '../modules/auth/auth.service.js';
// Funciones del servicio de autenticación: obtener sesión actual y cerrar sesión.
import {
  getTopicsWithStats,
  getQuestionnairesList,
  getUserAttempts
} from '../modules/questionnaires/questionnaires.service.js';
// Funciones del servicio de cuestionarios: temas con estadísticas e historial del usuario.

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
  routeSvg.setAttribute('viewBox', `0 0 320 ${cursorY + 150}`);

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

  // Meta: Simulacro ICFES (llega en el Sprint 2, por ahora aparece como última parada).
  const gy = cursorY + 36;
  const goalGroup = svgEl('g', { class: 'rm-node rm-node--goal rm-c-meta', 'aria-label': 'Simulacro ICFES (próximamente)' }, routeSvg);
  svgEl('circle', { class: 'rm-base', cx: 160, cy: gy + DEPTH, r: R }, goalGroup);
  svgEl('circle', { class: 'rm-disc', cx: 160, cy: gy, r: R }, goalGroup);
  svgEl('path', { class: 'rm-shine', d: `M${160 - 26} ${gy - 8} a28 28 0 0 1 30 -22` }, goalGroup);
  svgEl('path', { class: 'rt-flag', d: `M${160 - 9} ${gy - 14} v28 M${160 - 9} ${gy - 14} h19 l-5 7 l5 7 h-19` }, goalGroup);
  svgEl('text', { class: 'rm-goal-name', x: 160, y: gy + R + DEPTH + 24, 'text-anchor': 'middle' }, goalGroup).textContent = 'Simulacro ICFES';

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
    const points = history.reduce((acc, h) => acc + h.correctCount * 10, 0);
    // 10 puntos por cada respuesta correcta en cualquier cuestionario o práctica libre.
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
  } catch (error) {
    // Si cualquiera de las consultas anteriores falla (por ejemplo, IndexedDB no disponible)...
    notify({ type: 'error', title: 'Error', message: 'No se pudieron cargar los datos de Ciencias Sociales.' });
    // Muestra una notificación de error genérica al usuario.
  }
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
    // Si getSession() falla de forma inesperada...
    notify({ type: 'error', title: 'No se pudo verificar tu sesión', message: friendlyMessage(error) });
  }
}

// ---------- Pestañas Ruta / Práctica / Perfil ----------
const tabButtons = document.querySelectorAll('[data-tab]');
const panels = document.querySelectorAll('[data-panel]');
const TAB_NAMES = ['ruta', 'practica', 'perfil'];

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