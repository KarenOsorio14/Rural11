'use strict';

import '../core/pwa.js';
// Registra el service worker y activa el botón de modo día / noche.
import { getSession } from '../modules/auth/auth.service.js';

// Si ya hay una sesión activa no tiene sentido mostrar la bienvenida: se pasa directo al inicio.
getSession()
  .then((result) => {
    if (result.status === 'active') location.replace('/');
  })
  .catch(() => {
    // Si no se puede verificar la sesión se deja la pantalla de bienvenida.
  });
