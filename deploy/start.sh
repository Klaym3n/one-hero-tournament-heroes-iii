#!/bin/sh
set -e
# Port: Pterodactyl podaje SERVER_PORT
export PORT="${SERVER_PORT:-${PORT:-3000}}"
export HOSTNAME="0.0.0.0"

# Grafiki trzymane na trwałym wolumenie (edytowalne przez menedżer plików panelu)
if [ -z "${ASSETS_DIR}" ] && [ -d /home/container ] && [ -w /home/container ]; then
  export ASSETS_DIR=/home/container/assets
fi
if [ -n "${ASSETS_DIR}" ]; then
  mkdir -p "${ASSETS_DIR}/factions" "${ASSETS_DIR}/heroes" "${ASSETS_DIR}/ui"
  # domyślne pliki kopiowane tylko, jeśli nie istnieją
  cp -rn /app/default-assets/. "${ASSETS_DIR}/" 2>/dev/null || true
fi

echo "[start] migracje bazy danych…"
node /app/scripts/migrate.mjs
echo "[start] uruchamiam serwis na porcie ${PORT}"
cd /app
exec node server.js
