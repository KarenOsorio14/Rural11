'use strict';
// Página a la que lleva el enlace del correo: comprueba el enlace y marca la cuenta como verificada.

import '../core/pwa.js';
import { confirmarVerificacion } from '../modules/auth/verificacion.service.js';
import { showStorageRecovery } from '../core/storage-recovery.js';

const titulo = document.getElementById('verif-titulo');
const texto = document.getElementById('verif-texto');
const grano = document.getElementById('verif-grano');
const ir = document.getElementById('verif-ir');

const MENSAJES = {
  verificado: ['¡Correo verificado!', 'Tu cuenta ya está verificada. Entra con tu número de identidad y tu contraseña.', 'celebra'],
  'ya-verificado': ['Este correo ya estaba verificado', 'No tienes que hacer nada más: ya puedes entrar.', 'celebra'],
  'sin-cuenta-aqui': ['Ábrelo donde te registraste', 'El enlace es válido, pero no encuentro tu cuenta en este navegador. Ábrelo en el mismo navegador y dispositivo donde creaste la cuenta.', 'confundido'],
  invalido: ['Enlace no válido', 'Este enlace no sirve. Entra a tu perfil y pide un correo nuevo con «Reenviar correo de verificación».', 'confundido'],
  expirado: ['El enlace venció', 'Los enlaces duran 48 horas. Entra a tu perfil y pide un correo nuevo con «Reenviar correo de verificación».', 'nervioso'],
  'sin-conexion': ['Sin conexión', 'No pudimos comprobar el enlace. Revisa tu internet y vuelve a abrirlo.', 'estudia'],
  error: ['No se pudo verificar', 'Algo falló al comprobar el enlace. Inténtalo de nuevo en un momento.', 'confundido'],
};

function mostrar(estado) {
  const [t, d, pose] = MENSAJES[estado] || MENSAJES.error;
  titulo.textContent = t;
  texto.textContent = d;
  grano.src = `/img/grano/3d/${pose}.webp`;
  ir.hidden = false;
}

(async () => {
  const token = new URLSearchParams(location.search).get('token');
  try {
    const { estado } = await confirmarVerificacion(token);
    mostrar(estado);
  } catch (error) {
    if (showStorageRecovery(error)) return;
    mostrar('error');
  }
})();
