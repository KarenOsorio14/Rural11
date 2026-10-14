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

const NODE_POS = [
  { x: 70, y: 320 },
  { x: 210, y: 260 },
  { x: 90, y: 200 },
  { x: 210, y: 140 },
  { x: 150, y: 60 }
];
// Posiciones de las 5 paradas: 4 temas y la meta (Simulacro ICFES). Mismo trazado del diseño.

function svgEl(name, attrs = {}, parent) {
  // Crea un elemento SVG con sus atributos (los colores van en clases CSS por la CSP).
  const el = document.createElementNS(SVG_NS, name);
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
  if (parent) parent.appendChild(el);
  return el;
}

function segmentPath(a, b) {
  // Curva en S entre dos paradas.
  const mid = (a.x + b.x) / 2;
  return `M${a.x} ${a.y} C ${mid} ${a.y}, ${mid} ${b.y}, ${b.x} ${b.y}`;
}

function drawRoute(topics) {
  // Dibuja el mapa: tema aprobado = hecho, primer tema sin aprobar = actual, el resto = bloqueado.
  routeSvg.replaceChildren();
  const doneFlags = topics.map((t) => t.passedCount > 0);
  const currentIndex = doneFlags.indexOf(false);
  // -1 si el usuario ya aprobó los 4 temas.

  const stateOf = (i) => (doneFlags[i] ? 'done' : i === currentIndex ? 'now' : 'locked');

  // Tramos: base para todos y punteado verde para el recorrido ya hecho.
  for (let i = 0; i < topics.length; i += 1) {
    svgEl('path', { class: 'rt-base', d: segmentPath(NODE_POS[i], NODE_POS[i + 1]) }, routeSvg);
  }
  for (let i = 0; i < topics.length; i += 1) {
    if (stateOf(i) === 'done' && stateOf(i + 1) !== 'locked') {
      svgEl('path', { class: 'rt-done', d: segmentPath(NODE_POS[i], NODE_POS[i + 1]) }, routeSvg);
    }
  }
  // La meta (i = 4) no es un tema: stateOf(4) devuelve 'locked' y el tramo final solo se
  // pinta de verde cuando se aprobaron los 4 temas (ver más abajo).
  if (currentIndex === -1) {
    svgEl('path', { class: 'rt-done', d: segmentPath(NODE_POS[3], NODE_POS[4]) }, routeSvg);
  }

  topics.forEach((topic, i) => {
    const { x, y } = NODE_POS[i];
    const state = stateOf(i);
    const label = SHORT_NAMES[topic.id] || topic.category;
    const onLeft = x > 150;
    const text = state === 'now' ? `¡Sigue aquí! ${label}` : label;

    let group;
    if (state === 'locked') {
      group = svgEl('g', { 'aria-label': `${label} (bloqueado)` }, routeSvg);
    } else {
      group = svgEl('a', { href: `/practice.html?topic=${topic.id}`, class: 'rt-link', 'aria-label': `${text}: practicar este tema` }, routeSvg);
    }

    if (state === 'now') svgEl('circle', { class: 'rt-halo', cx: x, cy: y, r: 27 }, group);
    if (state === 'done') {
      svgEl('circle', { class: 'rt-node-done', cx: x, cy: y, r: 19 }, group);
      svgEl('path', { class: 'rt-check', d: `M${x - 7} ${y} l5.5 5.5 l9.5 -11` }, group);
    } else if (state === 'now') {
      svgEl('circle', { class: 'rt-node-now', cx: x, cy: y, r: 19 }, group);
      svgEl('circle', { class: 'rt-dot', cx: x, cy: y, r: 6 }, group);
    } else {
      svgEl('circle', { class: 'rt-node-lock', cx: x, cy: y, r: 19 }, group);
      svgEl('rect', { class: 'rt-lock', x: x - 6, y: y - 1, width: 12, height: 9, rx: 2 }, group);
      svgEl('path', { class: 'rt-lock-arc', d: `M${x - 3.5} ${y - 1} v-3 a3.5 3.5 0 0 1 7 0 v3` }, group);
    }

    const cls = state === 'now' ? 'rt-label rt-label--now' : state === 'locked' ? 'rt-label rt-label--muted' : 'rt-label';
    const labelEl = svgEl('text', {
      class: cls,
      x: onLeft ? x - 28 : x + 28,
      y: y + 4,
      'text-anchor': onLeft ? 'end' : 'start'
    }, group);
    labelEl.textContent = text;
  });

  // Meta: Simulacro ICFES (llega en el Sprint 2, por ahora aparece como próxima parada).
  const goal = NODE_POS[4];
  const goalGroup = svgEl('g', { 'aria-label': 'Simulacro ICFES (próximamente)' }, routeSvg);
  svgEl('circle', { class: 'rt-node-flag', cx: goal.x, cy: goal.y, r: 22 }, goalGroup);
  svgEl('path', { class: 'rt-flag', d: `M${goal.x - 6} ${goal.y - 9} v18 M${goal.x - 6} ${goal.y - 9} h13 l-3.5 5 l3.5 5 h-13` }, goalGroup);
  const goalLabel = svgEl('text', { class: 'rt-label rt-label--muted', x: goal.x + 32, y: goal.y + 4 }, goalGroup);
  goalLabel.textContent = 'Simulacro ICFES';

  // Botón principal bajo el mapa.
  if (currentIndex === -1) {
    routeCta.textContent = '¡Ruta completada! Práctica libre';
    routeCta.href = '/sesion.html';
  } else {
    const t = topics[currentIndex];
    routeCta.textContent = `Continuar: ${SHORT_NAMES[t.id] || t.category}`;
    routeCta.href = `/practice.html?topic=${t.id}`;
  }
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
    chipStreak.textContent = `🔥 ${streak} ${streak === 1 ? 'día' : 'días'}`;
    chipPoints.textContent = `⭐ ${points}`;
    levelShort.textContent = `Nivel ${1 + passedCount}`;

    if (passedCount >= 4) {
      // Sistema simple de "niveles" gamificados según cuántos cuestionarios ha aprobado.
      profileLevel.textContent = '🏅 Maestro en Ciencias Sociales';
    } else if (passedCount >= 2) {
      profileLevel.textContent = '🎖️ Investigador Social';
    } else if (passedCount >= 1) {
      profileLevel.textContent = '📖 Estudiante Activo';
    } else {
      profileLevel.textContent = '🧭 Explorador Social';
      // Nivel por defecto para quien aún no ha aprobado ninguno.
    }

    // 2. Mapa de la ruta y tarjetas de los 4 temas de Ciencias Sociales
    drawRoute(topics);
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
            <span class="q-card__icon">${t.icon}</span>
            <div class="q-card__badges">
              <span class="q-card__badge">${t.badge}</span>
              ${statsBadge}
            </div>
          </div>
          <h3 class="q-card__title">${t.name}</h3>
          <p class="q-card__desc">${t.description}</p>
          <div class="q-card__meta">
            <span>📚 ${t.questionnairesCount} cuestionario(s)</span>
            <span>📝 ${t.totalQuestions} preguntas</span>
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
      location.replace('/login.html');
      // Redirige al login, reemplazando la entrada en el historial (para que "atrás" no vuelva aquí).
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