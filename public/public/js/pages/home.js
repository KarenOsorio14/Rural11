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

    // 2. Renderizar los 4 Módulos/Temas de Ciencias Sociales
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
            <div style="display: flex; gap: 0.4rem; align-items: center;">
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
          <a href="/practice.html?topic=${t.id}" target="_blank" class="btn btn--primary q-card__btn" style="text-decoration: none;">
            Practicar este tema ↗
          </a>
        </article>
      `;
        // El enlace "Practicar este tema" abre practice.html?topic=<id> en una pestaña nueva
        // (target="_blank"), pasando el id del tema como parámetro de URL.
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
          const badgeColor = att.passed ? 'var(--success)' : 'var(--danger)';
          // Color del texto de la insignia según si aprobó o no (variables CSS del tema).
          const badgeBg = att.passed ? 'var(--success-soft)' : 'var(--danger-soft)';
          // Color de fondo suave, a juego con el color de texto.
          const statusText = att.passed ? 'Aprobado' : 'No aprobado';
          // Texto descriptivo del resultado.

          return `
          <tr>
            <td>
              <strong>${att.questionnaireTitle || 'Cuestionario'}</strong>
              <div style="font-size: 0.75rem; color: var(--muted);">${att.category || ''}</div>
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
      // Une todas las filas y las inyecta en el <tbody>.
      historyContainer.style.display = 'block';
      // Muestra el contenedor de la tabla (por si estaba oculto).
    } else {
      historyContainer.style.display = 'none';
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
      ? 'Se mantiene iniciada en este dispositivo'
      : 'Termina al cerrar la pestaña o el navegador';
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
    // Cada vez que la ventana/pestaña recupera el foco (por ejemplo, tras cerrar la pestaña
    // de práctica que se abrió con target="_blank"), se vuelven a cargar los datos para
    // reflejar nuevos intentos sin necesidad de recargar manualmente.
  } catch (error) {
    // Si getSession() falla de forma inesperada...
    notify({ type: 'error', title: 'No se pudo verificar tu sesión', message: friendlyMessage(error) });
  }
}

logoutButton.addEventListener('click', async () => {
  // Maneja el clic en el botón de cerrar sesión.
  logoutButton.disabled = true;
  // Deshabilita el botón mientras se procesa, para evitar doble clic.
  try {
    await logout();
    // Cierra la sesión (borra el registro en IndexedDB).
    flash({ type: 'info', title: 'Sesión cerrada', message: 'Cerraste sesión correctamente.' });
    // Prepara un mensaje flash para mostrarlo en la siguiente página (login).
    location.replace('/login.html');
    // Redirige al login.
  } catch (error) {
    logoutButton.disabled = false;
    // Si algo falla, se vuelve a habilitar el botón para reintentar.
    notify({ type: 'error', title: 'No se pudo cerrar la sesión', message: friendlyMessage(error) });
  }
});

init();
// Ejecuta la inicialización en cuanto se carga el script.