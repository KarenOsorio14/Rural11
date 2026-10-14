'use strict';

const config = require('./config');
const { createApp } = require('./app');

createApp().listen(config.port, () => {
  console.log(`PWA disponible en http://localhost:${config.port}`);
});
