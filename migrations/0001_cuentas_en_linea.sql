-- HU-29: cuentas y avance en línea (Cloudflare D1).
-- Se aplica con: npx wrangler d1 migrations apply rural11-db --remote

CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY,
  documento TEXT NOT NULL UNIQUE,
  correo TEXT NOT NULL UNIQUE,
  nombres TEXT NOT NULL,
  apellidos TEXT NOT NULL,
  clave_sal TEXT NOT NULL,
  clave_hash TEXT NOT NULL,
  clave_iteraciones INTEGER NOT NULL,
  verificado INTEGER NOT NULL DEFAULT 0,
  -- HU-24: el estudiante puede ocultarse de las comparaciones públicas.
  oculto INTEGER NOT NULL DEFAULT 0,
  creado TEXT NOT NULL
);

-- Cada actividad terminada (cuestionario, simulacro, práctica). "datos" guarda el intento completo
-- tal como lo usa la app; puntos y porcentaje van aparte para calcular el ranking rápido.
CREATE TABLE IF NOT EXISTS intentos (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  datos TEXT NOT NULL,
  puntos INTEGER NOT NULL DEFAULT 0,
  porcentaje INTEGER NOT NULL DEFAULT 0,
  creado TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS intentos_usuario ON intentos(usuario_id);

-- HU-01: bloqueo temporal tras varios intentos fallidos, ahora también en el servidor.
CREATE TABLE IF NOT EXISTS bloqueos (
  documento TEXT PRIMARY KEY,
  fallos INTEGER NOT NULL DEFAULT 0,
  hasta INTEGER NOT NULL DEFAULT 0
);
