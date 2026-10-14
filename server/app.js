'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const securityHeaders = require('./shared/middleware/security-headers');

const publicDir = path.join(__dirname, '..', 'public');

// Con IndexedDB los datos viven en el navegador: el servidor solo entrega la PWA.
function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(securityHeaders);

  // Recarga en tiempo real nativa para desarrollo (SSE compatible con Brave y CSP)
  const sseClients = new Set();
  app.get('/__live_reload', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    });
    res.write('data: connected\n\n');
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
  });

  let reloadTimer;
  try {
    fs.watch(publicDir, { recursive: true }, () => {
      clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => {
        for (const client of sseClients) {
          client.write('data: reload\n\n');
        }
      }, 80);
    });
  } catch (err) {
    console.warn('Live reload no pudo iniciar observador de archivos:', err.message);
  }

  // El service worker debe revalidarse siempre para que las actualizaciones lleguen.
  app.get('/sw.js', (req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.sendFile(path.join(publicDir, 'sw.js'));
  });

  app.use(express.static(publicDir));

  return app;
}

module.exports = { createApp };

