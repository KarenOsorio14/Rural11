'use strict';

import '../core/pwa.js';
// Registra el service worker y activa el botón de modo día / noche.
import { getSession } from '../modules/auth/auth.service.js';
import { showStorageRecovery } from '../core/storage-recovery.js';

// Si ya hay una sesión activa no tiene sentido mostrar la bienvenida: se pasa directo al inicio.
getSession()
  .then((result) => {
    if (result.status === 'active') location.replace('/');
  })
  .catch((error) => {
    // Si el almacenamiento local no está disponible, se ofrece recuperarlo.
    showStorageRecovery(error);
    // Cualquier otro fallo deja la pantalla de bienvenida visible.
  });
