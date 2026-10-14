'use strict';
// Práctica libre: HU-08 (elegir temas), HU-11 (cantidad), HU-09/HU-10 (responder) y HU-12 (navegar).
// Todo ocurre en una sola página con 4 pasos: temas -> cantidad -> preguntas -> resultado.

import '../core/pwa.js';
import { notify, flash } from '../core/notifications.js';
import { friendlyMessage } from '../core/errors.js';
import { getSession } from '../modules/auth/auth.service.js';
import { TOPICS, QUESTIONNAIRES } from '../modules/questionnaires/questionnaires.data.js';
import { VF_QUESTIONS } from '../modules/questionnaires/practice.vf.data.js';
import { saveAttempt } from '../modules/questionnaires/questionnaires.repository.js';

const CANTIDADES = [5, 10, 15, 20];
const APROBADO = 60; // porcentaje mínimo, igual que en los cuestionarios

const root = document.getElementById('ps');
const titulo = document.getElementById('ps-title');
const volver = document.getElementById('ps-back');

// ---------- Banco de preguntas por tema ----------
// Se junta lo de los cuestionarios de Kevin (selección múltiple) con las de verdadero/falso.
function bancoDeTema(topic) {
  const mc = QUESTIONNAIRES
    .filter((q) => q.category === topic.category)
    .flatMap((q) => q.questions.map((p) => ({ ...p, tema: topic.id, tipo: 'mc' })));
  const vf = VF_QUESTIONS.filter((p) => p.tema === topic.id).map((p) => ({ ...p, tipo: 'vf' }));
  return [...mc, ...vf];
}

const BANCO = Object.fromEntries(TOPICS.map((t) => [t.id, bancoDeTema(t)]));
const cuentaTema = (id) => BANCO[id].length;
const disponibles = (ids) => ids.reduce((suma, id) => suma + cuentaTema(id), 0);

function mezclar(lista) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Reparte las preguntas entre los temas elegidos: una de cada tema por turno.
function armarPreguntas(ids, total) {
  const columnas = ids.map((id) => mezclar(BANCO[id]));
  const salida = [];
  let turno = 0;
  while (salida.length < total && columnas.some((c) => c.length)) {
    const col = columnas[turno % columnas.length];
    if (col.length) salida.push(col.shift());
    turno++;
  }
  return salida;
}

// ---------- Estado ----------
const estado = {
  paso: 'temas',
  usuario: null,
  temas: [],        // ids elegidos (HU-08)
  cantidad: null,   // número elegido (HU-11)
  preguntas: [],
  respuestas: [],   // índice elegido por pregunta, o null
  actual: 0,
  errorTemas: false,
  resultado: null
};

const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const letras = ['A', 'B', 'C', 'D'];

// ---------- Paso 1: temas (HU-08) ----------
function vistaTemas() {
  const total = disponibles(estado.temas);
  const lista = TOPICS.map((t) => {
    const marcado = estado.temas.includes(t.id);
    return `
      <button type="button" class="ps-tema" data-tema="${t.id}" aria-pressed="${marcado}">
        <span class="ps-tema__icono" aria-hidden="true">${t.icon}</span>
        <span class="ps-tema__texto">
          <span class="ps-tema__nombre">${esc(t.name)}</span>
          <span class="ps-tema__cuenta">${cuentaTema(t.id)} preguntas</span>
        </span>
        <span class="ps-tema__check" aria-hidden="true">${marcado ? '✓' : ''}</span>
      </button>`;
  }).join('');

  return `
    <section class="ps-paso">
      <h1 class="ps-h1">¿Qué quieres practicar?</h1>
      <p class="ps-sub">Elige uno o varios temas.</p>
      <div class="ps-lista">${lista}</div>
      <p class="ps-aviso ps-aviso--error" role="alert" ${estado.errorTemas ? '' : 'hidden'}>Selecciona al menos un tema para continuar.</p>
      <p class="ps-resumen">${estado.temas.length
        ? `${estado.temas.length} ${estado.temas.length === 1 ? 'tema elegido' : 'temas elegidos'} · ${total} preguntas disponibles`
        : 'Aún no has elegido ningún tema'}</p>
      <button class="btn btn--primary ps-cta" type="button" data-accion="a-cantidad">Continuar</button>
    </section>`;
}

// ---------- Paso 2: cantidad (HU-11) ----------
function vistaCantidad() {
  const hay = disponibles(estado.temas);
  const botones = CANTIDADES.map((n) => `
    <button type="button" class="ps-cant" data-cantidad="${n}" aria-pressed="${estado.cantidad === n}">
      <span class="ps-cant__n">${n}</span>
      <span class="ps-cant__lbl">preguntas</span>
    </button>`).join('');

  const pocas = estado.cantidad && estado.cantidad > hay;
  const aviso = pocas
    ? `<p class="ps-aviso ps-aviso--info" role="status">Los temas elegidos solo tienen ${hay} preguntas. Practicarás con ${hay}.</p>`
    : '';
  const nombres = estado.temas.map((id) => TOPICS.find((t) => t.id === id).name).join(' · ');

  return `
    <section class="ps-paso">
      <h1 class="ps-h1">¿Cuántas preguntas?</h1>
      <p class="ps-sub">${esc(nombres)}</p>
      <div class="ps-cantidades">${botones}</div>
      ${aviso}
      <p class="ps-aviso ps-aviso--error" role="alert" ${estado.errorCantidad ? '' : 'hidden'}>Elige cuántas preguntas quieres responder.</p>
      <div class="ps-acciones">
        <button class="btn btn--ghost ps-sec" type="button" data-accion="a-temas">Cambiar temas</button>
        <button class="btn btn--primary ps-cta" type="button" data-accion="empezar">Empezar</button>
      </div>
    </section>`;
}

// ---------- Paso 3: pregunta (HU-09, HU-10, HU-12) ----------
function vistaPregunta() {
  const p = estado.preguntas[estado.actual];
  const n = estado.preguntas.length;
  const elegida = estado.respuestas[estado.actual];
  const esUltima = estado.actual === n - 1;
  const porcentaje = Math.round(((estado.actual + 1) / n) * 100);
  const tema = TOPICS.find((t) => t.id === p.tema);

  const opciones = p.options.map((texto, i) => {
    const marcada = elegida === i;
    const clase = p.tipo === 'vf' ? 'ps-op ps-op--vf' : 'ps-op';
    const letra = p.tipo === 'vf' ? '' : `<span class="ps-op__letra" aria-hidden="true">${letras[i]}</span>`;
    return `
      <button type="button" class="${clase}" data-opcion="${i}" aria-pressed="${marcada}">
        ${letra}<span class="ps-op__texto">${esc(texto)}</span>
      </button>`;
  }).join('');

  return `
    <section class="ps-paso">
      <div class="ps-progreso" role="progressbar" aria-valuemin="1" aria-valuemax="${n}" aria-valuenow="${estado.actual + 1}">
        <div class="ps-progreso__barra"><div class="ps-progreso__relleno" data-ancho="${porcentaje}"></div></div>
        <p class="ps-progreso__txt">Pregunta ${estado.actual + 1} de ${n}</p>
      </div>
      <p class="ps-etiqueta">${tema.icon} ${esc(tema.category)}${p.tipo === 'vf' ? ' · Verdadero o falso' : ''}</p>
      <h1 class="ps-pregunta">${esc(p.text)}</h1>
      <div class="ps-opciones">${opciones}</div>
      <p class="ps-aviso ps-aviso--error" role="alert" ${estado.errorRespuesta ? '' : 'hidden'}>Elige una respuesta para continuar.</p>
      <div class="ps-nav">
        <button class="btn btn--ghost ps-sec" type="button" data-accion="anterior" ${estado.actual === 0 ? 'disabled' : ''}>Anterior</button>
        <button class="btn btn--primary ps-cta" type="button" data-accion="${esUltima ? 'finalizar' : 'siguiente'}">${esUltima ? 'Finalizar' : 'Siguiente'}</button>
      </div>
    </section>`;
}

// ---------- Paso 4: resultado ----------
function vistaResultado() {
  const r = estado.resultado;
  const revision = r.review.map((q, k) => {
    const estadoTxt = q.selectedIndex === null ? 'Sin responder' : q.isCorrect ? 'Correcta' : 'Incorrecta';
    const clase = q.isCorrect ? 'ok' : 'mal';
    const tuya = q.selectedIndex === null ? '—' : esc(q.options[q.selectedIndex]);
    return `
      <li class="ps-rev ps-rev--${clase}">
        <p class="ps-rev__estado">${k + 1}. ${estadoTxt}</p>
        <p class="ps-rev__texto">${esc(q.text)}</p>
        <p class="ps-rev__resp">Tu respuesta: <strong>${tuya}</strong></p>
        ${q.isCorrect ? '' : `<p class="ps-rev__resp">Correcta: <strong>${esc(q.options[q.correctIndex])}</strong></p>`}
        <p class="ps-rev__exp">${esc(q.explanation || '')}</p>
      </li>`;
  }).join('');

  return `
    <section class="ps-paso">
      <div class="ps-final ${r.passed ? 'ps-final--ok' : ''}">
        <p class="ps-final__pct">${r.percentage}%</p>
        <h1 class="ps-final__msg">${r.passed ? '¡Muy bien!' : 'Sigue practicando'}</h1>
        <p class="ps-sub">${r.correctCount} de ${r.totalQuestions} respuestas correctas</p>
      </div>
      <div class="ps-acciones">
        <button class="btn btn--ghost ps-sec" type="button" data-accion="de-nuevo">Practicar de nuevo</button>
        <a class="btn btn--primary ps-cta" href="/">Ir al inicio</a>
      </div>
      <h2 class="ps-h2">Revisión</h2>
      <ol class="ps-revision">${revision}</ol>
    </section>`;
}

// ---------- Dibujo ----------
function dibujar() {
  const vistas = { temas: vistaTemas, cantidad: vistaCantidad, preguntas: vistaPregunta, resultado: vistaResultado };
  root.innerHTML = vistas[estado.paso]();
  // El ancho de la barra se asigna por CSSOM (la política de seguridad no permite style="" en el HTML).
  const relleno = root.querySelector('.ps-progreso__relleno');
  if (relleno) relleno.style.width = `${relleno.dataset.ancho}%`;
  titulo.textContent = estado.paso === 'preguntas' ? 'Práctica libre' : estado.paso === 'resultado' ? 'Resultado' : 'Práctica libre';
  window.scrollTo(0, 0);
}

// ---------- Acciones ----------
function alternarTema(id) {
  estado.temas = estado.temas.includes(id) ? estado.temas.filter((t) => t !== id) : [...estado.temas, id];
  estado.errorTemas = false;
  const y = window.scrollY;
  dibujar();
  window.scrollTo(0, y);
}

function empezar() {
  const hay = disponibles(estado.temas);
  const total = Math.min(estado.cantidad, hay);
  estado.preguntas = armarPreguntas(estado.temas, total);
  estado.respuestas = estado.preguntas.map(() => null);
  estado.actual = 0;
  estado.errorRespuesta = false;
  estado.paso = 'preguntas';
  dibujar();
}

async function finalizar() {
  let aciertos = 0;
  const review = estado.preguntas.map((p, k) => {
    const sel = estado.respuestas[k];
    const ok = sel === p.correctIndex;
    if (ok) aciertos++;
    return { id: p.id, text: p.text, options: p.options, selectedIndex: sel, correctIndex: p.correctIndex, isCorrect: ok, explanation: p.explanation };
  });
  const total = estado.preguntas.length;
  const percentage = Math.round((aciertos / total) * 100);
  const nombres = estado.temas.map((id) => TOPICS.find((t) => t.id === id).category);

  const intento = {
    userId: estado.usuario.id,
    questionnaireId: 'practica-libre',
    questionnaireTitle: 'Práctica libre',
    category: nombres.join(', '),
    correctCount: aciertos,
    totalQuestions: total,
    percentage,
    passed: percentage >= APROBADO,
    review
  };
  try {
    estado.resultado = await saveAttempt(intento);
  } catch (error) {
    estado.resultado = intento; // se muestra igual aunque no se haya podido guardar
    notify({ type: 'warning', title: 'No se guardó el resultado', message: friendlyMessage(error) });
  }
  estado.paso = 'resultado';
  dibujar();
}

root.addEventListener('click', (e) => {
  const tema = e.target.closest('[data-tema]');
  if (tema) return alternarTema(tema.dataset.tema);

  const cant = e.target.closest('[data-cantidad]');
  if (cant) {
    estado.cantidad = Number(cant.dataset.cantidad);
    estado.errorCantidad = false;
    return dibujar();
  }

  const op = e.target.closest('[data-opcion]');
  if (op) {
    estado.respuestas[estado.actual] = Number(op.dataset.opcion);
    estado.errorRespuesta = false;
    return dibujar();
  }

  const boton = e.target.closest('[data-accion]');
  if (!boton) return;

  switch (boton.dataset.accion) {
    case 'a-cantidad':
      if (!estado.temas.length) { estado.errorTemas = true; return dibujar(); }
      estado.paso = 'cantidad';
      return dibujar();
    case 'a-temas':
      estado.paso = 'temas';
      return dibujar();
    case 'empezar':
      if (!estado.cantidad) { estado.errorCantidad = true; return dibujar(); }
      return empezar();
    case 'anterior':
      if (estado.actual > 0) { estado.actual--; estado.errorRespuesta = false; dibujar(); }
      return undefined;
    case 'siguiente':
    case 'finalizar':
      if (estado.respuestas[estado.actual] === null) { estado.errorRespuesta = true; return dibujar(); }
      if (boton.dataset.accion === 'siguiente') { estado.actual++; estado.errorRespuesta = false; return dibujar(); }
      return finalizar();
    case 'de-nuevo':
      Object.assign(estado, { paso: 'temas', temas: [], cantidad: null, preguntas: [], respuestas: [], actual: 0, resultado: null });
      return dibujar();
    default:
      return undefined;
  }
});

// La flecha ← vuelve un paso; en el primer paso (o en el resultado) va al inicio.
volver.addEventListener('click', (e) => {
  if (estado.paso === 'cantidad') { e.preventDefault(); estado.paso = 'temas'; dibujar(); }
  if (estado.paso === 'preguntas' && estado.actual > 0) { e.preventDefault(); estado.actual--; dibujar(); }
});

async function init() {
  try {
    const result = await getSession();
    if (result.status !== 'active') {
      flash(result.status === 'expired'
        ? { type: 'warning', title: 'Tu sesión expiró', message: 'Inicia sesión de nuevo para continuar.' }
        : { type: 'info', title: 'Inicia sesión', message: 'Necesitas una cuenta activa para entrar.' });
      location.replace('/login.html');
      return;
    }
    estado.usuario = result.user;
    root.hidden = false;
    dibujar();
  } catch (error) {
    notify({ type: 'error', title: 'No se pudo verificar tu sesión', message: friendlyMessage(error) });
  }
}

init();
