'use strict';

// Sube la versión cada vez que cambies archivos del shell para invalidar la caché anterior.
const VERSION = 'v3';
const CACHE = `shell-${VERSION}`;

const SHELL = [
  '/',
  '/login.html',
  '/register.html',
  '/manifest.webmanifest',
  '/css/base.css',
  '/css/components.css',
  '/css/auth.css',
  '/css/home.css',
  '/css/questionnaires.css',
  '/js/core/db.js',
  '/js/core/errors.js',
  '/js/core/form.js',
  '/js/core/notifications.js',
  '/js/core/pwa.js',
  '/js/core/theme.js',
  '/js/modules/users/index.js',
  '/js/modules/users/users.repository.js',
  '/js/modules/auth/auth.service.js',
  '/js/modules/auth/password.js',
  '/js/modules/auth/session.js',
  '/js/modules/questionnaires/questionnaires.data.js',
  '/js/modules/questionnaires/questionnaires.repository.js',
  '/js/modules/questionnaires/questionnaires.service.js',
  '/js/pages/login.js',
  '/js/pages/register.js',
  '/js/pages/home.js',
  '/practice.html',
  '/js/pages/practice.js',
  '/icons/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo se gestionan peticiones GET del mismo origen.
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // Páginas: red primero, caché si no hay conexión.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match('/login.html')))
    );
    return;
  }

  // En desarrollo local (localhost), red primero para ver cambios al instante.
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // En producción: Estáticos con caché primero y actualización en segundo plano.
  event.respondWith(
    caches.match(request).then((hit) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => hit);
      return hit || network;
    })
  );
});
